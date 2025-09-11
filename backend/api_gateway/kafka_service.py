import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Union, List, Set
import logging
from aiokafka.errors import KafkaError, KafkaConnectionError, ConsumerStoppedError
from pydantic import ValidationError
import backoff
import json
import time
from collections import defaultdict
import weakref

# Import shared models
from shared.models.assessment import FormSubmissionRequest, AssessmentProgress, AssessmentStatus
from shared.models.events import (
    BaseEvent, FormSubmissionEvent, DomainScoredEvent, AssessmentCompletedEvent,
    AssessmentStatusUpdatedEvent, ErrorEvent, EventFactory, EventType
)

from .config import settings
from .database import DatabaseManager
from shared.models.exceptions import KafkaConnectionException
# Import shared utilities
from shared.kafka_utils import create_kafka_producer, create_kafka_consumer, KafkaConfig
from .websocket_service import connection_manager
from .weighting_service import WeightingService

logger = logging.getLogger(__name__)

class KafkaMetrics:
    """Metrics collection for Kafka service"""
    def __init__(self):
        self.messages_published = defaultdict(int)
        self.messages_consumed = defaultdict(int)
        self.errors = defaultdict(int)
        self.processing_times = []
        self.last_message_time = None
        self.start_time = datetime.utcnow()
    
    def record_publish(self, topic: str):
        self.messages_published[topic] += 1
        self.last_message_time = datetime.utcnow()
    
    def record_consume(self, topic: str, processing_time: float):
        self.messages_consumed[topic] += 1
        self.processing_times.append(processing_time)
        # Keep only last 1000 processing times
        if len(self.processing_times) > 1000:
            self.processing_times = self.processing_times[-1000:]
        self.last_message_time = datetime.utcnow()
    
    def record_error(self, error_type: str):
        self.errors[error_type] += 1
    
    def get_stats(self) -> Dict[str, Any]:
        avg_processing_time = (
            sum(self.processing_times) / len(self.processing_times) 
            if self.processing_times else 0
        )
        
        return {
            "uptime_seconds": (datetime.utcnow() - self.start_time).total_seconds(),
            "messages_published": dict(self.messages_published),
            "messages_consumed": dict(self.messages_consumed),
            "errors": dict(self.errors),
            "avg_processing_time_ms": avg_processing_time * 1000,
            "last_message_time": self.last_message_time.isoformat() if self.last_message_time else None
        }

class KafkaService:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.producer = None
        self.consumer = None
        self.running = False
        self._producer_lock = asyncio.Lock()
        self._consumer_lock = asyncio.Lock()
        self._shutdown_event = asyncio.Event()
        self.metrics = KafkaMetrics()
        
        # Circuit breaker for producer
        self._producer_failures = 0
        self._producer_circuit_open = False
        self._producer_last_failure = None
        
        # Message processing state
        self._processing_assessments: set[str] = set()  # Track assessments currently being processed
        self._message_cache = {}  # Cache recent messages to avoid duplicate processing
        
        # Domain to topic mapping for form submissions - UPDATED to include sustainability
        self.submission_topic_mapping = {
            "resilience": settings.resilience_submission_topic,
            "sustainability": settings.sustainability_submission_topic,  
            "elca": settings.elca_submission_topic,
            "lcc": settings.lcc_submission_topic,
            "slca": settings.slca_submission_topic,
            "human_centricity": settings.human_centricity_submission_topic,
        }
        
        # Topics to consume score updates from - UPDATED to include sustainability
        self.score_topics = [
            settings.resilience_scores_topic,
            settings.sustainability_scores_topic, 
            settings.elca_scores_topic, 
            settings.lcc_scores_topic,
            settings.slca_scores_topic,
            settings.human_centricity_scores_topic,
            settings.final_results_topic,
        ]
        
        # Initialize weighting service
        self.weighting_service = WeightingService()
        
    @backoff.on_exception(
        backoff.expo,
        (KafkaConnectionError, KafkaError),
        max_tries=5,
        max_time=60,
        jitter=backoff.full_jitter
    )
    async def start(self):
        """Start Kafka producer and consumer using shared utilities"""
        try:
            logger.info("Starting Kafka service...")
            
            # Use shared producer creation with retries
            self.producer = await create_kafka_producer()
            logger.info("Kafka producer started")
            
            # Use shared consumer creation with retries
            self.consumer = await create_kafka_consumer(
                topics=self.score_topics,
                group_id=settings.kafka_consumer_group_id,
                auto_offset_reset='latest'
            )
            logger.info(f"Kafka consumer started, subscribed to topics: {self.score_topics}")
            
            self.running = True
            self._producer_failures = 0
            self._producer_circuit_open = False
            
            logger.info("Kafka service started successfully using shared utilities")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka service: {e}")
            self.metrics.record_error("startup_failure")
            await self.stop()
            raise KafkaConnectionException(f"Failed to start Kafka service: {e}")
    
    async def stop(self):
        """Stop Kafka producer and consumer gracefully"""
        logger.info("Stopping Kafka service...")
        self.running = False
        self._shutdown_event.set()
        
        # Stop consumer first to prevent new message processing
        if self.consumer:
            try:
                async with self._consumer_lock:
                    await asyncio.wait_for(self.consumer.stop(), timeout=10.0)
                    logger.info("Kafka consumer stopped")
            except asyncio.TimeoutError:
                logger.warning("Consumer stop timeout, forcing shutdown")
            except Exception as e:
                logger.error(f"Error stopping consumer: {e}")
        
        # Wait for any ongoing message processing to complete
        max_wait = 30  # seconds
        wait_start = time.time()
        while self._processing_assessments and (time.time() - wait_start) < max_wait:
            logger.info(f"Waiting for {len(self._processing_assessments)} assessments to finish processing...")
            await asyncio.sleep(1)
        
        if self._processing_assessments:
            logger.warning(f"Force stopping with {len(self._processing_assessments)} assessments still processing")
        
        # Stop producer
        if self.producer:
            try:
                async with self._producer_lock:
                    await asyncio.wait_for(self.producer.stop(), timeout=10.0)
                    logger.info("Kafka producer stopped")
            except asyncio.TimeoutError:
                logger.warning("Producer stop timeout, forcing shutdown")
            except Exception as e:
                logger.error(f"Error stopping producer: {e}")
        
        logger.info("Kafka service stopped")

    def _is_producer_available(self) -> bool:
        """Check if producer is available (circuit breaker pattern)"""
        if not self.producer or not self.running:
            return False
        
        # Check circuit breaker
        if self._producer_circuit_open:
            if self._producer_last_failure and (
                datetime.utcnow() - self._producer_last_failure
            ).total_seconds() > 60:  # Reset after 1 minute
                self._producer_circuit_open = False
                self._producer_failures = 0
                logger.info("Producer circuit breaker reset")
            else:
                return False
        
        return True

    async def _handle_producer_failure(self, error: Exception):
        """Handle producer failures with circuit breaker"""
        self._producer_failures += 1
        self._producer_last_failure = datetime.utcnow()
        
        if self._producer_failures >= 3:  # Open circuit after 3 failures
            self._producer_circuit_open = True
            logger.error(f"Producer circuit breaker opened after {self._producer_failures} failures")
        
        self.metrics.record_error("producer_failure")
        logger.error(f"Producer failure #{self._producer_failures}: {error}")

    async def _publish_event(self, topic: str, event: BaseEvent, key: Optional[str] = None, retry_count: int = 0):
        """Generic method to publish events using shared models"""
        if not self._is_producer_available():
            raise KafkaConnectionException("Kafka producer not available or circuit breaker open")
        
        try:
            # Use event's dict method for consistent serialization
            message = event.dict()
            
            async with self._producer_lock:
                await asyncio.wait_for(
                    self.producer.send(
                        topic,
                        value=message,
                        key=key.encode('utf-8') if key else None
                    ),
                    timeout=10.0  # Add timeout
                )
                await asyncio.wait_for(self.producer.flush(), timeout=5.0)
            
            # Reset failure count on success
            self._producer_failures = 0
            self.metrics.record_publish(topic)
            
            logger.debug(f"Published {event.event_type} event for assessment {event.assessment_id} to topic {topic}")
            
        except asyncio.TimeoutError:
            error_msg = f"Timeout publishing to {topic}"
            logger.error(error_msg)
            await self._handle_producer_failure(Exception(error_msg))
            
            # Retry logic
            if retry_count < 2:
                await asyncio.sleep(2 ** retry_count)  # Exponential backoff
                return await self._publish_event(topic, event, key, retry_count + 1)
            
            raise KafkaConnectionException(f"Timeout publishing to {topic} after {retry_count + 1} attempts")
            
        except Exception as e:
            await self._handle_producer_failure(e)
            
            # Publish error event if not already an error event
            if event.event_type != EventType.ERROR_OCCURRED and retry_count == 0:
                try:
                    await self._publish_error_event(
                        assessment_id=event.assessment_id,
                        error_type="publishing_error",
                        error_message=f"Failed to publish {event.event_type} event",
                        error_details={"original_topic": topic, "error": str(e)},
                        user_id=event.user_id
                    )
                except:
                    pass  # Don't fail if error event publishing fails
            
            # Retry logic
            if retry_count < 2:
                await asyncio.sleep(2 ** retry_count)
                return await self._publish_event(topic, event, key, retry_count + 1)
            
            raise KafkaConnectionException(f"Failed to publish message after {retry_count + 1} attempts: {e}")
    
    async def publish_form_submission(self, submission: FormSubmissionRequest):
        """Publish form submission using shared event model"""
        # Get the appropriate topic for this domain
        topic = self.submission_topic_mapping.get(submission.domain.lower())
        if not topic:
            raise ValueError(f"Unknown domain: {submission.domain}. Valid domains: {list(self.submission_topic_mapping.keys())}")
        
        # Create event using shared model
        event = EventFactory.create_form_submission_event(submission)
        
        await self._publish_event(topic, event, key=submission.assessment_id)
    
    async def publish_assessment_status_update(self, progress: AssessmentProgress, previous_status: Optional[str] = None):
        """Publish assessment status updates using shared event model"""
        event = EventFactory.create_status_update_event(progress, previous_status)
        await self._publish_event(settings.assessment_status_topic, event, key=progress.assessment_id)
    
    async def _publish_error_event(self, assessment_id: str, error_type: str, error_message: str,
                                 error_details: Dict[str, Any] = None, user_id: Optional[str] = None,
                                 domain: Optional[str] = None):
        """Publish error events for monitoring and debugging"""
        try:
            event = EventFactory.create_error_event(
                assessment_id=assessment_id,
                error_type=error_type,
                error_message=error_message,
                error_details=error_details,
                user_id=user_id,
                domain=domain
            )
            
            # Use a separate error topic if available
            error_topic = getattr(settings, 'error_events_topic', settings.assessment_status_topic)
            await self._publish_event(error_topic, event, key=assessment_id)
            
        except Exception as e:
            # Don't create infinite loop - just log
            logger.error(f"Failed to publish error event: {e}")
            self.metrics.record_error("error_event_publish_failed")
    
    def _get_message_key(self, message_data: Dict[str, Any]) -> str:
        """Generate unique key for message deduplication"""
        assessment_id = message_data.get('assessment_id', 'unknown')
        domain = message_data.get('domain', 'unknown')
        timestamp = message_data.get('timestamp', '')
        return f"{assessment_id}:{domain}:{timestamp}"
    
    def _is_duplicate_message(self, message_key: str) -> bool:
        """Check if message is a duplicate using cache"""
        current_time = time.time()
        
        # Clean old entries (older than 5 minutes)
        cutoff_time = current_time - 300
        self._message_cache = {
            k: v for k, v in self._message_cache.items() 
            if v > cutoff_time
        }
        
        if message_key in self._message_cache:
            logger.debug(f"Duplicate message detected: {message_key}")
            return True
        
        self._message_cache[message_key] = current_time
        return False

    async def consume_score_updates(self):
        """Consumer loop for score updates with event-based processing"""
        logger.info("Starting score updates consumer loop")
        
        while self.running and not self._shutdown_event.is_set():
            try:
                # Poll with timeout
                msg_pack = await asyncio.wait_for(
                    self.consumer.getmany(timeout_ms=1000, max_records=10),
                    timeout=2.0
                )
                
                if not msg_pack:
                    continue
                
                # Process messages concurrently but limit concurrency
                tasks = []
                for topic_partition, messages in msg_pack.items():
                    for message in messages:
                        if len(tasks) >= 5:  # Limit concurrent processing
                            await asyncio.gather(*tasks, return_exceptions=True)
                            tasks = []
                        
                        task = asyncio.create_task(
                            self._process_single_message(topic_partition, message)
                        )
                        tasks.append(task)
                
                # Process remaining tasks
                if tasks:
                    await asyncio.gather(*tasks, return_exceptions=True)
                        
            except asyncio.TimeoutError:
                continue  # Normal timeout, continue polling
            except ConsumerStoppedError:
                logger.info("Consumer stopped, exiting loop")
                break
            except Exception as e:
                logger.error(f"Error in score consumer loop: {e}")
                self.metrics.record_error("consumer_loop_error")
                if self.running:
                    await asyncio.sleep(5)
    
    async def _process_single_message(self, topic_partition, message):
        """Process a single message with error handling and metrics"""
        start_time = time.time()
        
        try:
            # Check for duplicates
            message_key = self._get_message_key(message.value)
            if self._is_duplicate_message(message_key):
                await self.consumer.commit({topic_partition: message.offset + 1})
                return
            
            await self.process_score_message(message.topic, message.value)
            await self.consumer.commit({topic_partition: message.offset + 1})
            
            processing_time = time.time() - start_time
            self.metrics.record_consume(message.topic, processing_time)
            
        except Exception as e:
            logger.error(f"Error processing message from {message.topic}: {e}")
            self.metrics.record_error("message_processing_error")
            
            # Try to extract assessment_id for error reporting
            assessment_id = "unknown"
            try:
                if isinstance(message.value, dict):
                    assessment_id = message.value.get('assessment_id', 'unknown')
            except:
                pass
            
            await self._publish_error_event(
                assessment_id=assessment_id,
                error_type="message_processing_error",
                error_message=f"Failed to process message from {message.topic}",
                error_details={"error": str(e), "topic": message.topic}
            )

    async def process_score_message(self, topic: str, message_data: Dict[str, Any]):
        """Enhanced score processing with WebSocket notifications and custom weighting"""
        
        assessment_id = message_data.get('assessment_id')
        domain = message_data.get('domain')

        logger.info(f"[SCORE_DEBUG] Starting to process score for assessment {assessment_id}, domain {domain}")
        logger.info(f"[SCORE_DEBUG] WebSocket connections available: {len(connection_manager.assessment_connections.get(assessment_id, set()))}")
        
        if not assessment_id:
            logger.warning(f"Missing assessment_id in message from {topic}")
            return
        
        if not domain:
            logger.warning(f"Missing domain in message from {topic}")
            return
        
        # Check if already processing this assessment
        if assessment_id in self._processing_assessments:
            logger.debug(f"Assessment {assessment_id} already being processed, skipping")
            return
        
        self._processing_assessments.add(assessment_id)
        
        try:
            # Get score value
            score_value = message_data.get('score_value')
            if score_value is None:
                scores = message_data.get('scores', {})
                score_value = scores.get('overall_score', 0.0)
            
            if not isinstance(score_value, (int, float)):
                logger.warning(f"Invalid score value from {topic}: {score_value}")
                return
            
            # Get current assessment and convert to shared model
            db_assessment = self.db_manager.get_assessment(assessment_id)
            if not db_assessment:
                logger.warning(f"Assessment {assessment_id} not found in database")
                return
            
            progress = db_assessment.to_progress_model()
            previous_status = progress.status.value
            
            # Update domain scores using shared model
            progress.domain_scores[domain] = score_value
            progress.updated_at = datetime.utcnow()
            
            # Calculate overall score using custom weighting
            overall_score = self.weighting_service.calculate_overall_score(progress.domain_scores)
            
            # Check if assessment is complete
            is_complete = self.weighting_service.is_assessment_complete(progress.domain_scores)
            
            # Update progress based on completion
            if is_complete and overall_score is not None:
                progress.overall_score = overall_score
                progress.status = AssessmentStatus.COMPLETED
                progress.completed_at = datetime.utcnow()
            elif overall_score is not None:
                progress.overall_score = overall_score
                if progress.status != AssessmentStatus.PROCESSING:
                    progress.status = AssessmentStatus.PROCESSING
            elif progress.status != AssessmentStatus.PROCESSING:
                progress.status = AssessmentStatus.PROCESSING
            
            # Update database using shared model
            self.db_manager.update_assessment_from_progress(progress)
            
            # Send WebSocket updates
            await self._send_websocket_updates(
                assessment_id, domain, score_value, message_data, 
                overall_score, progress, is_complete
            )
            
            # Publish events
            await self._publish_domain_events(
                assessment_id, domain, score_value, message_data, 
                progress, previous_status, overall_score, is_complete
            )
            
            logger.info(
                f"Updated {domain} score ({score_value}) for assessment {assessment_id}. "
                f"Overall score: {overall_score}, Complete: {is_complete}"
            )
            
        except Exception as e:
            logger.error(f"Error processing score message from {topic}: {e}")
            
            # Send error notification to WebSocket
            await self._send_error_websocket_notification(assessment_id, domain, str(e))
            
            # Publish error event
            await self._publish_error_event(
                assessment_id=assessment_id,
                error_type="score_processing_error", 
                error_message=f"Failed to process score message from {topic}",
                error_details={"error": str(e), "topic": topic, "message_data": message_data},
                domain=domain
            )
            raise
        finally:
            self._processing_assessments.discard(assessment_id)
    
    async def _send_websocket_updates(self, assessment_id: str, domain: str, score_value: float,
                                    message_data: Dict, overall_score: Optional[float],
                                    progress: AssessmentProgress, is_complete: bool):
        """Send WebSocket updates for score changes with enhanced debugging"""
        try:
            # Log attempt to send WebSocket message
            logger.info(f"[WEBSOCKET_DEBUG] Preparing to send WebSocket update for assessment {assessment_id}")
            logger.info(f"[WEBSOCKET_DEBUG] Connection manager stats: {connection_manager.get_stats()}")
            
            # Send score update
            websocket_message = {
                "type": "score_update",
                "timestamp": datetime.utcnow().isoformat(),
                "assessment_id": assessment_id,
                "domain": domain,
                "score_value": score_value,
                "scores": message_data.get('scores', {}),
                "overall_score": overall_score,
                "completion_percentage": self.weighting_service.get_completion_percentage(progress.domain_scores),
                "status": progress.status.value,
                "domain_scores": progress.domain_scores
            }
            
            logger.info(f"[WEBSOCKET_DEBUG] Sending score update for assessment '{assessment_id}': "
                    f"domain='{domain}', score_value={score_value}, "
                    f"overall_score={overall_score}, "
                    f"completion_percentage={self.weighting_service.get_completion_percentage(progress.domain_scores):.2f}%, "
                    f"status='{progress.status.value}'")

            # Actually send the message
            await connection_manager.send_to_assessment(assessment_id, websocket_message)
            logger.info(f"[WEBSOCKET_DEBUG] Score update message sent successfully for assessment {assessment_id}")
            
            # If assessment is complete, send completion notification
            if is_complete:
                completion_message = {
                    "type": "assessment_completed",
                    "timestamp": datetime.utcnow().isoformat(),
                    "assessment_id": assessment_id,
                    "overall_score": overall_score,
                    "domain_scores": progress.domain_scores,
                    "status": "COMPLETED",
                    "completion_percentage": 100.0,
                    "final_weights_used": self.weighting_service.weights
                }
                
                logger.info(f"[WEBSOCKET_DEBUG] Sending completion message for assessment '{assessment_id}'")
                await connection_manager.send_to_assessment(assessment_id, completion_message)
                logger.info(f"[WEBSOCKET_DEBUG] Completion message sent successfully for assessment {assessment_id}")
                
        except Exception as e:
            logger.error(f"[WEBSOCKET_DEBUG] Error sending WebSocket updates for assessment {assessment_id}: {e}")
            logger.exception("Full WebSocket error traceback:")

    # Also add a debug endpoint to check WebSocket status
    async def debug_websocket_status(self, assessment_id: str) -> Dict[str, Any]:
        """Debug method to check WebSocket connection status"""
        stats = connection_manager.get_stats()
        
        return {
            "assessment_id": assessment_id,
            "has_connections": assessment_id in connection_manager.assessment_connections,
            "connection_count": len(connection_manager.assessment_connections.get(assessment_id, set())),
            "queued_messages": len(connection_manager.message_queue.get(assessment_id, [])),
            "total_active_connections": len(connection_manager.active_connections),
            "connection_manager_stats": stats,
            "currently_processing": assessment_id in self._processing_assessments
        }
    
    async def _send_error_websocket_notification(self, assessment_id: str, domain: str, error_message: str):
        """Send error notification via WebSocket"""
        try:
            error_notification = {
                "type": "error",
                "timestamp": datetime.utcnow().isoformat(),
                "assessment_id": assessment_id,
                "domain": domain,
                "error_message": error_message,
                "error_type": "processing_error"
            }
            
            await connection_manager.send_to_assessment(assessment_id, error_notification)
            logger.info(f"[WEBSOCKET_DEBUG] Error notification sent for assessment {assessment_id}")
            
        except Exception as e:
            logger.error(f"Failed to send error WebSocket notification: {e}")

    
    async def _publish_domain_events(self, assessment_id: str, domain: str, score_value: float,
                                   message_data: Dict, progress: AssessmentProgress,
                                   previous_status: str, overall_score: Optional[float],
                                   is_complete: bool):
        """Publish domain scoring and completion events"""
        try:
            # Publish domain scored event
            domain_scored_event = EventFactory.create_domain_scored_event(
                assessment_id=assessment_id,
                domain=domain,
                scores=message_data.get('scores', {}),
                score_value=score_value,
                user_id=progress.user_id,
                processing_time_ms=message_data.get('processing_time_ms')
            )
            await self._publish_event(settings.assessment_status_topic, domain_scored_event, key=assessment_id)
            
            # Publish status update if status changed
            if previous_status != progress.status.value:
                await self.publish_assessment_status_update(progress, previous_status)
            
            # If assessment is complete, publish completion event
            if is_complete:
                completed_event = EventFactory.create_assessment_completed_event(
                    progress=progress,
                    overall_score=overall_score,
                    domain_scores=progress.domain_scores,
                    final_results={"weighted_score": overall_score, "weights": self.weighting_service.weights}
                )
                await self._publish_event(settings.assessment_status_topic, completed_event, key=assessment_id)
                
        except Exception as e:
            logger.error(f"Error publishing domain events: {e}")
    
    async def health_check(self) -> bool:
        """Check Kafka service health"""
        try:
            return (
                self.producer is not None and 
                self.running and 
                not self._producer_circuit_open and
                self.consumer is not None
            )
        except Exception as e:
            logger.error(f"Kafka health check failed: {e}")
            return False
    
    async def get_service_metrics(self) -> Dict[str, Any]:
        """Get comprehensive service metrics for monitoring"""
        base_metrics = {
            "running": self.running,
            "producer_available": self.producer is not None,
            "consumer_available": self.consumer is not None,
            "producer_circuit_open": self._producer_circuit_open,
            "producer_failures": self._producer_failures,
            "configured_submission_topics": len(self.submission_topic_mapping),
            "configured_score_topics": len(self.score_topics),
            "processing_assessments_count": len(self._processing_assessments),
            "message_cache_size": len(self._message_cache),
            "health_check": await self.health_check()
        }
        
        # Add detailed metrics
        base_metrics.update(self.metrics.get_stats())
        
        return base_metrics
    

    async def test_websocket_send(self, assessment_id: str):
        """Test method to manually send a WebSocket message"""
        test_message = {
            "type": "test_message",
            "timestamp": datetime.utcnow().isoformat(),
            "assessment_id": assessment_id,
            "message": "This is a test message"
        }
        
        logger.info(f"[TEST] Sending test message to assessment {assessment_id}")
        await connection_manager.send_to_assessment(assessment_id, test_message)
        logger.info(f"[TEST] Test message sent")
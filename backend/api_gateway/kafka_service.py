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
        
        # Domain to topic mapping for form submissions - UPDATED to remove elca, slca, lcc
        self.submission_topic_mapping = {
            "resilience": settings.resilience_submission_topic,
            "sustainability": settings.sustainability_submission_topic,  
            "human_centricity": settings.human_centricity_submission_topic,
        }
        
        # Topics to consume score updates from - UPDATED to remove elca, slca, lcc
        self.score_topics = [
            settings.resilience_scores_topic,
            settings.sustainability_scores_topic, 
            settings.human_centricity_scores_topic,
            settings.final_results_topic,
        ]
        
        # Initialize weighting service with configurable alpha
        alpha = getattr(settings, 'weighting_alpha', 0.8)
        self.weighting_service = WeightingService(alpha=alpha, use_sfs_hesitation=True, pi_constant=0.1)
        
        # Weight update management - REMOVED cached assessments
        self.weight_update_interval = getattr(settings, 'weight_update_interval_hours', 24)
        self.last_weight_update = None
        
        # Database-based weight calculation settings
        self.weight_calculation_lookback_days = getattr(settings, 'weight_calculation_lookback_days', 30)
        self.max_assessments_for_weights = getattr(settings, 'max_assessments_for_weights', 1000)
        
        # Background task management
        self._weight_update_task = None
        
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
            
            # Start background weight update task
            self._weight_update_task = asyncio.create_task(self._periodic_weight_update())
            logger.info("Started periodic weight update task")
            
            # Perform initial weight update with database data
            await self._update_weights_from_database()
            
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
        
        # Stop background weight update task
        if self._weight_update_task:
            self._weight_update_task.cancel()
            try:
                await self._weight_update_task
            except asyncio.CancelledError:
                pass
            logger.info("Stopped periodic weight update task")
        
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

    async def _periodic_weight_update(self):
        """Background task to periodically update weights based on completed assessments"""
        logger.info(f"Starting periodic weight updates every {self.weight_update_interval} hours")
        
        while self.running and not self._shutdown_event.is_set():
            try:
                # Wait for the update interval or until shutdown
                await asyncio.wait_for(
                    self._shutdown_event.wait(), 
                    timeout=self.weight_update_interval * 3600  # Convert hours to seconds
                )
                break  # Shutdown event was set
                
            except asyncio.TimeoutError:
                # Normal timeout - time to update weights
                try:
                    await self._update_weights_from_database()
                except Exception as e:
                    logger.error(f"Error in periodic weight update: {e}")
                    self.metrics.record_error("periodic_weight_update_error")

    async def _update_weights_from_database(self):
        """Update weights using completed assessments from database"""
        try:
            logger.info("Updating weights from database...")
            
            # Calculate cutoff date for recent assessments
            cutoff_date = datetime.utcnow() - timedelta(days=self.weight_calculation_lookback_days)
            
            # Fetch completed assessments from database
            db_assessments = self.db_manager.get_completed_assessments_for_weighting(
                cutoff_date=cutoff_date,
                limit=self.max_assessments_for_weights
            )
            
            # Use weighting_service's min_assessments instead of self
            min_assessments_needed = self.weighting_service.min_assessments_for_objective
            
            if len(db_assessments) < min_assessments_needed:
                logger.info(f"Insufficient completed assessments in database ({len(db_assessments)}) for weight update. "
                          f"Need at least {min_assessments_needed}. "
                          f"Using lookback period of {self.weight_calculation_lookback_days} days.")
                return
            
            # Convert database assessments to weight calculation format
            assessment_data = []
            for assessment in db_assessments:
                if assessment.domain_scores and isinstance(assessment.domain_scores, dict):
                    # Ensure all required domains are present with valid scores
                    domain_scores = {}
                    for domain in ['resilience', 'sustainability', 'human_centricity']:
                        if (domain in assessment.domain_scores and 
                            assessment.domain_scores[domain] is not None and
                            isinstance(assessment.domain_scores[domain], (int, float))):
                            domain_scores[domain] = float(assessment.domain_scores[domain])
                    
                    # Only include if all domains are present
                    if len(domain_scores) == 3:
                        assessment_data.append(domain_scores)
            
            logger.info(f"Converted {len(assessment_data)} database assessments to weight calculation format")
            
            if len(assessment_data) < min_assessments_needed:
                logger.info(f"Insufficient valid assessment data ({len(assessment_data)}) for weight update after filtering.")
                return
            
            # Update weights using the collected data
            success = self.weighting_service.update_weights_from_data(assessment_data)
            
            if success:
                self.last_weight_update = datetime.utcnow()
                logger.info(f"Successfully updated weights using {len(assessment_data)} database assessments")
                logger.info(f"New weights: {self.weighting_service.weights}")
                logger.info(f"Weight type: {self.weighting_service.weights_type}")
                
                # Log database statistics
                try:
                    stats = self.db_manager.get_assessment_statistics()
                    logger.info(f"Database assessment statistics: {stats}")
                except Exception as e:
                    logger.warning(f"Could not retrieve database statistics: {e}")
            else:
                logger.warning("Failed to update weights from database data")
                
        except Exception as e:
            logger.error(f"Error updating weights from database: {e}")
            self.metrics.record_error("weight_update_error")
            

    async def _fetch_completed_assessments(self, cutoff_date: datetime) -> List[Dict[str, float]]:
        """
        Fetch completed assessments from database since cutoff_date
        
        Parameters:
        -----------
        cutoff_date : datetime
            Only fetch assessments completed after this date
            
        Returns:
        --------
        List[Dict[str, float]]
            List of assessment data with domain scores
        """
        try:
            # This would need to be implemented in the database manager
            # For now, we'll use a simple approach
            
            # Get completed assessments from cache first
            recent_assessments = [
                assessment for assessment in self.completed_assessments_cache
                if assessment.get('completed_at', datetime.min) >= cutoff_date
            ]
            
            # If we need more data, query the database
            # Note: This would require adding a method to DatabaseManager
            # For now, we'll work with cached data and suggest the database addition
            
            assessment_data = []
            for assessment in recent_assessments:
                domain_scores = assessment.get('domain_scores', {})
                
                # Only include assessments with all domain scores
                if all(domain in domain_scores and domain_scores[domain] is not None 
                       for domain in ['resilience', 'sustainability', 'human_centricity']):
                    assessment_data.append(domain_scores)
            
            logger.info(f"Retrieved {len(assessment_data)} complete assessments for weight calculation")
            return assessment_data
            
        except Exception as e:
            logger.error(f"Error fetching completed assessments: {e}")
            return []

    def _cache_completed_assessment(self, progress: AssessmentProgress):
        """Cache completed assessment for weight calculation"""
        if progress.status != AssessmentStatus.COMPLETED or not progress.domain_scores:
            return
        
        # Create assessment data entry
        assessment_entry = {
            'assessment_id': progress.assessment_id,
            'completed_at': progress.completed_at or datetime.utcnow(),
            'domain_scores': progress.domain_scores.copy(),
            'overall_score': progress.overall_score
        }
        
        # Add to cache
        self.completed_assessments_cache.append(assessment_entry)
        
        # Maintain cache size
        if len(self.completed_assessments_cache) > self.max_cache_size:
            # Remove oldest entries
            self.completed_assessments_cache = sorted(
                self.completed_assessments_cache, 
                key=lambda x: x['completed_at'], 
                reverse=True
            )[:self.max_cache_size]
        
        logger.debug(f"Cached completed assessment {progress.assessment_id} for weight calculation")

    async def _periodic_weight_update(self):
        """Background task to periodically update weights based on database assessments"""
        logger.info(f"Starting periodic weight updates every {self.weight_update_interval} hours")
        
        while self.running and not self._shutdown_event.is_set():
            try:
                # Wait for the update interval or until shutdown
                await asyncio.wait_for(
                    self._shutdown_event.wait(), 
                    timeout=self.weight_update_interval * 3600  # Convert hours to seconds
                )
                break  # Shutdown event was set
                
            except asyncio.TimeoutError:
                # Normal timeout - time to update weights
                try:
                    await self._update_weights_from_database()
                except Exception as e:
                    logger.error(f"Error in periodic weight update: {e}")
                    self.metrics.record_error("periodic_weight_update_error")

    async def _update_weights_from_database(self):
        """Update weights using completed assessments from database"""
        try:
            logger.info("Updating weights from database...")
            
            # Calculate cutoff date for recent assessments
            cutoff_date = datetime.utcnow() - timedelta(days=self.weight_calculation_lookback_days)
            
            # Fetch completed assessments from database
            db_assessments = self.db_manager.get_completed_assessments_for_weighting(
                cutoff_date=cutoff_date,
                limit=self.max_assessments_for_weights
            )
            
            logger.info(f"Retrieved {len(db_assessments)} complete assessments for weight calculation from database")
            
            # FIX: Use weighting_service's min_assessments instead of self
            min_assessments_needed = self.weighting_service.min_assessments_for_objective
            
            if len(db_assessments) < min_assessments_needed:
                logger.info(f"Insufficient completed assessments in database ({len(db_assessments)}) for weight update. "
                        f"Need at least {min_assessments_needed}. "
                        f"Using lookback period of {self.weight_calculation_lookback_days} days.")
                return
            
            # Convert database assessments to weight calculation format
            assessment_data = []
            for assessment in db_assessments:
                if assessment.domain_scores and isinstance(assessment.domain_scores, dict):
                    # Ensure all required domains are present with valid scores
                    domain_scores = {}
                    for domain in ['resilience', 'sustainability', 'human_centricity']:
                        if (domain in assessment.domain_scores and 
                            assessment.domain_scores[domain] is not None and
                            isinstance(assessment.domain_scores[domain], (int, float))):
                            domain_scores[domain] = float(assessment.domain_scores[domain])
                    
                    # Only include if all domains are present
                    if len(domain_scores) == 3:
                        assessment_data.append(domain_scores)
            
            logger.info(f"Converted {len(assessment_data)} database assessments to weight calculation format")
            
            if len(assessment_data) < min_assessments_needed:
                logger.info(f"Insufficient valid assessment data ({len(assessment_data)}) for weight update after filtering.")
                return
            
            # Update weights using the collected data
            success = self.weighting_service.update_weights_from_data(assessment_data)
            
            if success:
                self.last_weight_update = datetime.utcnow()
                logger.info(f"Successfully updated weights using {len(assessment_data)} database assessments")
                logger.info(f"New weights: {self.weighting_service.weights}")
                logger.info(f"Weight type: {self.weighting_service.weights_type}")
                
                # Log database statistics
                try:
                    stats = self.db_manager.get_assessment_statistics()
                    logger.info(f"Database assessment statistics: {stats}")
                except Exception as e:
                    logger.warning(f"Could not retrieve database statistics: {e}")
            else:
                logger.warning("Failed to update weights from database data")
                
        except Exception as e:
            logger.error(f"Error updating weights from database: {e}")
            self.metrics.record_error("weight_update_error")


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
        '''
        Publish form submission to scoring service (DIRECT - not transactional)
        
        This is intentionally direct (not using outbox) because:
        1. Scoring services are designed to be idempotent
        2. User can resubmit if it fails
        3. Not a critical business state change
        '''
        topic = self.submission_topic_mapping.get(submission.domain.lower())
        if not topic:
            raise ValueError(f"Unknown domain: {submission.domain}. Valid domains: {list(self.submission_topic_mapping.keys())}")
        
        # Create event using shared model
        event = EventFactory.create_form_submission_event(submission)
        
        await self._publish_event(topic, event, key=submission.assessment_id)
    
    async def publish_assessment_status_update(
        self, 
        progress: AssessmentProgress, 
        previous_status: Optional[str] = None
    ):
        '''
        Publish assessment status updates (DIRECT - not transactional)
        
        ⚠️  WARNING: This method publishes directly to Kafka without the outbox pattern.
        For transactional guarantees, use db_manager.update_assessment_with_outbox() instead.
        
        This method should only be used for:
        - Legacy compatibility
        - Non-critical notifications
        - Cases where outbox pattern is not needed
        '''
        event = EventFactory.create_status_update_event(progress, previous_status)
        await self._publish_event(
            settings.assessment_status_topic, 
            event, 
            key=progress.assessment_id
        )
    
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
        """Enhanced score processing with proper progress model updates"""
        
        assessment_id = message_data.get('assessment_id')
        domain = message_data.get('domain')

        logger.info(f"[SCORE_DEBUG] Starting to process score for assessment {assessment_id}, domain {domain}")
        
        if not assessment_id:
            logger.warning(f"Missing assessment_id in message from {topic}")
            return
        
        if not domain:
            logger.warning(f"Missing domain in message from {topic}")
            return
        
        # Check if already processing
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
            
            # FIX: Get current assessment and convert to shared model
            db_assessment = await self.db_manager.get_assessment(assessment_id)
            if not db_assessment:
                logger.warning(f"Assessment {assessment_id} not found in database")
                return
            
            progress = db_assessment.to_progress_model()
            previous_status = progress.status.value
            
            # Mark the domain as submitted/completed
            if domain.lower() == "resilience":
                progress.resilience_submitted = True
            elif domain.lower() == "sustainability":
                progress.sustainability_submitted = True
            elif domain.lower() == "human_centricity":
                progress.human_centricity_submitted = True
            
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
                
                logger.info(f"Assessment {assessment_id} completed with overall score {overall_score}")
                
                # Trigger weight update
                await self._check_and_trigger_weight_update()
                
            elif overall_score is not None:
                progress.overall_score = overall_score
                if progress.status != AssessmentStatus.PROCESSING:
                    progress.status = AssessmentStatus.PROCESSING
            elif progress.status != AssessmentStatus.PROCESSING:
                progress.status = AssessmentStatus.PROCESSING
            
            # FIX: Save to database WITH outbox events (transactional)
            # This ensures domain submission flags are persisted
            updated_assessment = await self.db_manager.update_assessment_with_outbox(
                progress=progress,
                domain=domain,
                score_value=score_value
            )

            if is_complete and overall_score is not None:
                # Warm cache for user's dashboard view
                try:
                    await self.db_manager.warm_assessment_cache(assessment_id)
                    # FIX: Also warm user's assessment list
                    if progress.user_id:
                        await self.db_manager.warm_user_assessments_cache(progress.user_id, limit=10)
                except Exception as e:
                    logger.warning(f"Cache warming failed (non-critical): {e}")
            
            # Send WebSocket updates
            await self._send_websocket_updates(
                assessment_id, domain, score_value, message_data, 
                overall_score, progress, is_complete
            )

            logger.info(
                f"Updated {domain} score ({score_value}) for assessment {assessment_id}. "
                f"Overall score: {overall_score}, Complete: {is_complete}"
            )
            
        except Exception as e:
            logger.error(f"Error processing score message from {topic}: {e}")
            await self._send_error_websocket_notification(assessment_id, domain, str(e))
            
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


    async def _check_and_trigger_weight_update(self):
        """Check if weight update is needed and trigger if necessary"""
        try:
            # Time-based trigger: update if it's been long enough
            if self.last_weight_update is None:
                logger.info("Triggering initial weight update from database")
                await self._update_weights_from_database()
                return
            
            time_since_last_update = datetime.utcnow() - self.last_weight_update
            if time_since_last_update.total_seconds() >= (self.weight_update_interval * 3600):
                logger.info(f"Triggering scheduled weight update (last update: {time_since_last_update})")
                await self._update_weights_from_database()
                return
            
            # Completion-based trigger: check if we have significant new data
            # This is optional - you could add logic here to check if there are enough new
            # completed assessments since the last update to warrant recalculating weights
            
        except Exception as e:
            logger.error(f"Error in weight update trigger check: {e}")
    
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
                "domain_scores": progress.domain_scores,
                "weights_used": self.weighting_service.weights,
                "weights_type": self.weighting_service.weights_type,
                "data_source": "database"
            }
            
            logger.info(f"[WEBSOCKET_DEBUG] Sending score update for assessment '{assessment_id}': "
                    f"domain='{domain}', score_value={score_value}, "
                    f"overall_score={overall_score}, "
                    f"completion_percentage={self.weighting_service.get_completion_percentage(progress.domain_scores):.2f}%, "
                    f"status='{progress.status.value}', weights_type='{self.weighting_service.weights_type}'")

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
                    "final_weights_used": self.weighting_service.weights,
                    "weights_info": self.weighting_service.get_weights_info(),
                    "data_source": "database"
                }
                
                logger.info(f"[WEBSOCKET_DEBUG] Sending completion message for assessment '{assessment_id}'")
                await connection_manager.send_to_assessment(assessment_id, completion_message)
                logger.info(f"[WEBSOCKET_DEBUG] Completion message sent successfully for assessment {assessment_id}")
                
        except Exception as e:
            logger.error(f"[WEBSOCKET_DEBUG] Error sending WebSocket updates for assessment {assessment_id}: {e}")
            logger.exception("Full WebSocket error traceback:")


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

    
    # API methods for manual weight management
    async def update_weighting_alpha(self, alpha: float) -> bool:
        """Update the compromise parameter alpha"""
        success = self.weighting_service.set_alpha(alpha)
        if success:
            logger.info(f"Updated weighting alpha to {alpha}")
            # Trigger immediate weight recalculation
            await self._update_weights_from_database()
        return success
    
    async def get_weighting_info(self) -> Dict[str, Any]:
        """Get comprehensive weighting information including database statistics"""
        weights_info = self.weighting_service.get_weights_info()
        
        # Add database-based information
        try:
            db_stats = self.db_manager.get_assessment_statistics()
            weights_info.update({
                "last_weight_update": self.last_weight_update.isoformat() if self.last_weight_update else None,
                "weight_update_interval_hours": self.weight_update_interval,
                "lookback_days_for_weights": self.weight_calculation_lookback_days,
                "max_assessments_for_weights": self.max_assessments_for_weights,
                "database_stats": db_stats,
                "data_source": "database"  # Indicate we're using database now
            })
        except Exception as e:
            logger.error(f"Error getting database statistics: {e}")
            weights_info.update({
                "database_stats": {"error": str(e)},
                "data_source": "database_error"
            })
        
        return weights_info

    async def force_weight_update(self) -> Dict[str, Any]:
        """Force an immediate weight update from database"""
        try:
            await self._update_weights_from_database()
            return {
                "success": True,
                "message": "Weight update completed from database",
                "weights_info": await self.get_weighting_info()
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Weight update failed: {e}",
                "weights_info": await self.get_weighting_info()
            }
        
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
            "health_check": await self.health_check(),
            "weighting_info": await self.get_weighting_info(),
            "data_source": "database"  # Indicate using database
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
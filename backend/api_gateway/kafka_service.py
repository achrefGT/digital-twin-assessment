import asyncio
from datetime import datetime
from typing import Dict, Any, Optional, Union
import logging
from aiokafka.errors import KafkaError, KafkaConnectionError
from pydantic import ValidationError
import backoff
import json

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


logger = logging.getLogger(__name__)


class KafkaService:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.producer = None
        self.consumer = None
        self.running = False
        self._producer_lock = asyncio.Lock()
        
        # Domain to topic mapping for form submissions
        self.submission_topic_mapping = {
            "resilience": settings.resilience_submission_topic,
            "elca": settings.elca_submission_topic,
            "lcc": settings.lcc_submission_topic,
            "slca": settings.slca_submission_topic,
            "human_centricity": settings.human_centricity_submission_topic,
        }
        
        # Topics to consume score updates from
        self.score_topics = [
            settings.resilience_scores_topic,
            settings.elca_scores_topic, 
            settings.lcc_scores_topic,
            settings.slca_scores_topic,
            settings.human_centricity_scores_topic,
            settings.final_results_topic,
        ]
        
    @backoff.on_exception(
        backoff.expo,
        (KafkaConnectionError, KafkaError),
        max_tries=3,
        max_time=30
    )
    async def start(self):
        """Start Kafka producer and consumer using shared utilities"""
        try:
            # Use shared producer creation
            self.producer = await create_kafka_producer()
            
            # Use shared consumer creation
            self.consumer = await create_kafka_consumer(
                topics=self.score_topics,
                group_id=settings.kafka_consumer_group_id,
                auto_offset_reset='latest'
            )
            
            self.running = True
            logger.info("Kafka service started successfully using shared utilities")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka service: {e}")
            await self.stop()
            raise KafkaConnectionException(f"Failed to start Kafka service: {e}")
    
    async def stop(self):
        """Stop Kafka producer and consumer gracefully"""
        self.running = False
        
        if self.consumer:
            try:
                await self.consumer.stop()
            except Exception as e:
                logger.error(f"Error stopping consumer: {e}")
        
        if self.producer:
            try:
                await self.producer.stop()
            except Exception as e:
                logger.error(f"Error stopping producer: {e}")
        
        logger.info("Kafka service stopped")

    async def _publish_event(self, topic: str, event: BaseEvent, key: Optional[str] = None):
        """Generic method to publish events using shared models"""
        if not self.producer or not self.running:
            raise KafkaConnectionException("Kafka producer not available")
        
        try:
            # Use event's dict method for consistent serialization
            message = event.dict()
            
            async with self._producer_lock:
                await self.producer.send(
                    topic,
                    value=message,
                    key=key.encode('utf-8') if key else None
                )
                await self.producer.flush()
            
            logger.info(f"Published {event.event_type} event for assessment {event.assessment_id} to topic {topic}")
            
        except Exception as e:
            logger.error(f"Error publishing event to {topic}: {e}")
            # Publish error event if not already an error event
            if event.event_type != EventType.ERROR_OCCURRED:
                await self._publish_error_event(
                    assessment_id=event.assessment_id,
                    error_type="publishing_error",
                    error_message=f"Failed to publish {event.event_type} event",
                    error_details={"original_topic": topic, "error": str(e)},
                    user_id=event.user_id
                )
            raise KafkaConnectionException(f"Failed to publish message: {e}")
    
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
    
    async def consume_score_updates(self):
        """Consumer loop for score updates with event-based processing"""
        while self.running:
            try:
                # Poll with timeout
                msg_pack = await self.consumer.getmany(timeout_ms=1000, max_records=10)
                
                for topic_partition, messages in msg_pack.items():
                    for message in messages:
                        try:
                            await self.process_score_message(message.topic, message.value)
                            await self.consumer.commit({topic_partition: message.offset + 1})
                            
                        except Exception as e:
                            logger.error(f"Error processing message from {message.topic}: {e}")
                            
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
                            continue
                            
            except Exception as e:
                logger.error(f"Error in score consumer loop: {e}")
                if self.running:
                    await asyncio.sleep(5)
    
    async def process_score_message(self, topic: str, message_data: Dict[str, Any]):
        """Process incoming score messages with validation and event publishing"""
        try:
            # Basic validation
            assessment_id = message_data.get('assessment_id')
            domain = message_data.get('domain')
            
            if not assessment_id:
                logger.warning(f"Missing assessment_id in message from {topic}")
                return
            
            if not domain:
                logger.warning(f"Missing domain in message from {topic}")
                return
            
            # Get score value directly from message_data (not from a nested 'data' field)
            score_value = message_data.get('score_value')
            
            # If score_value doesn't exist, try to get it from scores.overall_score
            if score_value is None:
                scores = message_data.get('scores', {})
                score_value = scores.get('overall_score', 0.0)
            
            if not isinstance(score_value, (int, float)):
                logger.warning(f"Invalid score value from {topic}: {score_value}")
                return
            
            # Use the entire scores object as score_data for the event
            score_data = message_data.get('scores', {})
            
            # Get current assessment and convert to shared model
            db_assessment = self.db_manager.get_assessment(assessment_id)
            progress = db_assessment.to_progress_model()
            previous_status = progress.status.value
            
            # Update domain scores using shared model
            progress.domain_scores[domain] = score_value
            
            # Publish domain scored event
            domain_scored_event = EventFactory.create_domain_scored_event(
                assessment_id=assessment_id,
                domain=domain,
                scores=score_data,
                score_value=score_value,
                user_id=progress.user_id,
                processing_time_ms=message_data.get('processing_time_ms')
            )
            
            # Check if this is a final result and update overall score
            if topic == settings.final_results_topic:
                overall_score = score_data.get('overall_score', score_value)
                progress.overall_score = overall_score
                progress.status = AssessmentStatus.COMPLETED
                progress.completed_at = datetime.utcnow()
                
                # Publish assessment completed event
                completed_event = EventFactory.create_assessment_completed_event(
                    progress=progress,
                    overall_score=overall_score,
                    domain_scores=progress.domain_scores,
                    final_results=score_data
                )
                
                await self._publish_event(settings.assessment_status_topic, completed_event, key=assessment_id)
                
            elif progress.status != AssessmentStatus.PROCESSING:
                # Mark as processing if receiving individual domain scores
                progress.status = AssessmentStatus.PROCESSING
            
            progress.updated_at = datetime.utcnow()
            
            # Update database using shared model
            self.db_manager.update_assessment_from_progress(progress)
            
            # Publish status update if status changed
            if previous_status != progress.status.value:
                await self.publish_assessment_status_update(progress, previous_status)
            
            # Publish domain scored event
            await self._publish_event(settings.assessment_status_topic, domain_scored_event, key=assessment_id)
            
            logger.info(f"Updated {domain} score ({score_value}) for assessment {assessment_id}")
            
        except Exception as e:
            logger.error(f"Error processing score message from {topic}: {e}")
            
            # Publish error event
            await self._publish_error_event(
                assessment_id=message_data.get('assessment_id', 'unknown'),
                error_type="score_processing_error",
                error_message=f"Failed to process score message from {topic}",
                error_details={"error": str(e), "topic": topic, "message_data": message_data},
                domain=message_data.get('domain')
            )
            raise

    async def process_incoming_event(self, topic: str, message_data: Dict[str, Any]) -> Optional[BaseEvent]:
        """Process incoming events with proper deserialization"""
        try:
            event_type = message_data.get('event_type')
            
            if not event_type:
                logger.warning(f"Missing event_type in message from {topic}")
                return None
            
            # Deserialize based on event type
            if event_type == EventType.FORM_SUBMITTED:
                return FormSubmissionEvent.parse_obj(message_data)
            elif event_type == EventType.DOMAIN_SCORED:
                return DomainScoredEvent.parse_obj(message_data)
            elif event_type == EventType.ASSESSMENT_COMPLETED:
                return AssessmentCompletedEvent.parse_obj(message_data)
            elif event_type == EventType.ASSESSMENT_STATUS_UPDATED:
                return AssessmentStatusUpdatedEvent.parse_obj(message_data)
            elif event_type == EventType.ERROR_OCCURRED:
                return ErrorEvent.parse_obj(message_data)
            else:
                logger.warning(f"Unknown event type: {event_type}")
                return None
                
        except ValidationError as e:
            logger.error(f"Invalid event format from {topic}: {e}")
            return None
        except Exception as e:
            logger.error(f"Error deserializing event from {topic}: {e}")
            return None
    
    async def health_check(self) -> bool:
        """Check Kafka service health"""
        try:
            # Simple but effective: if producer exists and service is running,
            # consider it healthy. Producer creation fails at startup if Kafka is unavailable.
            # For more detailed health checking, monitor actual message sending/consuming.
            return self.producer is not None and self.running
            
        except Exception as e:
            logger.error(f"Kafka health check failed: {e}")
            return False
    
    async def get_service_metrics(self) -> Dict[str, Any]:
        """Get service metrics for monitoring"""
        return {
            "running": self.running,
            "producer_available": self.producer is not None,
            "consumer_available": self.consumer is not None,
            "configured_submission_topics": len(self.submission_topic_mapping),
            "configured_score_topics": len(self.score_topics),
            "health_check": await self.health_check()
        }
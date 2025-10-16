"""
Recommendation Service Kafka Handler
Handles Kafka message consumption and production for recommendation generation
"""

import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
import logging
import uuid

from shared.kafka_utils import create_kafka_consumer, create_kafka_producer, KafkaConfig
from shared.models.events import (
    EventFactory, EventType, RecommendationRequestEvent,
    RecommendationCompletedEvent, ErrorEvent
)
from shared.models.exceptions import (
    KafkaConnectionException, ScoringException
)

from .ai_engine import AIRecommendationEngine
from .database import RecommendationDatabaseManager, RecommendationStatus
from .config import get_config

logger = logging.getLogger(__name__)


class RecommendationKafkaHandler:
    """Handles Kafka operations for recommendation service"""
    
    def __init__(
        self, 
        db_manager: RecommendationDatabaseManager,
        ai_engine: AIRecommendationEngine
    ):
        self.db_manager = db_manager
        self.ai_engine = ai_engine
        self.consumer = None
        self.producer = None
        self.running = False
        self.config = get_config()
        
    async def start(self):
        """Start Kafka consumer and producer"""
        try:
            # Initialize consumer for recommendation requests
            self.consumer = await create_kafka_consumer(
                topics=[KafkaConfig.RECOMMENDATION_REQUEST_TOPIC],
                group_id="recommendation-service",
                auto_offset_reset="latest"
            )
            
            # Initialize producer for results and errors
            self.producer = await create_kafka_producer()
            
            self.running = True
            logger.info("✅ Kafka handler started successfully")
            
        except Exception as e:
            logger.error(f"❌ Failed to start Kafka handler: {e}")
            raise KafkaConnectionException(f"Failed to connect to Kafka: {e}")
    
    async def stop(self):
        """Stop Kafka consumer and producer"""
        self.running = False
        
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logger.info("✅ Kafka handler stopped successfully")
        except Exception as e:
            logger.error(f"❌ Error stopping Kafka handler: {e}")
    
    def is_running(self) -> bool:
        """Check if Kafka handler is running"""
        return self.running
    
    async def consume_messages(self):
        """Main consumer loop - processes recommendation requests"""
        logger.info("🚀 Starting Kafka message consumer loop")
        print("DEBUG: 🚀 Starting recommendation request consumer loop")
        
        while self.running:
            try:
                print(f"DEBUG: Consumer loop iteration - running: {self.running}")
                async for message in self.consumer:
                    logger.debug(f"Received message: {message}")
                    print(f"DEBUG: 📨 Received Kafka message - topic: {message.topic}, partition: {message.partition}, offset: {message.offset}")
                    print(f"DEBUG: Message value type: {type(message.value)}")
                    await self._process_message(message.value)
                    
            except Exception as e:
                logger.error(f"❌ Error in consumer loop: {e}")
                print(f"DEBUG: ❌ Error in consumer loop: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                if self.running:  # Only retry if we're still supposed to be running
                    print("DEBUG: Waiting 5 seconds before retrying...")
                    await asyncio.sleep(5)  # Wait before retrying
    
    async def _process_message(self, message_data: Dict[str, Any]):
        """Process incoming recommendation request message"""
        assessment_id = None
        
        try:
            # Debug: Print the entire message structure
            logger.debug(f"Raw message data received: {message_data}")
            print(f"DEBUG: Raw message keys: {list(message_data.keys()) if message_data else 'None'}")
            print(f"DEBUG: Message event_type: {message_data.get('event_type', 'Missing')}")
            
            # Parse the incoming event
            if message_data.get('event_type') != EventType.RECOMMENDATION_REQUESTED:
                logger.debug(f"Ignoring message with event_type: {message_data.get('event_type')}")
                print(f"DEBUG: Ignoring event_type: {message_data.get('event_type')}, expected: {EventType.RECOMMENDATION_REQUESTED}")
                return
            
            # Create RecommendationRequestEvent
            logger.debug("Creating RecommendationRequestEvent from message data")
            print(f"DEBUG: About to create RecommendationRequestEvent")
            
            try:
                request_event = RecommendationRequestEvent(**message_data)
                logger.debug(f"Successfully created RecommendationRequestEvent: {request_event}")
                print(f"DEBUG: Created request_event - assessment_id: {request_event.assessment_id}")
            except Exception as e:
                logger.error(f"Failed to create RecommendationRequestEvent: {e}")
                print(f"DEBUG: RecommendationRequestEvent creation failed: {e}")
                print(f"DEBUG: Message data that failed: {message_data}")
                raise
            
            assessment_id = request_event.assessment_id
            logger.info(f"Processing recommendation request for assessment {assessment_id}")
            print(f"DEBUG: Processing assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Generate AI recommendations
            logger.debug("Generating AI recommendations")
            print(f"DEBUG: About to generate AI recommendations for assessment {assessment_id}")
            
            recommendations = await self.ai_engine.generate_recommendations(
                assessment_data=request_event.dict(),
                custom_criteria=request_event.custom_criteria
            )
            
            logger.debug(f"Generated {len(recommendations)} recommendations")
            print(f"DEBUG: Generated {len(recommendations)} recommendations")
            
            # Calculate processing time
            generation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"Generation time: {generation_time}ms")
            print(f"DEBUG: Generation time: {generation_time}ms")
            
            # Save to database
            recommendation_set_id = str(uuid.uuid4())
            logger.debug(f"Saving recommendations to database with ID: {recommendation_set_id}")
            print(f"DEBUG: Saving to database with set_id: {recommendation_set_id}")
            
            await self._save_recommendations_to_db(
                recommendation_set_id=recommendation_set_id,
                request_event=request_event,
                recommendations=recommendations,
                generation_time_ms=generation_time
            )
            
            logger.debug("Successfully saved to database")
            print(f"DEBUG: Successfully saved recommendation set {recommendation_set_id} to database")
            
            # Publish success event
            logger.debug("Publishing recommendation completed event")
            print(f"DEBUG: Publishing success event for assessment {assessment_id}")
            
            await self._publish_recommendation_completed_event(
                request_event=request_event,
                recommendations=recommendations,
                generation_time_ms=generation_time,
                recommendation_set_id=recommendation_set_id
            )
            
            logger.info(
                f"✅ Successfully processed recommendation request for {assessment_id} "
                f"in {generation_time:.2f}ms - {len(recommendations)} recommendations"
            )
            print(f"DEBUG: ✅ COMPLETE - Successfully processed assessment {assessment_id}")
            
        except Exception as e:
            logger.error(f"❌ Unexpected error processing recommendation request for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ Unexpected error for {assessment_id}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            await self._publish_error_event(assessment_id, "recommendation_generation_failed", str(e))
    
    async def _save_recommendations_to_db(
        self,
        recommendation_set_id: str,
        request_event: RecommendationRequestEvent,
        recommendations: list,
        generation_time_ms: float
    ):
        """Save recommendations to database"""
        try:
            # Prepare recommendation set data
            set_data = {
                'recommendation_set_id': recommendation_set_id,
                'assessment_id': request_event.assessment_id,
                'user_id': request_event.user_id,
                'source': 'ai',
                'model_used': self.ai_engine.current_model if hasattr(self.ai_engine, 'current_model') else None,
                'generation_time_ms': generation_time_ms,
                'overall_score': request_event.overall_score,
                'domain_scores': request_event.domain_scores,
                'detailed_metrics': request_event.detailed_metrics,
                'generated_at': datetime.utcnow()
            }
            
            # Prepare individual recommendations
            rec_list = []
            for rec in recommendations:
                rec_dict = rec.dict() if hasattr(rec, 'dict') else rec
                rec_dict['recommendation_id'] = str(uuid.uuid4())
                
                # Check if this is for a custom criterion
                criterion_id = rec_dict.get('criterion_id', '')
                if criterion_id and ('_CUSTOM' in criterion_id or 
                                    (request_event.custom_criteria and 
                                     any(cc.criterion_id == criterion_id for cc in request_event.custom_criteria))):
                    rec_dict['is_custom_criterion'] = True
                    # Find and attach custom criterion details
                    if request_event.custom_criteria:
                        for cc in request_event.custom_criteria:
                            if cc.criterion_id == criterion_id:
                                rec_dict['custom_criterion_details'] = cc.dict()
                                break
                
                rec_list.append(rec_dict)
            
            # Save to database
            self.db_manager.save_recommendation_set(set_data, rec_list)
            logger.info(f"💾 Saved {len(rec_list)} recommendations to database")
            
        except Exception as e:
            logger.error(f"Failed to save recommendations to database: {e}")
            print(f"DEBUG: ❌ Database save failed: {e}")
            # Continue even if database save fails
    
    async def _publish_recommendation_completed_event(
        self,
        request_event: RecommendationRequestEvent,
        recommendations: list,
        generation_time_ms: float,
        recommendation_set_id: str
    ):
        """Publish recommendation completed event"""
        try:
            logger.debug(f"Publishing recommendation completed event for {request_event.assessment_id}")
            print(f"DEBUG: _publish_recommendation_completed_event called for {request_event.assessment_id}")
            
            completed_event = EventFactory.create_recommendation_completed_event(
                assessment_id=request_event.assessment_id,
                user_id=request_event.user_id,
                recommendations=recommendations,
                source="ai",
                generation_time_ms=generation_time_ms,
                model_used=self.ai_engine.current_model if hasattr(self.ai_engine, 'current_model') else None
            )
            
            # Add database reference to event metadata
            event_dict = completed_event.dict()
            event_dict['recommendation_set_id'] = recommendation_set_id
            
            logger.debug(f"Created event: {event_dict}")
            print(f"DEBUG: Created recommendation completed event with {len(recommendations)} recommendations")
            
            await self.producer.send(
                KafkaConfig.RECOMMENDATION_COMPLETED_TOPIC,
                event_dict,
                key=request_event.assessment_id.encode('utf-8')
            )
            
            logger.info(f"📤 Published recommendation completed event to {KafkaConfig.RECOMMENDATION_COMPLETED_TOPIC}")
            print(f"DEBUG: ✅ Successfully published recommendation completed event")
            
        except Exception as e:
            logger.error(f"Failed to publish recommendation completed event: {e}")
            print(f"DEBUG: ❌ Failed to publish completed event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _publish_error_event(
        self, 
        assessment_id: Optional[str], 
        error_type: str, 
        error_message: str
    ):
        """Publish error event"""
        try:
            logger.debug(f"Publishing error event for {assessment_id}: {error_type}")
            print(f"DEBUG: _publish_error_event called - assessment_id: {assessment_id}, error_type: {error_type}")
            
            event = EventFactory.create_error_event(
                assessment_id=assessment_id or "unknown",
                error_type=error_type,
                error_message=error_message,
                domain="recommendation"
            )
            
            logger.debug(f"Created error event: {event}")
            print(f"DEBUG: Created error event: {event.dict()}")
            
            await self.producer.send(
                KafkaConfig.ERROR_EVENTS_TOPIC,
                event.dict()
            )
            
            logger.info(f"📤 Published error event for assessment {assessment_id}: {error_type}")
            print(f"DEBUG: ✅ Successfully published error event to {KafkaConfig.ERROR_EVENTS_TOPIC}")
            
        except Exception as e:
            logger.error(f"Failed to publish error event: {e}")
            print(f"DEBUG: ❌ Failed to publish error event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
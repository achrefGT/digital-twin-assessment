import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
import logging

from shared.kafka_utils import create_kafka_consumer, create_kafka_producer
from shared.models.events import (
    EventFactory, EventType, FormSubmissionEvent, 
    DomainScoredEvent, ErrorEvent
)
from shared.models.exceptions import (
    KafkaConnectionException, InvalidFormDataException, 
    ScoringException, DatabaseConnectionException
)
from .models import SLCAInput, SLCAResult, SocialIndicators, StakeholderGroup
from .score import calculate_slca_score
from .database import DatabaseManager
from .config import settings

logger = logging.getLogger(__name__)


class SLCAKafkaHandler:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.consumer = None
        self.producer = None
        self.running = False
        
    async def start(self):
        """Start Kafka consumer and producer"""
        try:
            # Initialize consumer for form submissions
            self.consumer = await create_kafka_consumer(
                topics=[settings.slca_submission_topic],
                group_id=settings.kafka_consumer_group_id,
                auto_offset_reset=settings.kafka_auto_offset_reset
            )
            
            # Initialize producer for results
            self.producer = await create_kafka_producer()
            
            self.running = True
            logger.info("S-LCA Kafka handler started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start S-LCA Kafka handler: {e}")
            raise KafkaConnectionException(f"Failed to connect to Kafka: {e}")
    
    async def stop(self):
        """Stop Kafka consumer and producer"""
        self.running = False
        
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logger.info("S-LCA Kafka handler stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping S-LCA Kafka handler: {e}")
    
    def is_running(self) -> bool:
        """Check if Kafka handler is running"""
        return self.running
    
    async def consume_messages(self):
        """Main consumer loop"""
        logger.info("Starting S-LCA Kafka message consumer")
        print("DEBUG: 🚀 Starting S-LCA Kafka message consumer loop")
        
        while self.running:
            try:
                print(f"DEBUG: S-LCA Consumer loop iteration - running: {self.running}")
                async for message in self.consumer:
                    logger.debug(f"Received S-LCA message: {message}")
                    print(f"DEBUG: 📨 Received S-LCA Kafka message - topic: {message.topic}, partition: {message.partition}, offset: {message.offset}")
                    print(f"DEBUG: Message value type: {type(message.value)}")
                    await self._process_message(message.value)
            except Exception as e:
                logger.error(f"Error in S-LCA consumer loop: {e}")
                print(f"DEBUG: ❌ Error in S-LCA consumer loop: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                if self.running:  # Only retry if we're still supposed to be running
                    print("DEBUG: Waiting 5 seconds before retrying...")
                    await asyncio.sleep(5)  # Wait before retrying
    
    async def _process_message(self, message_data: Dict[str, Any]):
        """Process incoming form submission message"""
        assessment_id = None
        
        try:
            # Debug: Print the entire message structure
            logger.debug(f"Raw S-LCA message data received: {message_data}")
            print(f"DEBUG: Raw S-LCA message keys: {list(message_data.keys()) if message_data else 'None'}")
            print(f"DEBUG: Message event_type: {message_data.get('event_type', 'Missing')}")
            
            # Parse the incoming event
            if message_data.get('event_type') != EventType.FORM_SUBMITTED:
                logger.debug(f"Ignoring message with event_type: {message_data.get('event_type')}")
                return
            
            # Extract submission data and ensure it's properly structured
            submission_data = message_data.get('submission', {})
            logger.debug(f"Extracted S-LCA submission data: {submission_data}")
            print(f"DEBUG: S-LCA Submission data keys: {list(submission_data.keys()) if submission_data else 'None'}")
            print(f"DEBUG: S-LCA Submission data type: {type(submission_data)}")
            
            if not submission_data:
                logger.warning("No S-LCA submission data found in message")
                print("DEBUG: No S-LCA submission data - returning early")
                return
            
            # Create FormSubmissionRequest from the submission data
            from shared.models.assessment import FormSubmissionRequest
            logger.debug("Creating FormSubmissionRequest from S-LCA submission data")
            print(f"DEBUG: About to create FormSubmissionRequest with S-LCA data: {submission_data}")
            
            try:
                form_submission = FormSubmissionRequest(**submission_data)
                logger.debug(f"Successfully created S-LCA FormSubmissionRequest: {form_submission}")
                print(f"DEBUG: Created S-LCA form_submission - domain: {form_submission.domain}")
                print(f"DEBUG: Created S-LCA form_submission - assessment_id: {form_submission.assessment_id}")
            except Exception as e:
                logger.error(f"Failed to create S-LCA FormSubmissionRequest: {e}")
                print(f"DEBUG: S-LCA FormSubmissionRequest creation failed: {e}")
                print(f"DEBUG: S-LCA Submission data that failed: {submission_data}")
                raise
            
            # Check if this message contains S-LCA data
            if form_submission.domain != 'slca':
                logger.debug(f"Ignoring message for domain: {form_submission.domain}")
                print(f"DEBUG: Wrong domain '{form_submission.domain}', expected 'slca'")
                return
                
            assessment_id = form_submission.assessment_id
            logger.info(f"Processing S-LCA form submission for assessment {assessment_id}")
            print(f"DEBUG: Processing S-LCA assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Parse S-LCA input
            logger.debug("Parsing S-LCA input")
            print(f"DEBUG: About to parse S-LCA input for assessment {assessment_id}")
            slca_input = self._parse_slca_input(form_submission)
            
            # Calculate S-LCA scores
            logger.debug("Calculating S-LCA scores")
            print(f"DEBUG: About to calculate S-LCA scores for assessment {assessment_id}")
            scores = calculate_slca_score(slca_input)
            logger.debug(f"Calculated S-LCA scores: {scores}")
            print(f"DEBUG: Calculated S-LCA scores keys: {list(scores.keys()) if scores else 'None'}")
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"S-LCA Processing time: {processing_time}ms")
            print(f"DEBUG: S-LCA Processing time: {processing_time}ms")
            
            # Create result
            logger.debug("Creating SLCAResult")
            print(f"DEBUG: Creating S-LCA result for assessment {slca_input.analysisId}")
            result = SLCAResult(
                analysisId=slca_input.analysisId,
                annual_scores=scores['annual_scores'],
                overall_score=scores['overall_score'],
                social_sustainability_rating=scores['social_sustainability_rating'],
                stakeholder_impact_score=scores['stakeholder_impact_score'],
                social_performance_trend=scores['social_performance_trend'],
                key_metrics=scores['key_metrics'],
                recommendations=scores['recommendations'],
                stakeholder_group=scores['stakeholder_group'],
                timestamp=datetime.utcnow(),
                processingTimeMs=processing_time
            )
            logger.debug(f"Created S-LCA result: {result}")
            print(f"DEBUG: S-LCA Result overall score: {result.overall_score}")
            
            # Save to database
            logger.debug("Preparing to save S-LCA assessment to database")
            print(f"DEBUG: Saving S-LCA assessment {slca_input.analysisId} to database")
            
            assessment_data = {
                "assessment_id": slca_input.analysisId,
                "user_id": slca_input.userId,
                "system_name": slca_input.systemName,
                "overall_score": result.overall_score,
                "annual_scores": result.annual_scores,
                "stakeholder_group": result.stakeholder_group,
                "social_sustainability_rating": result.social_sustainability_rating,
                "stakeholder_impact_score": result.stakeholder_impact_score,
                "social_performance_trend": result.social_performance_trend,
                "key_metrics": result.key_metrics,
                "recommendations": result.recommendations,
                "detailed_metrics": scores.get('detailed_metrics', {}),
                "raw_inputs": slca_input,  # Database will handle JSON serialization
                "metadata": slca_input.metadata,  # Database will handle JSON serialization
                "submitted_at": slca_input.submittedAt
            }
            logger.debug(f"S-LCA Assessment data prepared: {assessment_data}")
            print(f"DEBUG: S-LCA Assessment data keys: {list(assessment_data.keys())}")
            print(f"DEBUG: S-LCA Database will handle JSON serialization of Pydantic models")
            
            self.db_manager.save_assessment(assessment_data)
            logger.debug("Successfully saved S-LCA assessment to database")
            print(f"DEBUG: Successfully saved S-LCA assessment {assessment_id} to database")
            
            # Publish success event
            logger.debug("Publishing S-LCA domain scored event")
            print(f"DEBUG: Publishing S-LCA success event for assessment {assessment_id}")
            await self._publish_domain_scored_event(result)
            
            logger.info(f"Successfully processed S-LCA assessment {assessment_id} in {processing_time:.2f}ms")
            print(f"DEBUG: ✅ COMPLETE - Successfully processed S-LCA assessment {assessment_id}")
            
        except InvalidFormDataException as e:
            logger.error(f"Invalid S-LCA form data for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ S-LCA InvalidFormDataException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "invalid_form_data", str(e))
            
        except ScoringException as e:
            logger.error(f"S-LCA scoring error for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ S-LCA ScoringException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "scoring_error", str(e))
            
        except DatabaseConnectionException as e:
            logger.error(f"S-LCA database error for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ S-LCA DatabaseConnectionException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "database_error", str(e))
            
        except Exception as e:
            logger.error(f"Unexpected error processing S-LCA message for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ Unexpected S-LCA error for {assessment_id}: {type(e).__name__}: {e}")
            print(f"DEBUG: S-LCA Error traceback: {e.__class__.__module__}.{e.__class__.__name__}")
            import traceback
            traceback.print_exc()
            await self._publish_error_event(assessment_id, "processing_error", str(e))
    
    def _parse_slca_input(self, form_submission) -> SLCAInput:
        """Parse form submission into S-LCA input model"""
        try:
            logger.debug(f"Parsing S-LCA form submission: {form_submission}")
            print(f"DEBUG: _parse_slca_input called with type: {type(form_submission)}")
            print(f"DEBUG: S-LCA form_submission.__dict__: {form_submission.__dict__ if hasattr(form_submission, '__dict__') else 'No __dict__'}")
            
            # form_submission is now guaranteed to be a FormSubmissionRequest object
            form_data = form_submission.form_data
            logger.debug(f"Extracted S-LCA form_data: {form_data}")
            print(f"DEBUG: S-LCA form_data type: {type(form_data)}")
            print(f"DEBUG: S-LCA form_data keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'Not a dict'}")
            
            # Validate required fields for S-LCA
            required_fields = [
                'stakeholderGroup', 'years', 'indicators'
            ]
            for field in required_fields:
                if field not in form_data:
                    logger.error(f"Missing '{field}' field in S-LCA form data")
                    print(f"DEBUG: ❌ Missing S-LCA '{field}' field. Available keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'N/A'}")
                    raise InvalidFormDataException(f"Missing '{field}' field in S-LCA form data")
            
            # Parse individual components
            try:
                # Parse stakeholder group
                stakeholder_group_str = form_data['stakeholderGroup']
                try:
                    stakeholder_group = StakeholderGroup(stakeholder_group_str)
                except ValueError:
                    raise InvalidFormDataException(f"Invalid stakeholder group: {stakeholder_group_str}")
                
                # Parse years
                years = int(form_data['years'])
                if years < settings.min_assessment_years or years > settings.max_assessment_years:
                    raise InvalidFormDataException(f"Years must be between {settings.min_assessment_years} and {settings.max_assessment_years}")
                
                # Parse social indicators
                indicators_data = form_data['indicators']
                social_indicators = SocialIndicators(**indicators_data)
                
                # Parse optional weightings
                weightings = form_data.get('weightings', None)
                
                slca_input = SLCAInput(
                    analysisId=form_submission.assessment_id,
                    userId=form_submission.user_id,
                    systemName=form_submission.system_name,
                    projectName=form_data.get('projectName'),
                    stakeholderGroup=stakeholder_group,
                    years=years,
                    indicators=social_indicators,
                    weightings=weightings,
                    submittedAt=datetime.utcnow(),  # Use current time since we're processing now
                    metadata=form_submission.metadata
                )
                
            except Exception as e:
                logger.error(f"Failed to parse S-LCA components: {e}")
                print(f"DEBUG: ❌ S-LCA Component parsing failed: {type(e).__name__}: {e}")
                raise InvalidFormDataException(f"Failed to parse S-LCA components: {e}")
            
            logger.debug(f"Created SLCAInput: {slca_input}")
            print(f"DEBUG: ✅ Successfully created SLCAInput for assessment {slca_input.analysisId}")
            return slca_input
            
        except Exception as e:
            logger.error(f"Failed to parse S-LCA form data: {e}")
            print(f"DEBUG: ❌ _parse_slca_input failed: {type(e).__name__}: {e}")
            if hasattr(form_submission, '__dict__'):
                print(f"DEBUG: S-LCA form_submission details: {form_submission.__dict__}")
            import traceback
            traceback.print_exc()
            raise InvalidFormDataException(f"Failed to parse S-LCA form data: {e}")
    
    async def _publish_domain_scored_event(self, result: SLCAResult):
        """Publish domain scored event"""
        try:
            logger.debug(f"Publishing S-LCA domain scored event for {result.analysisId}")
            print(f"DEBUG: _publish_domain_scored_event called for S-LCA {result.analysisId}")
            
            event = EventFactory.create_domain_scored_event(
                assessment_id=result.analysisId,
                domain="slca",
                scores={
                    "overall_score": result.overall_score,
                    "annual_scores": result.annual_scores,
                    "social_sustainability_rating": result.social_sustainability_rating,
                    "stakeholder_impact_score": result.stakeholder_impact_score,
                    "social_performance_trend": result.social_performance_trend,
                    "key_metrics": result.key_metrics,
                    "recommendations": result.recommendations
                },
                score_value=result.overall_score,
                processing_time_ms=result.processingTimeMs
            )
            
            logger.debug(f"Created S-LCA event: {event}")
            print(f"DEBUG: Created S-LCA domain scored event: {event.dict()}")
            
            await self.producer.send(settings.slca_scores_topic, event.dict())
            logger.info(f"Published S-LCA domain scored event for assessment {result.analysisId}")
            print(f"DEBUG: ✅ Successfully published S-LCA domain scored event to {settings.slca_scores_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish S-LCA domain scored event: {e}")
            print(f"DEBUG: ❌ Failed to publish S-LCA domain scored event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _publish_error_event(self, assessment_id: Optional[str], error_type: str, error_message: str):
        """Publish error event"""
        try:
            logger.debug(f"Publishing S-LCA error event for {assessment_id}: {error_type}")
            print(f"DEBUG: _publish_error_event called for S-LCA - assessment_id: {assessment_id}, error_type: {error_type}")
            
            event = EventFactory.create_error_event(
                assessment_id=assessment_id or "unknown",
                error_type=error_type,
                error_message=error_message,
                domain="slca"
            )
            
            logger.debug(f"Created S-LCA error event: {event}")
            print(f"DEBUG: Created S-LCA error event: {event.dict()}")
            
            await self.producer.send(settings.error_events_topic, event.dict())
            logger.info(f"Published S-LCA error event for assessment {assessment_id}: {error_type}")
            print(f"DEBUG: ✅ Successfully published S-LCA error event to {settings.error_events_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish S-LCA error event: {e}")
            print(f"DEBUG: ❌ Failed to publish S-LCA error event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
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
from .models import (
    SustainabilityInput, SustainabilityResult, DomainSelectionHelper
)
from .scoring import calculate_sustainability_score
from .database import DatabaseManager
from .config import settings

logger = logging.getLogger(__name__)


class SustainabilityKafkaHandler:
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
                topics=[settings.sustainability_submission_topic],
                group_id=settings.kafka_consumer_group_id,
                auto_offset_reset=settings.kafka_auto_offset_reset
            )
            
            # Initialize producer for results
            self.producer = await create_kafka_producer()
            
            self.running = True
            logger.info("Kafka handler started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka handler: {e}")
            raise KafkaConnectionException(f"Failed to connect to Kafka: {e}")
    
    async def stop(self):
        """Stop Kafka consumer and producer"""
        self.running = False
        
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logger.info("Kafka handler stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping Kafka handler: {e}")
    
    def is_running(self) -> bool:
        """Check if Kafka handler is running"""
        return self.running
    
    async def consume_messages(self):
        """Main consumer loop"""
        logger.info("Starting Kafka message consumer")
        print("DEBUG: 🚀 Starting Kafka message consumer loop")
        
        while self.running:
            try:
                print(f"DEBUG: Consumer loop iteration - running: {self.running}")
                async for message in self.consumer:
                    logger.debug(f"Received message: {message}")
                    print(f"DEBUG: 📨 Received Kafka message - topic: {message.topic}, partition: {message.partition}, offset: {message.offset}")
                    print(f"DEBUG: Message value type: {type(message.value)}")
                    await self._process_message(message.value)
            except Exception as e:
                logger.error(f"Error in consumer loop: {e}")
                print(f"DEBUG: ❌ Error in consumer loop: {type(e).__name__}: {e}")
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
            logger.debug(f"Raw message data received: {message_data}")
            print(f"DEBUG: Raw message keys: {list(message_data.keys()) if message_data else 'None'}")
            print(f"DEBUG: Message event_type: {message_data.get('event_type', 'Missing')}")
            
            # Parse the incoming event
            if message_data.get('event_type') != EventType.FORM_SUBMITTED:
                logger.debug(f"Ignoring message with event_type: {message_data.get('event_type')}")
                return
            
            # Extract submission data and ensure it's properly structured
            submission_data = message_data.get('submission', {})
            logger.debug(f"Extracted submission data: {submission_data}")
            print(f"DEBUG: Submission data keys: {list(submission_data.keys()) if submission_data else 'None'}")
            print(f"DEBUG: Submission data type: {type(submission_data)}")
            
            if not submission_data:
                logger.warning("No submission data found in message")
                print("DEBUG: No submission data - returning early")
                return
            
            # Create FormSubmissionRequest from the submission data
            from shared.models.assessment import FormSubmissionRequest
            logger.debug("Creating FormSubmissionRequest from submission data")
            print(f"DEBUG: About to create FormSubmissionRequest with data: {submission_data}")
            
            try:
                form_submission = FormSubmissionRequest(**submission_data)
                logger.debug(f"Successfully created FormSubmissionRequest: {form_submission}")
                print(f"DEBUG: Created form_submission - domain: {form_submission.domain}")
                print(f"DEBUG: Created form_submission - assessment_id: {form_submission.assessment_id}")
            except Exception as e:
                logger.error(f"Failed to create FormSubmissionRequest: {e}")
                print(f"DEBUG: FormSubmissionRequest creation failed: {e}")
                print(f"DEBUG: Submission data that failed: {submission_data}")
                raise
            
            # Check if this message contains sustainability data
            if form_submission.domain != 'sustainability':
                logger.debug(f"Ignoring message for domain: {form_submission.domain}")
                print(f"DEBUG: Wrong domain '{form_submission.domain}', expected 'sustainability'")
                return
                
            assessment_id = form_submission.assessment_id
            logger.info(f"Processing sustainability form submission for assessment {assessment_id}")
            print(f"DEBUG: Processing assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Parse sustainability input (now supports flexible domains)
            logger.debug("Parsing sustainability input")
            print(f"DEBUG: About to parse sustainability input for assessment {assessment_id}")
            sustainability_input = self._parse_sustainability_input(form_submission)
            
            # Calculate sustainability scores (now handles flexible domains)
            logger.debug("Calculating sustainability scores")
            print(f"DEBUG: About to calculate sustainability scores for {len(sustainability_input.assessments)} domains")
            scores = calculate_sustainability_score(sustainability_input.assessments)
            logger.debug(f"Calculated scores: {scores}")
            print(f"DEBUG: Calculated scores keys: {list(scores.keys()) if scores else 'None'}")
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"Processing time: {processing_time}ms")
            print(f"DEBUG: Processing time: {processing_time}ms")
            
            # Create result
            logger.debug("Creating SustainabilityResult")
            print(f"DEBUG: Creating result for assessment {sustainability_input.assessmentId}")
            result = SustainabilityResult(
                assessmentId=sustainability_input.assessmentId,
                overallScore=scores['overall_score'],
                dimensionScores=scores['dimension_scores'],
                sustainabilityMetrics=scores['sustainability_metrics'],
                timestamp=datetime.utcnow(),
                processingTimeMs=processing_time
            )
            logger.debug(f"Created result: {result}")
            print(f"DEBUG: Result overall score: {result.overallScore}")
            
            # Save to database
            logger.debug("Preparing to save to database")
            print(f"DEBUG: Saving assessment {sustainability_input.assessmentId} to database")
            
            assessment_data = {
                "assessment_id": sustainability_input.assessmentId,
                "user_id": sustainability_input.userId,
                "system_name": sustainability_input.systemName,
                "overall_score": result.overallScore,
                "dimension_scores": result.dimensionScores,
                "sustainability_metrics": result.sustainabilityMetrics,
                "raw_assessments": sustainability_input.assessments,  # Now contains flexible domain data
                "metadata": sustainability_input.metadata,
                "submitted_at": sustainability_input.submittedAt
            }
            logger.debug(f"Assessment data prepared: {assessment_data}")
            print(f"DEBUG: Assessment data keys: {list(assessment_data.keys())}")
            print(f"DEBUG: Database will handle JSON serialization of Pydantic models")
            
            self.db_manager.save_assessment(assessment_data)
            logger.debug("Successfully saved to database")
            print(f"DEBUG: Successfully saved assessment {assessment_id} to database")
            
            # Publish success event
            logger.debug("Publishing domain scored event")
            print(f"DEBUG: Publishing success event for assessment {assessment_id}")
            await self._publish_domain_scored_event(result)
            
            logger.info(f"Successfully processed sustainability assessment {assessment_id} in {processing_time:.2f}ms")
            print(f"DEBUG: ✅ COMPLETE - Successfully processed assessment {assessment_id}")
            
        except InvalidFormDataException as e:
            logger.error(f"Invalid form data for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ InvalidFormDataException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "invalid_form_data", str(e))
            
        except ScoringException as e:
            logger.error(f"Scoring error for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ ScoringException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "scoring_error", str(e))
            
        except DatabaseConnectionException as e:
            logger.error(f"Database error for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ DatabaseConnectionException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "database_error", str(e))
            
        except Exception as e:
            logger.error(f"Unexpected error processing sustainability message for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ Unexpected error for {assessment_id}: {type(e).__name__}: {e}")
            print(f"DEBUG: Error traceback: {e.__class__.__module__}.{e.__class__.__name__}")
            import traceback
            traceback.print_exc()
            await self._publish_error_event(assessment_id, "processing_error", str(e))
    
    def _parse_sustainability_input(self, form_submission) -> SustainabilityInput:
        """Parse form submission into sustainability input model (now supports flexible domains)"""
        try:
            logger.debug(f"Parsing form submission: {form_submission}")
            print(f"DEBUG: _parse_sustainability_input called with type: {type(form_submission)}")
            print(f"DEBUG: form_submission.__dict__: {form_submission.__dict__ if hasattr(form_submission, '__dict__') else 'No __dict__'}")
            
            # form_submission is now guaranteed to be a FormSubmissionRequest object
            form_data = form_submission.form_data
            logger.debug(f"Extracted form_data: {form_data}")
            print(f"DEBUG: form_data type: {type(form_data)}")
            print(f"DEBUG: form_data keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'Not a dict'}")
            
            # Validate that we have assessments field
            if 'assessments' not in form_data:
                logger.error("Missing 'assessments' field in sustainability form data")
                print(f"DEBUG: ❌ Missing 'assessments' field. Available keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'N/A'}")
                raise InvalidFormDataException("Missing 'assessments' field in sustainability form data")
            
            assessments_data = form_data['assessments']
            logger.debug(f"Assessments data: {assessments_data}")
            print(f"DEBUG: assessments_data type: {type(assessments_data)}")
            print(f"DEBUG: assessments_data keys: {list(assessments_data.keys()) if isinstance(assessments_data, dict) else 'Not a dict'}")
            
            # Validate that we have at least one domain
            if not assessments_data:
                raise InvalidFormDataException("No assessment domains provided")
            
            # Validate and parse each domain assessment
            parsed_assessments = {}
            valid_domains = ['environmental', 'economic', 'social']
            
            for domain_name, domain_data in assessments_data.items():
                if domain_name not in valid_domains:
                    logger.warning(f"Unknown sustainability domain: {domain_name}")
                    print(f"DEBUG: Unknown domain '{domain_name}', skipping")
                    continue
                
                try:
                    # Create appropriate assessment object for each domain
                    assessment_obj = DomainSelectionHelper.create_assessment_from_data(domain_name, domain_data)
                    parsed_assessments[domain_name] = assessment_obj
                    logger.debug(f"Successfully parsed {domain_name} assessment")
                    print(f"DEBUG: ✅ Parsed {domain_name} assessment")
                
                except Exception as e:
                    logger.error(f"Failed to parse {domain_name} assessment: {e}")
                    print(f"DEBUG: ❌ Failed to parse {domain_name} assessment: {e}")
                    raise InvalidFormDataException(f"Failed to parse {domain_name} assessment data: {e}")
            
            if not parsed_assessments:
                raise InvalidFormDataException("No valid assessment domains found")
            
            logger.debug(f"Successfully parsed {len(parsed_assessments)} domains: {list(parsed_assessments.keys())}")
            print(f"DEBUG: Successfully parsed domains: {list(parsed_assessments.keys())}")
            
            sustainability_input = SustainabilityInput(
                assessmentId=form_submission.assessment_id,
                userId=form_submission.user_id,
                systemName=form_submission.system_name,
                assessments=parsed_assessments,  # Now contains parsed assessment objects
                submittedAt=datetime.utcnow(),  # Use current time since we're processing now
                metadata=form_submission.metadata
            )
            
            logger.debug(f"Created SustainabilityInput: {sustainability_input}")
            print(f"DEBUG: ✅ Successfully created SustainabilityInput for assessment {sustainability_input.assessmentId}")
            return sustainability_input
            
        except Exception as e:
            logger.error(f"Failed to parse sustainability form data: {e}")
            print(f"DEBUG: ❌ _parse_sustainability_input failed: {type(e).__name__}: {e}")
            if hasattr(form_submission, '__dict__'):
                print(f"DEBUG: form_submission details: {form_submission.__dict__}")
            import traceback
            traceback.print_exc()
            raise InvalidFormDataException(f"Failed to parse sustainability form data: {e}")
    
    async def _publish_domain_scored_event(self, result: SustainabilityResult):
        """Publish domain scored event"""
        try:
            logger.debug(f"Publishing domain scored event for {result.assessmentId}")
            print(f"DEBUG: _publish_domain_scored_event called for {result.assessmentId}")
            
            event = EventFactory.create_domain_scored_event(
                assessment_id=result.assessmentId,
                domain="sustainability",
                scores={
                    "overall_score": result.overallScore,
                    "dimension_scores": result.dimensionScores,
                    "sustainability_metrics": result.sustainabilityMetrics
                },
                score_value=result.overallScore,
                processing_time_ms=result.processingTimeMs
            )
            
            logger.debug(f"Created event: {event}")
            print(f"DEBUG: Created domain scored event: {event.dict()}")
            
            await self.producer.send(settings.sustainability_scores_topic, event.dict())
            logger.info(f"Published domain scored event for assessment {result.assessmentId}")
            print(f"DEBUG: ✅ Successfully published domain scored event to {settings.sustainability_scores_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish domain scored event: {e}")
            print(f"DEBUG: ❌ Failed to publish domain scored event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _publish_error_event(self, assessment_id: Optional[str], error_type: str, error_message: str):
        """Publish error event"""
        try:
            logger.debug(f"Publishing error event for {assessment_id}: {error_type}")
            print(f"DEBUG: _publish_error_event called - assessment_id: {assessment_id}, error_type: {error_type}")
            
            event = EventFactory.create_error_event(
                assessment_id=assessment_id or "unknown",
                error_type=error_type,
                error_message=error_message,
                domain="sustainability"
            )
            
            logger.debug(f"Created error event: {event}")
            print(f"DEBUG: Created error event: {event.dict()}")
            
            await self.producer.send(settings.error_events_topic, event.dict())
            logger.info(f"Published error event for assessment {assessment_id}: {error_type}")
            print(f"DEBUG: ✅ Successfully published error event to {settings.error_events_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish error event: {e}")
            print(f"DEBUG: ❌ Failed to publish error event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
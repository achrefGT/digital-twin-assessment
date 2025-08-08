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
from .models import LCCInput, LCCResult, CostStructure, BenefitStructure, IndustryType
from .score import calculate_lcc_score
from .database import DatabaseManager
from .config import settings

logger = logging.getLogger(__name__)


class LCCKafkaHandler:
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
                topics=[settings.lcc_submission_topic],
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
        print("DEBUG: 🚀 Starting LCC Kafka message consumer loop")
        
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
            
            # Extract submission data
            submission_data = message_data.get('submission', {})
            logger.debug(f"Extracted submission data: {submission_data}")
            print(f"DEBUG: Submission data keys: {list(submission_data.keys()) if submission_data else 'None'}")
            
            if not submission_data:
                logger.warning("No submission data found in message")
                print("DEBUG: No submission data - returning early")
                return
            
            # Create FormSubmissionRequest from the submission data
            from shared.models.assessment import FormSubmissionRequest
            logger.debug("Creating FormSubmissionRequest from submission data")
            
            try:
                form_submission = FormSubmissionRequest(**submission_data)
                logger.debug(f"Successfully created FormSubmissionRequest: {form_submission}")
                print(f"DEBUG: Created form_submission - domain: {form_submission.domain}")
                print(f"DEBUG: Created form_submission - assessment_id: {form_submission.assessment_id}")
            except Exception as e:
                logger.error(f"Failed to create FormSubmissionRequest: {e}")
                print(f"DEBUG: FormSubmissionRequest creation failed: {e}")
                raise
            
            # Check if this message contains LCC data
            if form_submission.domain != 'lcc':
                logger.debug(f"Ignoring message for domain: {form_submission.domain}")
                print(f"DEBUG: Wrong domain '{form_submission.domain}', expected 'lcc'")
                return
                
            assessment_id = form_submission.assessment_id
            logger.info(f"Processing LCC form submission for assessment {assessment_id}")
            print(f"DEBUG: Processing assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Parse LCC input
            logger.debug("Parsing LCC input")
            print(f"DEBUG: About to parse LCC input for assessment {assessment_id}")
            lcc_input = self._parse_lcc_input(form_submission)
            
            # Calculate LCC scores
            logger.debug("Calculating LCC scores")
            print(f"DEBUG: About to calculate LCC scores for assessment {assessment_id}")
            scores = calculate_lcc_score(lcc_input)
            logger.debug(f"Calculated scores: {scores}")
            print(f"DEBUG: Calculated scores keys: {list(scores.keys()) if scores else 'None'}")
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"Processing time: {processing_time}ms")
            print(f"DEBUG: Processing time: {processing_time}ms")
            
            # Create result
            logger.debug("Creating LCCResult")
            result = LCCResult(
                analysisId=lcc_input.analysisId,
                npv=scores.get('npv'),
                irr=scores.get('irr'),
                payback_period=scores.get('payback_period'),
                roi=scores.get('roi'),
                economic_sustainability_score=scores['economic_sustainability_score'],
                sustainability_rating=scores['sustainability_rating'],
                dt_implementation_maturity=scores['dt_implementation_maturity'],
                benefit_cost_ratio=scores['benefit_cost_ratio'],
                transformation_readiness=scores['transformation_readiness'],
                score_components=scores['score_components'],
                industry_type=scores['industry_type'],
                timestamp=datetime.utcnow(),
                processingTimeMs=processing_time
            )
            logger.debug(f"Created result: {result}")
            print(f"DEBUG: Result economic sustainability score: {result.economic_sustainability_score}")
            
            # Save to database
            logger.debug("Preparing to save to database")
            print(f"DEBUG: Saving assessment {lcc_input.analysisId} to database")
            
            # Calculate analysis years from cost/benefit arrays
            analysis_years = len(lcc_input.costs.dt_software_license) if lcc_input.costs.dt_software_license else None
            
            assessment_data = {
                "assessment_id": lcc_input.analysisId,
                "user_id": lcc_input.userId,
                "system_name": lcc_input.systemName,
                "industry_type": lcc_input.industry.value,
                
                # Financial metrics
                "npv": result.npv,
                "irr": result.irr,
                "payback_period": result.payback_period,
                "roi": result.roi,
                
                # Scores
                "economic_sustainability_score": result.economic_sustainability_score,
                "sustainability_rating": result.sustainability_rating,
                "dt_implementation_maturity": result.dt_implementation_maturity,
                "benefit_cost_ratio": result.benefit_cost_ratio,
                "transformation_readiness": result.transformation_readiness,
                
                # Detailed data
                "score_components": result.score_components,
                "input_data": lcc_input,  # Database will handle JSON serialization
                "detailed_results": scores,  # Full analysis results
                
                # Metadata
                "capex": lcc_input.capex,
                "discount_rate": lcc_input.discount_rate,
                "analysis_years": analysis_years,
                "metadata": lcc_input.metadata,
                "submitted_at": lcc_input.submittedAt
            }
            logger.debug(f"Assessment data prepared: {assessment_data}")
            print(f"DEBUG: Assessment data keys: {list(assessment_data.keys())}")
            
            self.db_manager.save_assessment(assessment_data)
            logger.debug("Successfully saved to database")
            print(f"DEBUG: Successfully saved assessment {assessment_id} to database")
            
            # Publish success event
            logger.debug("Publishing domain scored event")
            print(f"DEBUG: Publishing success event for assessment {assessment_id}")
            await self._publish_domain_scored_event(result)
            
            logger.info(f"Successfully processed LCC assessment {assessment_id} in {processing_time:.2f}ms")
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
            logger.error(f"Unexpected error processing LCC message for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ Unexpected error for {assessment_id}: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            await self._publish_error_event(assessment_id, "processing_error", str(e))
    
    def _parse_lcc_input(self, form_submission) -> LCCInput:
        """Parse form submission into LCC input model"""
        try:
            logger.debug(f"Parsing form submission: {form_submission}")
            print(f"DEBUG: _parse_lcc_input called with type: {type(form_submission)}")
            
            form_data = form_submission.form_data
            logger.debug(f"Extracted form_data: {form_data}")
            print(f"DEBUG: form_data type: {type(form_data)}")
            print(f"DEBUG: form_data keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'Not a dict'}")
            
            # Validate required fields
            required_fields = ['industry', 'capex', 'costs', 'benefits']
            for field in required_fields:
                if field not in form_data:
                    logger.error(f"Missing '{field}' field in LCC form data")
                    print(f"DEBUG: ❌ Missing '{field}' field. Available keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'N/A'}")
                    raise InvalidFormDataException(f"Missing '{field}' field in LCC form data")
            
            # Parse individual components
            try:
                # Parse industry type
                industry_str = form_data['industry']
                try:
                    industry = IndustryType(industry_str)
                except ValueError:
                    # Fallback to manufacturing if invalid industry
                    logger.warning(f"Invalid industry type '{industry_str}', defaulting to manufacturing")
                    industry = IndustryType.MANUFACTURING
                
                # Parse cost structure
                costs_data = form_data['costs']
                costs = CostStructure(**costs_data)
                
                # Parse benefit structure
                benefits_data = form_data['benefits']
                benefits = BenefitStructure(**benefits_data)
                
                # Parse optional parameters with defaults
                discount_rate = form_data.get('discount_rate', settings.default_discount_rate)
                start_year = form_data.get('start_year', 2025)
                roi_bounds = form_data.get('roi_bounds', settings.get_roi_bounds_for_industry(industry_str))
                
                # Create LCC input
                lcc_input = LCCInput(
                    analysisId=form_submission.assessment_id,
                    userId=form_submission.user_id,
                    systemName=form_submission.system_name,
                    industry=industry,
                    capex=form_data['capex'],
                    costs=costs,
                    benefits=benefits,
                    discount_rate=discount_rate,
                    start_year=start_year,
                    roi_bounds=roi_bounds,
                    submittedAt=datetime.utcnow(),
                    metadata=form_submission.metadata
                )
                
            except Exception as e:
                logger.error(f"Failed to parse LCC components: {e}")
                print(f"DEBUG: ❌ Component parsing failed: {type(e).__name__}: {e}")
                raise InvalidFormDataException(f"Failed to parse LCC components: {e}")
            
            logger.debug(f"Created LCCInput: {lcc_input}")
            print(f"DEBUG: ✅ Successfully created LCCInput for assessment {lcc_input.analysisId}")
            return lcc_input
            
        except Exception as e:
            logger.error(f"Failed to parse LCC form data: {e}")
            print(f"DEBUG: ❌ _parse_lcc_input failed: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
            raise InvalidFormDataException(f"Failed to parse LCC form data: {e}")
    
    async def _publish_domain_scored_event(self, result: LCCResult):
        """Publish domain scored event"""
        try:
            logger.debug(f"Publishing domain scored event for {result.analysisId}")
            print(f"DEBUG: _publish_domain_scored_event called for {result.analysisId}")
            
            event = EventFactory.create_domain_scored_event(
                assessment_id=result.analysisId,
                domain="lcc",
                scores={
                    "npv": result.npv,
                    "irr": result.irr,
                    "payback_period": result.payback_period,
                    "roi": result.roi,
                    "economic_sustainability_score": result.economic_sustainability_score,
                    "sustainability_rating": result.sustainability_rating,
                    "dt_implementation_maturity": result.dt_implementation_maturity,
                    "benefit_cost_ratio": result.benefit_cost_ratio,
                    "transformation_readiness": result.transformation_readiness,
                    "score_components": result.score_components
                },
                score_value=result.economic_sustainability_score,
                processing_time_ms=result.processingTimeMs
            )
            
            logger.debug(f"Created event: {event}")
            print(f"DEBUG: Created domain scored event: {event.dict()}")
            
            await self.producer.send(settings.lcc_scores_topic, event.dict())
            logger.info(f"Published domain scored event for assessment {result.analysisId}")
            print(f"DEBUG: ✅ Successfully published domain scored event to {settings.lcc_scores_topic}")
            
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
                domain="lcc"
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
import asyncio
from datetime import datetime
from typing import Dict, Any, List, Optional, Set
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
    HumanCentricityInput, HumanCentricityResult, LikertResponse, 
    CybersicknessResponse, WorkloadMetrics, EmotionalResponse, 
    PerformanceMetrics, HumanCentricityDomain, DomainSelectionHelper
)
from .score import calculate_human_centricity_score_with_domains
from .database import DatabaseManager
from .statement_manager import StatementManager
from .config import settings

logger = logging.getLogger(__name__)


class HumanCentricityKafkaHandler:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.statement_manager = StatementManager(db_manager)
        self.consumer = None
        self.producer = None
        self.running = False
        
    async def start(self):
        """Start Kafka consumer and producer"""
        try:
            # Initialize consumer for form submissions
            self.consumer = await create_kafka_consumer(
                topics=[settings.human_centricity_submission_topic],
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
                logger.error(f"Error in consumer loop: {e}", exc_info=True)
                print(f"DEBUG: ❌ Error in consumer loop: {type(e).__name__}: {e}")
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
                logger.error(f"Failed to create FormSubmissionRequest: {e}", exc_info=True)
                print(f"DEBUG: FormSubmissionRequest creation failed: {e}")
                print(f"DEBUG: Submission data that failed: {submission_data}")
                raise
            
            # Check if this message contains human centricity data
            if form_submission.domain != 'human_centricity':
                logger.debug(f"Ignoring message for domain: {form_submission.domain}")
                print(f"DEBUG: Wrong domain '{form_submission.domain}', expected 'human_centricity'")
                return
                
            assessment_id = form_submission.assessment_id
            logger.info(f"Processing human centricity form submission for assessment {assessment_id}")
            print(f"DEBUG: Processing assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Parse human centricity input with dynamic statement support
            logger.debug("Parsing human centricity input with dynamic statements")
            print(f"DEBUG: About to parse human centricity input for assessment {assessment_id}")
            human_centricity_input = self._parse_human_centricity_input(form_submission)
            
            # Calculate human centricity scores
            logger.debug("Calculating human centricity scores")
            print(f"DEBUG: About to calculate scores for assessment {assessment_id}")
            print(f"DEBUG: Selected domains: {[d.value for d in human_centricity_input.selected_domains]}")
            
            scores = calculate_human_centricity_score_with_domains(human_centricity_input)
            print(f"DEBUG: Using domain-based scoring with {len(human_centricity_input.selected_domains)} domains")
            
            logger.debug(f"Calculated scores: {scores}")
            print(f"DEBUG: Calculated scores keys: {list(scores.keys()) if scores else 'None'}")
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"Processing time: {processing_time}ms")
            print(f"DEBUG: Processing time: {processing_time}ms")
            
            # Create result
            logger.debug("Creating HumanCentricityResult")
            print(f"DEBUG: Creating result for assessment {human_centricity_input.assessmentId}")
            result = HumanCentricityResult(
                assessmentId=human_centricity_input.assessmentId,
                overallScore=scores['overall_score'],
                domainScores=scores['domain_scores'],
                selectedDomains=[d.value for d in human_centricity_input.selected_domains],
                detailedMetrics=scores['detailed_metrics'],
                timestamp=datetime.utcnow(),
                processingTimeMs=processing_time
            )
            logger.debug(f"Created result: {result}")
            print(f"DEBUG: Result overall score: {result.overallScore}")
            
            # Save to database
            logger.debug("Preparing to save to database")
            print(f"DEBUG: Saving assessment {human_centricity_input.assessmentId} to database")
            
            # Convert Pydantic models to dict for database serialization
            assessment_data = {
                "assessment_id": human_centricity_input.assessmentId,
                "user_id": human_centricity_input.userId,
                "system_name": human_centricity_input.systemName,
                "overall_score": result.overallScore,
                "domain_scores": result.domainScores,
                "selected_domains": result.selectedDomains,
                "detailed_metrics": result.detailedMetrics,
                "raw_assessments": human_centricity_input.dict(),  # Explicitly convert to dict
                "metadata": human_centricity_input.meta_data if human_centricity_input.meta_data else {},
                "submitted_at": human_centricity_input.submittedAt
            }
            logger.debug(f"Assessment data prepared: {assessment_data}")
            print(f"DEBUG: Assessment data keys: {list(assessment_data.keys())}")
            print(f"DEBUG: Converted Pydantic models to dict for database")
            
            self.db_manager.save_assessment(assessment_data)
            logger.debug("Successfully saved to database")
            print(f"DEBUG: Successfully saved assessment {assessment_id} to database")
            
            # Publish success event
            logger.debug("Publishing domain scored event")
            print(f"DEBUG: Publishing success event for assessment {assessment_id}")
            await self._publish_domain_scored_event(result)
            
            logger.info(f"Successfully processed human centricity assessment {assessment_id} in {processing_time:.2f}ms")
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
            logger.error(f"Unexpected error processing human centricity message for assessment {assessment_id}: {e}", exc_info=True)
            print(f"DEBUG: ❌ Unexpected error for {assessment_id}: {type(e).__name__}: {e}")
            await self._publish_error_event(assessment_id, "processing_error", str(e))
    
    def _parse_human_centricity_input(self, form_submission) -> HumanCentricityInput:
        """Parse form submission into human centricity input model with dynamic statement support"""
        try:
            logger.debug(f"Parsing form submission: {form_submission}")
            print(f"DEBUG: _parse_human_centricity_input called with type: {type(form_submission)}")
            print(f"DEBUG: form_submission.__dict__: {form_submission.__dict__ if hasattr(form_submission, '__dict__') else 'No __dict__'}")
            
            # form_submission is now guaranteed to be a FormSubmissionRequest object
            form_data = form_submission.form_data
            logger.debug(f"Extracted form_data: {form_data}")
            print(f"DEBUG: form_data type: {type(form_data)}")
            print(f"DEBUG: form_data keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'Not a dict'}")
            
            # Parse selected domains
            selected_domains = set()
            if 'selected_domains' in form_data:
                domain_list = form_data['selected_domains']
                print(f"DEBUG: Found selected_domains: {domain_list}")
                try:
                    for domain_str in domain_list:
                        domain_enum = HumanCentricityDomain(domain_str)
                        selected_domains.add(domain_enum)
                    print(f"DEBUG: Parsed {len(selected_domains)} selected domains")
                except ValueError as e:
                    logger.error(f"Invalid domain in selection: {e}")
                    print(f"DEBUG: Invalid domain in selection: {e}")
                    raise InvalidFormDataException(f"Invalid domain in selection: {e}")
            else:
                print(f"DEBUG: No selected_domains found - checking for legacy data structure")
                # Auto-detect domains based on available data for backward compatibility
                selected_domains = self._detect_legacy_domains(form_data)
                print(f"DEBUG: Auto-detected legacy domains: {[d.value for d in selected_domains]}")
            
            # Validate that form data contains required fields for selected domains
            if not selected_domains:
                raise InvalidFormDataException("No domains selected or detected for assessment")
            
            # Get current statement structure from database for validation
            statement_structure = self._get_statement_structure_for_domains(selected_domains)
            print(f"DEBUG: Retrieved statement structure for {len(selected_domains)} domains")
            
            # Parse domain-specific data with dynamic statement support
            parsed_data = {
                'assessmentId': form_submission.assessment_id,
                'userId': form_submission.user_id,
                'systemName': form_submission.system_name,
                'selected_domains': selected_domains,
                'submittedAt': datetime.utcnow(),
                'metadata': form_submission.metadata or {}
            }
            
            # Parse responses for each domain using dynamic statement structure
            for domain in selected_domains:
                domain_statements = statement_structure.get(domain, [])
                print(f"DEBUG: Processing domain {domain.value} with {len(domain_statements)} statements")
                
                # Handle different domain types
                if domain == HumanCentricityDomain.CORE_USABILITY:
                    parsed_data['core_usability_responses'] = self._parse_domain_responses(
                        domain, form_data, domain_statements, LikertResponse
                    )
                
                elif domain == HumanCentricityDomain.TRUST_TRANSPARENCY:
                    parsed_data['trust_transparency_responses'] = self._parse_domain_responses(
                        domain, form_data, domain_statements, LikertResponse
                    )
                
                elif domain == HumanCentricityDomain.WORKLOAD_COMFORT:
                    # Workload can use either structured metrics or dynamic responses
                    if 'workload_metrics' in form_data:
                        parsed_data['workload_metrics'] = WorkloadMetrics(**form_data['workload_metrics'])
                        print(f"DEBUG: Parsed structured workload metrics")
                    else:
                        # Parse as dynamic responses
                        workload_responses = self._parse_domain_responses(
                            domain, form_data, domain_statements, dict
                        )
                        # Convert to WorkloadMetrics if possible
                        if workload_responses:
                            parsed_data['workload_metrics'] = self._convert_to_workload_metrics(workload_responses)
                            print(f"DEBUG: Converted dynamic workload responses to metrics")
                
                elif domain == HumanCentricityDomain.CYBERSICKNESS:
                    parsed_data['cybersickness_responses'] = self._parse_domain_responses(
                        domain, form_data, domain_statements, CybersicknessResponse
                    )
                
                elif domain == HumanCentricityDomain.EMOTIONAL_RESPONSE:
                    # Emotional response can use structured SAM or dynamic responses
                    if 'emotional_response' in form_data:
                        parsed_data['emotional_response'] = EmotionalResponse(**form_data['emotional_response'])
                        print(f"DEBUG: Parsed structured emotional response")
                    else:
                        # Parse as dynamic responses
                        emotional_responses = self._parse_domain_responses(
                            domain, form_data, domain_statements, dict
                        )
                        if emotional_responses:
                            parsed_data['emotional_response'] = self._convert_to_emotional_response(emotional_responses)
                            print(f"DEBUG: Converted dynamic emotional responses")
                
                elif domain == HumanCentricityDomain.PERFORMANCE:
                    # Performance can use structured metrics or dynamic responses
                    if 'performance_metrics' in form_data:
                        parsed_data['performance_metrics'] = PerformanceMetrics(**form_data['performance_metrics'])
                        print(f"DEBUG: Parsed structured performance metrics")
                    else:
                        # Parse as dynamic responses
                        performance_responses = self._parse_domain_responses(
                            domain, form_data, domain_statements, dict
                        )
                        if performance_responses:
                            parsed_data['performance_metrics'] = self._convert_to_performance_metrics(performance_responses)
                            print(f"DEBUG: Converted dynamic performance responses")
            
            # Handle custom responses (dynamic statements outside of standard structure)
            if 'custom_responses' in form_data:
                parsed_data['custom_responses'] = form_data['custom_responses']
                print(f"DEBUG: Added custom responses: {list(form_data['custom_responses'].keys()) if form_data['custom_responses'] else 'None'}")
            
            # Handle legacy combined UX/Trust responses
            if 'ux_trust_responses' in form_data:
                parsed_data['ux_trust_responses'] = [LikertResponse(**r) for r in form_data['ux_trust_responses']]
                print(f"DEBUG: Parsed legacy ux_trust_responses")
            
            human_centricity_input = HumanCentricityInput(**parsed_data)
            
            logger.debug(f"Created HumanCentricityInput: {human_centricity_input}")
            print(f"DEBUG: ✅ Successfully created HumanCentricityInput for assessment {human_centricity_input.assessmentId}")
            print(f"DEBUG: Selected domains: {[d.value for d in human_centricity_input.selected_domains]}")
            return human_centricity_input
            
        except Exception as e:
            logger.error(f"Failed to parse human centricity form data: {e}", exc_info=True)
            print(f"DEBUG: ❌ _parse_human_centricity_input failed: {type(e).__name__}: {e}")
            if hasattr(form_submission, '__dict__'):
                print(f"DEBUG: form_submission details: {form_submission.__dict__}")
            raise InvalidFormDataException(f"Failed to parse human centricity form data: {e}")
    
    def _get_statement_structure_for_domains(self, domains: Set[HumanCentricityDomain]) -> Dict[HumanCentricityDomain, List[Dict[str, Any]]]:
        """Get current statement structure from database for selected domains"""
        structure = {}
        for domain in domains:
            statements = self.statement_manager.get_statements_by_domain(domain)
            structure[domain] = [stmt.dict() for stmt in statements]
        return structure
    
    def _parse_domain_responses(
        self, 
        domain: HumanCentricityDomain, 
        form_data: Dict[str, Any],
        domain_statements: List[Dict[str, Any]],
        response_model
    ) -> Optional[List]:
        """Parse responses for a domain using dynamic statement structure"""
        # Check for both legacy field names and new dynamic response format
        legacy_field_map = {
            HumanCentricityDomain.CORE_USABILITY: 'core_usability_responses',
            HumanCentricityDomain.TRUST_TRANSPARENCY: 'trust_transparency_responses',
            HumanCentricityDomain.CYBERSICKNESS: 'cybersickness_responses'
        }
        
        field_name = legacy_field_map.get(domain)
        
        # Try legacy format first
        if field_name and field_name in form_data:
            responses_data = form_data[field_name]
            print(f"DEBUG: Found legacy responses for {domain.value}: {len(responses_data)} items")
            try:
                return [response_model(**r) for r in responses_data]
            except Exception as e:
                logger.warning(f"Failed to parse legacy responses for {domain.value}: {e}")
        
        # Try dynamic response format: responses are keyed by statement ID
        dynamic_field = f"{domain.value.lower()}_responses"
        if dynamic_field in form_data:
            responses_data = form_data[dynamic_field]
            print(f"DEBUG: Found dynamic responses for {domain.value}: {len(responses_data)} items")
            
            # Parse based on response type
            parsed_responses = []
            for response_item in responses_data:
                try:
                    if response_model == dict:
                        parsed_responses.append(response_item)
                    else:
                        parsed_responses.append(response_model(**response_item))
                except Exception as e:
                    logger.warning(f"Failed to parse individual response for {domain.value}: {e}")
                    continue
            
            return parsed_responses if parsed_responses else None
        
        # Try generic 'responses' field with domain filtering
        if 'responses' in form_data:
            all_responses = form_data['responses']
            domain_responses = [r for r in all_responses if r.get('domain') == domain.value]
            if domain_responses:
                print(f"DEBUG: Found {len(domain_responses)} generic responses for {domain.value}")
                parsed_responses = []
                for response_item in domain_responses:
                    try:
                        if response_model == dict:
                            parsed_responses.append(response_item)
                        else:
                            parsed_responses.append(response_model(**response_item))
                    except Exception as e:
                        logger.warning(f"Failed to parse generic response for {domain.value}: {e}")
                        continue
                return parsed_responses if parsed_responses else None
        
        print(f"DEBUG: No responses found for {domain.value}")
        return None
    
    def _convert_to_workload_metrics(self, responses: List[Dict[str, Any]]) -> Optional[WorkloadMetrics]:
        """Convert dynamic workload responses to WorkloadMetrics"""
        try:
            # Extract values from responses
            metrics = {}
            for response in responses:
                statement = response.get('statement', '').lower()
                value = response.get('value') or response.get('rating')
                
                if 'mental' in statement or 'exigence_mentale' in statement:
                    metrics['mental_demand'] = value
                elif 'effort' in statement or 'effort_requis' in statement:
                    metrics['effort_required'] = value
                elif 'frustration' in statement or 'niveau_de_frustration' in statement:
                    metrics['frustration_level'] = value
            
            if len(metrics) >= 2:  # At least 2 of 3 metrics
                return WorkloadMetrics(**metrics)
        except Exception as e:
            logger.warning(f"Failed to convert workload responses: {e}")
        return None
    
    def _convert_to_emotional_response(self, responses: List[Dict[str, Any]]) -> Optional[EmotionalResponse]:
        """Convert dynamic emotional responses to EmotionalResponse"""
        try:
            metrics = {}
            for response in responses:
                statement = response.get('statement', '').lower()
                value = response.get('value') or response.get('rating')
                
                if 'valence' in statement:
                    metrics['valence'] = value
                elif 'arousal' in statement or 'activation' in statement:
                    metrics['arousal'] = value
            
            if 'valence' in metrics and 'arousal' in metrics:
                return EmotionalResponse(**metrics)
        except Exception as e:
            logger.warning(f"Failed to convert emotional responses: {e}")
        return None
    
    def _convert_to_performance_metrics(self, responses: List[Dict[str, Any]]) -> Optional[PerformanceMetrics]:
        """Convert dynamic performance responses to PerformanceMetrics"""
        try:
            metrics = {}
            for response in responses:
                statement = response.get('statement', '').lower()
                value = response.get('value')
                
                if 'time' in statement or 'temps' in statement:
                    metrics['task_completion_time_min'] = value
                elif 'error' in statement or 'erreur' in statement:
                    metrics['error_rate'] = value
                elif 'help' in statement or 'aide' in statement:
                    metrics['help_requests'] = value
            
            if len(metrics) >= 2:  # At least 2 of 3 metrics
                return PerformanceMetrics(**metrics)
        except Exception as e:
            logger.warning(f"Failed to convert performance responses: {e}")
        return None
    
    def _detect_legacy_domains(self, form_data: Dict[str, Any]) -> Set[HumanCentricityDomain]:
        """Auto-detect domains based on available data for backward compatibility"""
        detected_domains = set()
        
        # Check for domain-specific data
        if 'core_usability_responses' in form_data:
            detected_domains.add(HumanCentricityDomain.CORE_USABILITY)
        
        if 'trust_transparency_responses' in form_data:
            detected_domains.add(HumanCentricityDomain.TRUST_TRANSPARENCY)
        
        if 'workload_metrics' in form_data:
            detected_domains.add(HumanCentricityDomain.WORKLOAD_COMFORT)
        
        if 'cybersickness_responses' in form_data:
            detected_domains.add(HumanCentricityDomain.CYBERSICKNESS)
        
        if 'emotional_response' in form_data:
            detected_domains.add(HumanCentricityDomain.EMOTIONAL_RESPONSE)
        
        if 'performance_metrics' in form_data:
            detected_domains.add(HumanCentricityDomain.PERFORMANCE)
        
        # Handle legacy combined UX/Trust responses
        if 'ux_trust_responses' in form_data:
            detected_domains.add(HumanCentricityDomain.CORE_USABILITY)
            detected_domains.add(HumanCentricityDomain.TRUST_TRANSPARENCY)
        
        print(f"DEBUG: Detected {len(detected_domains)} legacy domains")
        return detected_domains
    
    async def _publish_domain_scored_event(self, result: HumanCentricityResult):
        """Publish domain scored event"""
        try:
            logger.debug(f"Publishing domain scored event for {result.assessmentId}")
            print(f"DEBUG: _publish_domain_scored_event called - assessment_id: {result.assessmentId}")
            
            # Create event structure
            event = EventFactory.create_domain_scored_event(
                assessment_id=result.assessmentId,
                domain="human_centricity",
                scores={
                    "overall_score": result.overallScore,
                    "domain_scores": result.domainScores,
                    "detailed_metrics": result.detailedMetrics
                },
                score_value=result.overallScore,
                processing_time_ms=result.processingTimeMs
            )
            
            logger.debug(f"Created domain scored event: {event}")
            print(f"DEBUG: Created domain scored event with overall score: {result.overallScore}")
            
            await self.producer.send(settings.human_centricity_scores_topic, event.dict())
            logger.info(f"Published domain scored event for assessment {result.assessmentId}")
            print(f"DEBUG: ✅ Successfully published domain scored event to {settings.human_centricity_scores_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish domain scored event: {e}", exc_info=True)
            print(f"DEBUG: ❌ Failed to publish domain scored event: {type(e).__name__}: {e}")
    
    async def _publish_error_event(self, assessment_id: Optional[str], error_type: str, error_message: str):
        """Publish error event"""
        try:
            logger.debug(f"Publishing error event for {assessment_id}: {error_type}")
            print(f"DEBUG: _publish_error_event called - assessment_id: {assessment_id}, error_type: {error_type}")
            
            event = EventFactory.create_error_event(
                assessment_id=assessment_id or "unknown",
                error_type=error_type,
                error_message=error_message,
                domain="human_centricity"
            )
            
            logger.debug(f"Created error event: {event}")
            print(f"DEBUG: Created error event: {event.dict()}")
            
            await self.producer.send(settings.error_events_topic, event.dict())
            logger.info(f"Published error event for assessment {assessment_id}: {error_type}")
            print(f"DEBUG: ✅ Successfully published error event to {settings.error_events_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish error event: {e}", exc_info=True)
            print(f"DEBUG: ❌ Failed to publish error event: {type(e).__name__}: {e}")
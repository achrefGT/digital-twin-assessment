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
    ImprovedDigitalTwinConfig, ConcreteOperationalData, 
    RegionalParameters, IndustryType
)
from .score import ComprehensiveDigitalTwinLCAFramework
from .database import DatabaseManager
from .config import settings

logger = logging.getLogger(__name__)


class ELCAKafkaHandler:
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.consumer = None
        self.producer = None
        self.running = False
        self.lca_framework = None
        
    async def start(self):
        """Start Kafka consumer and producer"""
        try:
            # Initialize consumer for form submissions
            self.consumer = await create_kafka_consumer(
                topics=[settings.elca_submission_topic],
                group_id=settings.kafka_consumer_group_id,
                auto_offset_reset=settings.kafka_auto_offset_reset
            )
            
            # Initialize producer for results
            self.producer = await create_kafka_producer()
            
            # Initialize LCA framework
            if settings.enable_impact_method_setup:
                try:
                    self.lca_framework = ComprehensiveDigitalTwinLCAFramework(
                        project_name=settings.brightway_project_name
                    )
                    logger.info("LCA framework initialized successfully")
                except Exception as e:
                    logger.warning(f"Failed to initialize LCA framework: {e}. Will try per assessment.")
                    self.lca_framework = None
            
            self.running = True
            logger.info("ELCA Kafka handler started successfully")
            
        except Exception as e:
            logger.error(f"Failed to start ELCA Kafka handler: {e}")
            raise KafkaConnectionException(f"Failed to connect to Kafka: {e}")
    
    async def stop(self):
        """Stop Kafka consumer and producer"""
        self.running = False
        
        try:
            if self.consumer:
                await self.consumer.stop()
            if self.producer:
                await self.producer.stop()
            logger.info("ELCA Kafka handler stopped successfully")
        except Exception as e:
            logger.error(f"Error stopping ELCA Kafka handler: {e}")
    
    def is_running(self) -> bool:
        """Check if Kafka handler is running"""
        return self.running
    
    async def consume_messages(self):
        """Main consumer loop"""
        logger.info("Starting ELCA Kafka message consumer")
        print("DEBUG: 🚀 Starting ELCA Kafka message consumer loop")
        
        while self.running:
            try:
                print(f"DEBUG: ELCA Consumer loop iteration - running: {self.running}")
                async for message in self.consumer:
                    logger.debug(f"Received ELCA message: {message}")
                    print(f"DEBUG: 📨 Received ELCA Kafka message - topic: {message.topic}, partition: {message.partition}, offset: {message.offset}")
                    print(f"DEBUG: Message value type: {type(message.value)}")
                    await self._process_message(message.value)
            except Exception as e:
                logger.error(f"Error in ELCA consumer loop: {e}")
                print(f"DEBUG: ❌ Error in ELCA consumer loop: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
                if self.running:  # Only retry if we're still supposed to be running
                    print("DEBUG: Waiting 5 seconds before retrying...")
                    await asyncio.sleep(5)  # Wait before retrying
    
    async def _process_message(self, message_data: Dict[str, Any]):
        """Process incoming ELCA form submission message"""
        assessment_id = None
        
        try:
            # Debug: Print the entire message structure
            logger.debug(f"Raw ELCA message data received: {message_data}")
            print(f"DEBUG: Raw ELCA message keys: {list(message_data.keys()) if message_data else 'None'}")
            print(f"DEBUG: Message event_type: {message_data.get('event_type', 'Missing')}")
            
            # Parse the incoming event
            if message_data.get('event_type') != EventType.FORM_SUBMITTED:
                logger.debug(f"Ignoring message with event_type: {message_data.get('event_type')}")
                return
            
            # Extract submission data and ensure it's properly structured
            submission_data = message_data.get('submission', {})
            logger.debug(f"Extracted ELCA submission data: {submission_data}")
            print(f"DEBUG: ELCA Submission data keys: {list(submission_data.keys()) if submission_data else 'None'}")
            print(f"DEBUG: ELCA Submission data type: {type(submission_data)}")
            
            if not submission_data:
                logger.warning("No submission data found in ELCA message")
                print("DEBUG: No ELCA submission data - returning early")
                return
            
            # Create FormSubmissionRequest from the submission data
            from shared.models.assessment import FormSubmissionRequest
            logger.debug("Creating FormSubmissionRequest from ELCA submission data")
            print(f"DEBUG: About to create FormSubmissionRequest with ELCA data: {submission_data}")
            
            try:
                form_submission = FormSubmissionRequest(**submission_data)
                logger.debug(f"Successfully created FormSubmissionRequest: {form_submission}")
                print(f"DEBUG: Created ELCA form_submission - domain: {form_submission.domain}")
                print(f"DEBUG: Created ELCA form_submission - assessment_id: {form_submission.assessment_id}")
            except Exception as e:
                logger.error(f"Failed to create FormSubmissionRequest for ELCA: {e}")
                print(f"DEBUG: ELCA FormSubmissionRequest creation failed: {e}")
                print(f"DEBUG: ELCA Submission data that failed: {submission_data}")
                raise
            
            # Check if this message contains ELCA data
            if form_submission.domain != 'elca':
                logger.debug(f"Ignoring message for domain: {form_submission.domain}")
                print(f"DEBUG: Wrong domain '{form_submission.domain}', expected 'elca'")
                return
                
            assessment_id = form_submission.assessment_id
            logger.info(f"Processing ELCA form submission for assessment {assessment_id}")
            print(f"DEBUG: Processing ELCA assessment_id: {assessment_id}")
            
            start_time = datetime.utcnow()
            
            # Parse ELCA configuration
            logger.debug("Parsing ELCA configuration")
            print(f"DEBUG: About to parse ELCA configuration for assessment {assessment_id}")
            elca_config = self._parse_elca_configuration(form_submission)
            
            # Initialize LCA framework if not already done
            if self.lca_framework is None:
                try:
                    self.lca_framework = ComprehensiveDigitalTwinLCAFramework(
                        project_name=settings.brightway_project_name
                    )
                    logger.info("LCA framework initialized during processing")
                except Exception as e:
                    logger.error(f"Failed to initialize LCA framework: {e}")
                    raise ScoringException(f"LCA framework initialization failed: {e}")
            
            # Run comprehensive ELCA assessment
            logger.debug("Running comprehensive ELCA assessment")
            print(f"DEBUG: About to run ELCA assessment for config: {elca_config.name}")
            lca_results = self.lca_framework.run_comprehensive_assessment(elca_config)
            logger.debug(f"LCA assessment completed: {list(lca_results.keys())}")
            print(f"DEBUG: LCA results keys: {list(lca_results.keys()) if lca_results else 'None'}")
            
            # Calculate processing time
            processing_time = (datetime.utcnow() - start_time).total_seconds() * 1000
            logger.debug(f"ELCA Processing time: {processing_time}ms")
            print(f"DEBUG: ELCA Processing time: {processing_time}ms")
            
            # Add processing metadata
            lca_results['assessment_id'] = assessment_id  # The UUID from form_submission
            lca_results['processing_time_ms'] = processing_time
            lca_results['submitted_at'] = datetime.utcnow().isoformat()
            lca_results['user_id'] = form_submission.user_id
            lca_results['raw_configuration'] = elca_config.__dict__
            
            logger.debug("ELCA assessment result prepared")
            print(f"DEBUG: ELCA result overall score: {lca_results.get('key_performance_indicators', {}).get('overall_elca_score', 'N/A')}")
            
            # Save to database
            logger.debug("Preparing to save ELCA assessment to database")
            print(f"DEBUG: Saving ELCA assessment {assessment_id} to database")
            
            self.db_manager.save_assessment(lca_results)
            logger.debug("Successfully saved ELCA assessment to database")
            print(f"DEBUG: Successfully saved ELCA assessment {assessment_id} to database")
            
            # Publish success event
            logger.debug("Publishing ELCA domain scored event")
            print(f"DEBUG: Publishing ELCA success event for assessment {assessment_id}")
            await self._publish_domain_scored_event(lca_results, assessment_id, processing_time)
            
            logger.info(f"Successfully processed ELCA assessment {assessment_id} in {processing_time:.2f}ms")
            print(f"DEBUG: ✅ COMPLETE - Successfully processed ELCA assessment {assessment_id}")
            
        except InvalidFormDataException as e:
            logger.error(f"Invalid ELCA form data for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ InvalidFormDataException for ELCA {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "invalid_form_data", str(e))
            
        except ScoringException as e:
            logger.error(f"ELCA scoring error for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ ELCA ScoringException for {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "elca_scoring_error", str(e))
            
        except DatabaseConnectionException as e:
            logger.error(f"Database error for ELCA assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ DatabaseConnectionException for ELCA {assessment_id}: {e}")
            await self._publish_error_event(assessment_id, "database_error", str(e))
            
        except Exception as e:
            logger.error(f"Unexpected error processing ELCA message for assessment {assessment_id}: {e}")
            print(f"DEBUG: ❌ Unexpected ELCA error for {assessment_id}: {type(e).__name__}: {e}")
            print(f"DEBUG: Error traceback: {e.__class__.__module__}.{e.__class__.__name__}")
            import traceback
            traceback.print_exc()
            await self._publish_error_event(assessment_id, "processing_error", str(e))
    
    def _parse_elca_configuration(self, form_submission) -> ImprovedDigitalTwinConfig:
        """Parse form submission into ELCA configuration model"""
        try:
            logger.debug(f"Parsing ELCA form submission: {form_submission}")
            print(f"DEBUG: _parse_elca_configuration called with type: {type(form_submission)}")
            print(f"DEBUG: form_submission.__dict__: {form_submission.__dict__ if hasattr(form_submission, '__dict__') else 'No __dict__'}")
            
            # form_submission is now guaranteed to be a FormSubmissionRequest object
            form_data = form_submission.form_data
            logger.debug(f"Extracted ELCA form_data: {form_data}")
            print(f"DEBUG: ELCA form_data type: {type(form_data)}")
            print(f"DEBUG: ELCA form_data keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'Not a dict'}")
            
            # Validate required fields for ELCA configuration
            required_fields = ['name', 'industry_type', 'operational_data', 'regional_params']
            for field in required_fields:
                if field not in form_data:
                    logger.error(f"Missing '{field}' field in ELCA form data")
                    print(f"DEBUG: ❌ Missing '{field}' field. Available keys: {list(form_data.keys()) if isinstance(form_data, dict) else 'N/A'}")
                    raise InvalidFormDataException(f"Missing '{field}' field in ELCA form data")
            
            # Parse operational data
            operational_data_raw = form_data['operational_data']
            logger.debug(f"Operational data: {operational_data_raw}")
            print(f"DEBUG: operational_data type: {type(operational_data_raw)}")
            
            operational_data = ConcreteOperationalData(
                annual_production_volume=operational_data_raw.get('annual_production_volume', 10000),
                operating_hours_per_year=operational_data_raw.get('operating_hours_per_year', 8760),
                factory_floor_area_m2=operational_data_raw.get('factory_floor_area_m2', 5000.0),
                annual_electricity_kwh=operational_data_raw.get('annual_electricity_kwh', 1000000.0),
                electricity_peak_demand_kw=operational_data_raw.get('electricity_peak_demand_kw', 500.0),
                server_count=operational_data_raw.get('server_count', 10),
                server_avg_power_watts=operational_data_raw.get('server_avg_power_watts', 300.0),
                iot_sensor_count=operational_data_raw.get('iot_sensor_count', 100),
                iot_power_per_sensor_mw=operational_data_raw.get('iot_power_per_sensor_mw', 0.05),
                daily_data_generation_gb=operational_data_raw.get('daily_data_generation_gb', 50.0),
                data_retention_years=operational_data_raw.get('data_retention_years', 3),
                network_bandwidth_mbps=operational_data_raw.get('network_bandwidth_mbps', 1000),
                annual_maintenance_hours=operational_data_raw.get('annual_maintenance_hours', 500),
                maintenance_energy_kwh_per_hour=operational_data_raw.get('maintenance_energy_kwh_per_hour', 15.0)
            )
            
            # Parse regional parameters
            regional_params_raw = form_data['regional_params']
            logger.debug(f"Regional parameters: {regional_params_raw}")
            print(f"DEBUG: regional_params type: {type(regional_params_raw)}")
            
            regional_params = RegionalParameters(
                grid_carbon_intensity_kg_co2_per_kwh=regional_params_raw.get('grid_carbon_intensity_kg_co2_per_kwh', 0.5),
                grid_renewable_percentage=regional_params_raw.get('grid_renewable_percentage', 30.0),
                water_stress_factor=regional_params_raw.get('water_stress_factor', 1.0),
                water_energy_intensity_kwh_per_m3=regional_params_raw.get('water_energy_intensity_kwh_per_m3', 0.5),
                regional_recycling_rate=regional_params_raw.get('regional_recycling_rate', 50.0),
                electricity_price_per_kwh=regional_params_raw.get('electricity_price_per_kwh', 0.15),
                carbon_price_per_ton=regional_params_raw.get('carbon_price_per_ton', 50.0)
            )
            
            # Parse industry type
            industry_type_str = form_data.get('industry_type', 'automotive')
            try:
                industry_type = IndustryType(industry_type_str)
            except ValueError:
                logger.warning(f"Invalid industry type '{industry_type_str}', defaulting to automotive")
                industry_type = IndustryType.AUTOMOTIVE
            
            # Create ELCA configuration
            elca_config = ImprovedDigitalTwinConfig(
                name=form_data['name'],
                industry_type=industry_type,
                operational_data=operational_data,
                regional_params=regional_params,
                assessment_years=form_data.get('assessment_years', settings.default_assessment_years),
                functional_unit_description=form_data.get('functional_unit_description', "Annual production with digital twin system")
            )
            
            logger.debug(f"Created ELCA configuration: {elca_config}")
            print(f"DEBUG: ✅ Successfully created ELCA configuration for {elca_config.name}")
            return elca_config
            
        except Exception as e:
            logger.error(f"Failed to parse ELCA form data: {e}")
            print(f"DEBUG: ❌ _parse_elca_configuration failed: {type(e).__name__}: {e}")
            if hasattr(form_submission, '__dict__'):
                print(f"DEBUG: form_submission details: {form_submission.__dict__}")
            import traceback
            traceback.print_exc()
            raise InvalidFormDataException(f"Failed to parse ELCA form data: {e}")
    
    async def _publish_domain_scored_event(self, lca_results: Dict[str, Any], assessment_id: str, processing_time_ms: float):
        """Publish ELCA domain scored event"""
        try:
            logger.debug(f"Publishing ELCA domain scored event for {assessment_id}")
            print(f"DEBUG: _publish_domain_scored_event called for ELCA {assessment_id}")
            
            # Extract ELCA score details
            elca_scores = lca_results.get('elca_scores', {})
            recommended_score = elca_scores.get('recommended_score', {})
            overall_score = lca_results.get('key_performance_indicators', {}).get('overall_elca_score', 0.0)
            
            event = EventFactory.create_domain_scored_event(
                assessment_id=assessment_id,
                domain="elca",
                scores={
                    "elca_score": overall_score,
                    "environmental_rating": recommended_score.get('rating', 'Unknown'),
                    "category_breakdown": recommended_score.get('category_breakdown', {}),
                    "performance_analysis": recommended_score.get('performance_analysis', {}),
                    "key_performance_indicators": lca_results.get('key_performance_indicators', {})
                },
                score_value=overall_score,
                processing_time_ms=processing_time_ms
            )
            
            logger.debug(f"Created ELCA event: {event}")
            print(f"DEBUG: Created ELCA domain scored event: {event.dict()}")
            
            await self.producer.send(settings.elca_scores_topic, event.dict())
            logger.info(f"Published ELCA domain scored event for assessment {assessment_id}")
            print(f"DEBUG: ✅ Successfully published ELCA domain scored event to {settings.elca_scores_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish ELCA domain scored event: {e}")
            print(f"DEBUG: ❌ Failed to publish ELCA domain scored event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
    
    async def _publish_error_event(self, assessment_id: Optional[str], error_type: str, error_message: str):
        """Publish ELCA error event"""
        try:
            logger.debug(f"Publishing ELCA error event for {assessment_id}: {error_type}")
            print(f"DEBUG: _publish_error_event called for ELCA - assessment_id: {assessment_id}, error_type: {error_type}")
            
            event = EventFactory.create_error_event(
                assessment_id=assessment_id or "unknown",
                error_type=error_type,
                error_message=error_message,
                domain="elca"
            )
            
            logger.debug(f"Created ELCA error event: {event}")
            print(f"DEBUG: Created ELCA error event: {event.dict()}")
            
            await self.producer.send(settings.error_events_topic, event.dict())
            logger.info(f"Published ELCA error event for assessment {assessment_id}: {error_type}")
            print(f"DEBUG: ✅ Successfully published ELCA error event to {settings.error_events_topic}")
            
        except Exception as e:
            logger.error(f"Failed to publish ELCA error event: {e}")
            print(f"DEBUG: ❌ Failed to publish ELCA error event: {type(e).__name__}: {e}")
            import traceback
            traceback.print_exc()
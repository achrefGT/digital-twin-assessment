from typing import List, Optional, Dict, Any
import logging
from .database import DatabaseManager, ResilienceScenario
from .models import ScenarioCreate, ScenarioUpdate, ScenarioResponse, ResilienceDomain, RESILIENCE_SCENARIOS, DEFAULT_RESILIENCE_SCENARIOS

logger = logging.getLogger(__name__)


class ScenarioManager:
    """Service for managing resilience scenarios"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
    
    def get_all_scenarios(self) -> List[ScenarioResponse]:
        """Get all scenarios formatted as responses"""
        try:
            scenarios = self.db_manager.get_all_scenarios()
            return [self._to_response(scenario) for scenario in scenarios]
        except Exception as e:
            logger.error(f"Failed to get all scenarios: {e}")
            raise
    
    def get_scenarios_by_domain(self, domain: str) -> List[ScenarioResponse]:
        """Get scenarios for a specific domain"""
        try:
            scenarios = self.db_manager.get_scenarios_by_domain(domain)
            return [self._to_response(scenario) for scenario in scenarios]
        except Exception as e:
            logger.error(f"Failed to get scenarios for domain {domain}: {e}")
            raise
    
    def create_scenario(self, scenario_create: ScenarioCreate) -> ScenarioResponse:
        """Create a new scenario"""
        try:
            scenario_data = {
                'domain': scenario_create.domain,
                'scenario_text': scenario_create.scenario_text,
                'description': scenario_create.description,
                'is_default': scenario_create.is_default
            }
            
            scenario = self.db_manager.create_scenario(scenario_data)
            return self._to_response(scenario)
        except Exception as e:
            logger.error(f"Failed to create scenario: {e}")
            raise
    
    def update_scenario(self, scenario_id: str, scenario_update: ScenarioUpdate) -> Optional[ScenarioResponse]:
        """Update an existing scenario"""
        try:
            update_data = {}
            if scenario_update.scenario_text is not None:
                update_data['scenario_text'] = scenario_update.scenario_text
            if scenario_update.domain is not None:
                update_data['domain'] = scenario_update.domain
            
            scenario = self.db_manager.update_scenario(scenario_id, update_data)
            return self._to_response(scenario) if scenario else None
        except Exception as e:
            logger.error(f"Failed to update scenario {scenario_id}: {e}")
            raise
    
    def delete_scenario(self, scenario_id: str) -> bool:
        """Delete a scenario"""
        try:
            return self.db_manager.delete_scenario(scenario_id)
        except Exception as e:
            logger.error(f"Failed to delete scenario {scenario_id}: {e}")
            raise
    
    def get_current_scenarios_config(self) -> Dict[str, Any]:
        """Get current scenarios configuration (compatible with existing code)"""
        try:
            # This returns the format expected by existing code
            return {
                'scenarios': {
                    domain: data['scenarios'] 
                    for domain, data in RESILIENCE_SCENARIOS.items()
                },
                'domain_descriptions': {
                    domain: data.get('description', '') 
                    for domain, data in RESILIENCE_SCENARIOS.items()
                }
            }
        except Exception as e:
            logger.error(f"Failed to get scenarios configuration: {e}")
            raise
    
    def reset_to_defaults(self, domain: Optional[str] = None) -> bool:
        """Reset scenarios to defaults for a domain or all domains"""
        try:
            if domain:
                # Reset specific domain
                if domain not in DEFAULT_RESILIENCE_SCENARIOS:
                    logger.error(f"Domain {domain} not found in defaults")
                    return False
                
                # Delete existing scenarios for this domain
                scenarios = self.db_manager.get_scenarios_by_domain(domain)
                for scenario in scenarios:
                    self.db_manager.delete_scenario(scenario.id)
                
                # Add default scenarios
                domain_data = DEFAULT_RESILIENCE_SCENARIOS[domain]
                for scenario_text in domain_data['scenarios']:
                    scenario_data = {
                        'domain': domain,
                        'scenario_text': scenario_text,
                        'description': domain_data['description'],
                        'is_default': True
                    }
                    self.db_manager.create_scenario(scenario_data)
                
                logger.info(f"Reset scenarios for domain {domain} to defaults")
            else:
                # Reset all domains
                all_scenarios = self.db_manager.get_all_scenarios()
                for scenario in all_scenarios:
                    self.db_manager.delete_scenario(scenario.id)
                
                # Re-initialize defaults
                self.db_manager._initialize_default_scenarios()
                
                logger.info("Reset all scenarios to defaults")
            
            return True
        except Exception as e:
            logger.error(f"Failed to reset scenarios: {e}")
            return False
    
    def validate_assessments_compatibility(self, assessments: Dict[str, Any]) -> Dict[str, List[str]]:
        """Validate that assessment scenarios exist in current configuration"""
        missing_scenarios = {}
        
        try:
            current_config = self.get_current_scenarios_config()
            
            for domain, domain_assessment in assessments.items():
                if domain not in current_config['scenarios']:
                    missing_scenarios[domain] = ["Domain not found"]
                    continue
                
                domain_scenarios = current_config['scenarios'][domain]
                missing_for_domain = []
                
                if hasattr(domain_assessment, 'scenarios'):
                    for scenario_text in domain_assessment.scenarios.keys():
                        if scenario_text not in domain_scenarios:
                            missing_for_domain.append(scenario_text)
                
                if missing_for_domain:
                    missing_scenarios[domain] = missing_for_domain
            
            return missing_scenarios
        except Exception as e:
            logger.error(f"Failed to validate assessments compatibility: {e}")
            return {"validation_error": [str(e)]}
    
    def _to_response(self, scenario: ResilienceScenario) -> ScenarioResponse:
        """Convert database model to response model"""
        return ScenarioResponse(
            id=scenario.id,
            domain=scenario.domain,
            scenario_text=scenario.scenario_text,
            description=scenario.description,
            is_default=scenario.is_default,
            created_at=scenario.created_at,
            updated_at=scenario.updated_at
        )
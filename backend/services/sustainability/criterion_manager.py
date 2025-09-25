from typing import List, Optional, Dict, Any, Union
import logging
import re

from .database import DatabaseManager, SustainabilityCriterion
from .models import (
    CriterionCreate, CriterionUpdate, CriterionResponse,
    SustainabilityDomain, SUSTAINABILITY_SCENARIOS, DEFAULT_SUSTAINABILITY_SCENARIOS
)

logger = logging.getLogger(__name__)


class CriterionManager:
    """Service for managing sustainability criteria"""
    
    PREFIX_MAP = {
        "environmental": "ENV",
        "economic": "ECO",
        "social": "SOC",
    }

    KEY_RE = re.compile(r"([A-Z]+)_(\d+)$")  # captures prefix and numeric suffix

    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager

    def get_all_criteria(self) -> List[CriterionResponse]:
        """Get all criteria formatted as responses"""
        try:
            criteria = self.db_manager.get_all_criteria()
            return [self._to_response(criterion) for criterion in criteria]
        except Exception:
            logger.exception("Failed to get all criteria")
            raise

    def get_criteria_by_domain(self, domain: Union[str, SustainabilityDomain]) -> List[CriterionResponse]:
        """Get criteria for a specific domain"""
        try:
            domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)
            criteria = self.db_manager.get_criteria_by_domain(domain_str)
            return [self._to_response(c) for c in criteria]
        except Exception:
            logger.exception("Failed to get criteria for domain %s", domain)
            raise

    def generate_criterion_key(self, domain: Union[str, SustainabilityDomain]) -> str:
        """Generate the next criterion key for a domain, e.g. 'ENV_01'."""
        try:
            domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)
            domain_key = domain_str.lower()

            if domain_key not in self.PREFIX_MAP:
                raise ValueError(f"Unknown domain for key generation: {domain_str}")

            prefix = self.PREFIX_MAP[domain_key]

            # fetch existing criteria (as responses)
            existing = self.get_criteria_by_domain(domain_str)
            existing_keys = [c.criterion_key for c in existing if getattr(c, "criterion_key", None)]

            max_num = 0
            for k in existing_keys:
                m = self.KEY_RE.search(k)
                if m and m.group(1) == prefix:
                    try:
                        num = int(m.group(2))
                        if num > max_num:
                            max_num = num
                    except ValueError:
                        continue

            next_num = max_num + 1
            return f"{prefix}_{next_num:02d}"
        except Exception:
            logger.exception("Failed to generate criterion key for domain %s", domain)
            raise

    def create_criterion(self, criterion_create: CriterionCreate) -> CriterionResponse:
        """Create a new criterion. If criterion_key not provided, generate one."""
        try:
            domain = criterion_create.domain
            # normalize domain for comparisons
            domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)

            # ensure key exists or generate
            key = getattr(criterion_create, "criterion_key", None) or self.generate_criterion_key(domain_str)

            # check uniqueness in domain
            existing = self.get_criteria_by_domain(domain_str)
            if any(e.criterion_key == key for e in existing):
                raise ValueError(f"Criterion key '{key}' already exists in domain '{domain_str}'")

            criterion_data = {
                "criterion_key": key,
                "name": criterion_create.name,
                "description": criterion_create.description,
                "domain": domain_str,
                "level_count": criterion_create.level_count,
                "custom_levels": criterion_create.custom_levels,
                "is_default": bool(getattr(criterion_create, "is_default", False)),
            }

            created = self.db_manager.create_criterion(criterion_data)
            return self._to_response(created)
        except Exception:
            logger.exception("Failed to create criterion")
            raise

    def update_criterion(self, criterion_id: str, criterion_update: CriterionUpdate) -> Optional[CriterionResponse]:
        """Update an existing criterion (does not change criterion_key or domain)."""
        try:
            update_data: Dict[str, Any] = {}
            if criterion_update.name is not None:
                update_data["name"] = criterion_update.name
            if criterion_update.description is not None:
                update_data["description"] = criterion_update.description
            if criterion_update.custom_levels is not None:
                update_data["custom_levels"] = criterion_update.custom_levels
            if criterion_update.level_count is not None:
                update_data["level_count"] = criterion_update.level_count

            criterion = self.db_manager.update_criterion(criterion_id, update_data)
            return self._to_response(criterion) if criterion else None
        except Exception:
            logger.exception("Failed to update criterion %s", criterion_id)
            raise

    def delete_criterion(self, criterion_id: str) -> bool:
        """Delete a criterion"""
        try:
            return self.db_manager.delete_criterion(criterion_id)
        except Exception:
            logger.exception("Failed to delete criterion %s", criterion_id)
            raise

    def get_current_scenarios_config(self) -> Dict[str, Any]:
        """Get current scenarios configuration (compatible with existing code)"""
        try:
            return {"scenarios": SUSTAINABILITY_SCENARIOS}
        except Exception:
            logger.exception("Failed to get scenarios configuration")
            raise

    def reset_to_defaults(self, domain: Optional[Union[str, SustainabilityDomain]] = None) -> bool:
        """Reset criteria to defaults for a domain or all domains."""
        try:
            if domain:
                domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)
                domain_key = domain_str
                if domain_key not in DEFAULT_SUSTAINABILITY_SCENARIOS:
                    logger.error("Domain %s not found in defaults", domain_key)
                    return False

                # delete existing for domain
                criteria = self.db_manager.get_criteria_by_domain(domain_key)
                for c in criteria:
                    self.db_manager.delete_criterion(c.id)

                domain_data = DEFAULT_SUSTAINABILITY_SCENARIOS[domain_key]
                for criterion_key, criterion_data in domain_data.get("criteria", {}).items():
                    cdata = {
                        "criterion_key": criterion_key,
                        "name": criterion_data.get("name"),
                        "description": criterion_data.get("description"),
                        "domain": domain_key,
                        "level_count": len(criterion_data.get("levels", [])),
                        "custom_levels": criterion_data.get("levels", []),
                        "is_default": True,
                    }
                    self.db_manager.create_criterion(cdata)

                logger.info("Reset criteria for domain %s to defaults", domain_key)
            else:
                # delete all
                all_criteria = self.db_manager.get_all_criteria()
                for c in all_criteria:
                    self.db_manager.delete_criterion(c.id)

                # reinitialize defaults (if db_manager exposes such API)
                if hasattr(self.db_manager, "_initialize_default_criteria"):
                    self.db_manager._initialize_default_criteria()
                else:
                    # fallback: create from DEFAULT_SUSTAINABILITY_SCENARIOS
                    for domain_key, domain_data in DEFAULT_SUSTAINABILITY_SCENARIOS.items():
                        for criterion_key, criterion_data in domain_data.get("criteria", {}).items():
                            cdata = {
                                "criterion_key": criterion_key,
                                "name": criterion_data.get("name"),
                                "description": criterion_data.get("description"),
                                "domain": domain_key,
                                "level_count": len(criterion_data.get("levels", [])),
                                "custom_levels": criterion_data.get("levels", []),
                                "is_default": True,
                            }
                            self.db_manager.create_criterion(cdata)

                logger.info("Reset all criteria to defaults")
            return True
        except Exception:
            logger.exception("Failed to reset criteria")
            return False

    def validate_assessments_compatibility(self, assessments: Dict[str, Any]) -> Dict[str, List[str]]:
        """
        Validate that assessment criteria exist in current configuration.
        `assessments` is expected to be a dict mapping domain -> assessment-data (dict or object).
        Returns dict mapping domain -> list of missing criterion keys (empty dict if all OK).
        """
        missing_criteria: Dict[str, List[str]] = {}
        try:
            current_config = self.get_current_scenarios_config()
            scenarios = current_config.get("scenarios", {})

            for domain, domain_assessment in assessments.items():
                if domain not in scenarios:
                    missing_criteria[domain] = ["Domain not found"]
                    continue

                domain_criteria = scenarios[domain].get("criteria", {})
                # extract assessment fields robustly
                if isinstance(domain_assessment, dict):
                    assessment_fields = set(domain_assessment.keys())
                else:
                    # try dataclass-like or object with attributes
                    try:
                        assessment_fields = set(vars(domain_assessment).keys())
                    except Exception:
                        # fallback: try dir() and filter callables/private
                        assessment_fields = {
                            attr for attr in dir(domain_assessment)
                            if not attr.startswith("_") and not callable(getattr(domain_assessment, attr, None))
                        }

                missing_for_domain = [f for f in assessment_fields if f not in domain_criteria]
                if missing_for_domain:
                    missing_criteria[domain] = missing_for_domain

            return missing_criteria
        except Exception:
            logger.exception("Failed to validate assessments compatibility")
            return {"validation_error": ["internal error"]}

    def get_criterion_by_key(self, domain: Union[str, SustainabilityDomain], criterion_key: str) -> Optional[CriterionResponse]:
        """Get a specific criterion by domain and key"""
        try:
            domain_str = domain.value if isinstance(domain, SustainabilityDomain) else str(domain)
            criteria = self.get_criteria_by_domain(domain_str)
            for criterion in criteria:
                if criterion.criterion_key == criterion_key:
                    return self._to_response(criterion) if not isinstance(criterion, CriterionResponse) else criterion
            return None
        except Exception:
            logger.exception("Failed to get criterion %s for domain %s", criterion_key, domain)
            raise

    def _to_response(self, criterion: SustainabilityCriterion) -> CriterionResponse:
        """Convert database model to response model"""
        return CriterionResponse(
            id=criterion.id,
            criterion_key=criterion.criterion_key,
            name=criterion.name,
            description=criterion.description,
            domain=criterion.domain,
            level_count=criterion.level_count,
            custom_levels=criterion.custom_levels,
            is_default=criterion.is_default,
            created_at=getattr(criterion, "created_at", None),
            updated_at=getattr(criterion, "updated_at", None),
        )

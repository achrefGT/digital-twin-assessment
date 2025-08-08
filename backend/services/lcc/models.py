# DigitalTwinCosts, DigitalTwinBenefits, IndustryType
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from datetime import datetime

from pydantic import BaseModel, ValidationError, Field

class IndustryType(Enum):
    """Industry types with different cost/benefit profiles"""
    MANUFACTURING = "manufacturing"
    ENERGY = "energy"
    AEROSPACE = "aerospace"
    AUTOMOTIVE = "automotive"


# Pydantic models for API
class CostStructure(BaseModel):
    dt_software_license: List[float] = Field(..., description="Annual DT software licensing costs")
    cloud_computing: List[float] = Field(..., description="Cloud/edge computing costs")
    data_storage: List[float] = Field(..., description="Data storage and management costs")
    sensor_hardware: List[float] = Field(..., description="IoT sensors and devices costs")
    networking_infra: List[float] = Field(..., description="Network infrastructure costs")
    edge_devices: List[float] = Field(..., description="Edge computing hardware costs")
    integration_costs: List[float] = Field(..., description="Systems integration costs")
    customization: List[float] = Field(..., description="Custom development costs")
    training: List[float] = Field(..., description="Staff training and change management costs")
    dt_maintenance: List[float] = Field(..., description="DT-specific maintenance costs")
    cybersecurity: List[float] = Field(..., description="Security and compliance costs")
    data_management: List[float] = Field(..., description="Data governance and quality costs")
    energy_costs: List[float] = Field(..., description="Energy costs")
    maintenance_costs: List[float] = Field(..., description="Traditional maintenance costs")
    downtime_costs: List[float] = Field(..., description="Downtime costs")
    replacement_costs: List[float] = Field(..., description="Equipment replacement costs")


class BenefitStructure(BaseModel):
    predictive_maintenance_savings: List[float] = Field(..., description="Reduced unplanned downtime")
    maintenance_optimization: List[float] = Field(..., description="Optimized maintenance schedules")
    process_efficiency_gains: List[float] = Field(..., description="Process improvements")
    energy_optimization: List[float] = Field(..., description="Energy efficiency gains")
    quality_improvements: List[float] = Field(..., description="Quality cost reductions")
    reduced_prototype_costs: List[float] = Field(..., description="Virtual prototyping savings")
    faster_time_to_market: List[float] = Field(..., description="Time-to-market benefits")
    risk_mitigation_value: List[float] = Field(..., description="Risk avoidance value")
    compliance_savings: List[float] = Field(..., description="Regulatory compliance benefits")
    inventory_optimization: List[float] = Field(..., description="Inventory cost reductions")
    supply_chain_optimization: List[float] = Field(..., description="Supply chain improvements")
    innovation_value: List[float] = Field(..., description="Innovation-driven value")
    competitive_advantage: List[float] = Field(..., description="Market position benefits")


class LCCInput(BaseModel):
    analysisId: Optional[str] = Field(None, description="Unique identifier for the analysis")
    userId: Optional[str] = Field(None, description="User identifier")
    systemName: Optional[str] = Field(None, description="Name of the system being analyzed")
    projectName: Optional[str] = Field(None, description="Project name")
    industry: IndustryType = Field(IndustryType.MANUFACTURING, description="Industry type")
    capex: float = Field(..., description="Capital expenditure", gt=0)
    costs: CostStructure = Field(..., description="Cost structure")
    benefits: BenefitStructure = Field(..., description="Benefit structure")
    discount_rate: float = Field(0.08, description="Discount rate", ge=0, le=1)
    start_year: int = Field(2025, description="Analysis start year", ge=2020, le=2050)
    roi_bounds: tuple[float, float] = Field((0.0, 1.5), description="ROI normalization bounds")
    submittedAt: Optional[datetime] = Field(None, description="Timestamp when analysis was submitted")
    metadata: Optional[Dict[str, any]] = Field(default_factory=dict, description="Additional metadata")


class LCCResult(BaseModel):
    analysisId: str
    npv: Optional[float]
    irr: Optional[float]
    payback_period: Optional[int]
    roi: Optional[float]
    economic_sustainability_score: float
    sustainability_rating: str
    dt_implementation_maturity: float
    benefit_cost_ratio: float
    transformation_readiness: float
    score_components: Dict[str, float]
    industry_type: str
    timestamp: datetime
    processingTimeMs: float


class IndustryInfo(BaseModel):
    types: List[str]
    factors: Dict[str, Dict[str, float]]


@dataclass
class DigitalTwinCosts:
    """Digital twin specific cost structure"""
    # Software & Licensing
    dt_software_license: List[float]  # Annual DT software licensing
    cloud_computing: List[float]      # Cloud/edge computing costs
    data_storage: List[float]         # Data storage and management
    
    # Hardware & Infrastructure
    sensor_hardware: List[float]      # IoT sensors and devices
    networking_infra: List[float]     # Network infrastructure
    edge_devices: List[float]         # Edge computing hardware
    
    # Implementation & Integration
    integration_costs: List[float]    # Systems integration
    customization: List[float]        # Custom development
    training: List[float]             # Staff training and change management
    
    # Operations & Maintenance
    dt_maintenance: List[float]       # DT-specific maintenance
    cybersecurity: List[float]        # Security and compliance
    data_management: List[float]      # Data governance and quality
    
    # Traditional Costs (from original)
    energy_costs: List[float]
    maintenance_costs: List[float]
    downtime_costs: List[float]
    replacement_costs: List[float]


@dataclass
class DigitalTwinBenefits:
    """Digital twin specific benefits structure"""
    # Predictive Maintenance
    predictive_maintenance_savings: List[float]  # Reduced unplanned downtime
    maintenance_optimization: List[float]        # Optimized maintenance schedules
    
    # Process Optimization
    process_efficiency_gains: List[float]        # Process improvements
    energy_optimization: List[float]             # Energy efficiency gains
    quality_improvements: List[float]            # Quality cost reductions
    
    # Product Development
    reduced_prototype_costs: List[float]         # Virtual prototyping savings
    faster_time_to_market: List[float]          # Time-to-market benefits
    
    # Risk Management
    risk_mitigation_value: List[float]           # Risk avoidance value
    compliance_savings: List[float]              # Regulatory compliance benefits
    
    # Supply Chain & Inventory
    inventory_optimization: List[float]          # Inventory cost reductions
    supply_chain_optimization: List[float]      # Supply chain improvements
    
    # Innovation & Competitive Advantage
    innovation_value: List[float]                # Innovation-driven value
    competitive_advantage: List[float]           # Market position benefits



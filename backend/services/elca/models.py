import numpy as np
import json
import logging
from pathlib import Path
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from uuid import uuid4

# Brightway2 imports - excellent for LCA calculations
from brightway2 import (
    projects, Database, LCA, Method,
    get_activity, databases, methods
)

# Setup logging
logger = logging.getLogger(__name__)

class IndustryType(str, Enum):
    AUTOMOTIVE = "automotive"
    ELECTRONICS = "electronics"
    AEROSPACE = "aerospace"
    CHEMICAL = "chemical"

class WeightingScheme(str, Enum):
    RECIPE_2016 = "recipe_2016"
    IPCC_FOCUSED = "ipcc_focused"
    EQUAL_WEIGHTS = "equal_weights"

@dataclass
class ConcreteOperationalData:
    """
    Concrete operational data with measurable, verifiable parameters
    
    This replaces abstract parameters with real data that can be obtained
    from factory operations, utility bills, IT inventory, and monitoring systems.
    """
    
    # Production metrics (measurable from factory data)
    annual_production_volume: int          # units/year (countable from production records)
    operating_hours_per_year: int          # hours/year (measurable from shift schedules)
    factory_floor_area_m2: float          # m² (measurable from facility specs)
    
    # Energy consumption (from utility bills and monitoring)
    annual_electricity_kwh: float          # kWh/year (from utility bills)
    electricity_peak_demand_kw: float      # kW peak demand (from utility data)
    
    # Digital infrastructure (from IT asset inventory)
    server_count: int                      # physical count of servers
    server_avg_power_watts: float          # W/server (from spec sheets)
    iot_sensor_count: int                  # physical count of IoT devices
    iot_power_per_sensor_mw: float         # mW/sensor (from device specifications)
    
    # Data metrics (from monitoring and storage systems)
    daily_data_generation_gb: float        # GB/day (measurable from systems)
    data_retention_years: int              # years (from data policy)
    network_bandwidth_mbps: int            # Mbps (from network contracts)
    
    # Maintenance operations (from work order systems)
    annual_maintenance_hours: int          # hours/year (tracked in CMMS)
    maintenance_energy_kwh_per_hour: float # kWh/hour (estimated from equipment)
    
    def __post_init__(self):
        """Validate operational data ranges"""
        if self.annual_production_volume <= 0:
            raise ValueError("Annual production volume must be positive")
        if self.operating_hours_per_year > 8760:
            raise ValueError("Operating hours cannot exceed 8760 hours per year")
        if self.factory_floor_area_m2 <= 0:
            raise ValueError("Factory floor area must be positive")

@dataclass
class RegionalParameters:
    """
    Regional parameters from authoritative data sources
    
    These factors adjust LCA results based on regional conditions
    and are sourced from government agencies and international organizations.
    """
    
    # Energy system characteristics (from national energy agencies)
    grid_carbon_intensity_kg_co2_per_kwh: float    # kg CO2/kWh (from IEA, EPA, etc.)
    grid_renewable_percentage: float               # % renewable (0-100, from energy agencies)
    
    # Water resource factors (from water authorities/WRI Aqueduct)
    water_stress_factor: float                     # WRI Aqueduct scale 0-5
    water_energy_intensity_kwh_per_m3: float       # kWh/m³ (regional water treatment)
    
    # Waste management characteristics (from waste authorities)
    regional_recycling_rate: float                 # % recycling rate (0-100)
    
    # Economic factors (from government statistical offices)
    electricity_price_per_kwh: float               # $/kWh (for cost analysis)
    carbon_price_per_ton: float                    # $/ton CO2 (carbon pricing)
    
    def __post_init__(self):
        """Validate regional parameter ranges"""
        if not 0 <= self.grid_renewable_percentage <= 100:
            raise ValueError("Grid renewable percentage must be between 0-100")
        if not 0 <= self.water_stress_factor <= 5:
            raise ValueError("Water stress factor must be between 0-5 (WRI scale)")
        if not 0 <= self.regional_recycling_rate <= 100:
            raise ValueError("Regional recycling rate must be between 0-100")

@dataclass
class ImprovedDigitalTwinConfig:
    """
    Comprehensive configuration for digital twin LCA assessment
    
    This configuration uses concrete, measurable parameters that can be
    verified and validated from real operational data.
    """
    name: str
    industry_type: IndustryType
    operational_data: ConcreteOperationalData
    regional_params: RegionalParameters
    assessment_years: int = 5
    functional_unit_description: str = "Annual production with digital twin system"
    
    def __post_init__(self):
        """Validate configuration parameters"""
        if self.assessment_years <= 0 or self.assessment_years > 20:
            raise ValueError("Assessment years must be between 1-20")
        if not self.name or len(self.name.strip()) == 0:
            raise ValueError("Configuration name cannot be empty")

# Constants and shared configurations
WEIGHTING_SCHEMES = {
    WeightingScheme.RECIPE_2016: {
        "climate_change": 0.21,
        "human_toxicity": 0.16,
        "freshwater_ecotoxicity": 0.08,
        "fossil_depletion": 0.09,
        "mineral_depletion": 0.07,
        "water_scarcity": 0.09,
        "land_use": 0.06,
        "digital_footprint": 0.24  # Digital twin specific
    },
    WeightingScheme.IPCC_FOCUSED: {
        "climate_change": 0.50,
        "human_toxicity": 0.12,
        "freshwater_ecotoxicity": 0.03,
        "fossil_depletion": 0.07,
        "mineral_depletion": 0.03,
        "water_scarcity": 0.02,
        "land_use": 0.03,
        "digital_footprint": 0.20
    },
    WeightingScheme.EQUAL_WEIGHTS: {
        "climate_change": 0.125,
        "human_toxicity": 0.125,
        "freshwater_ecotoxicity": 0.125,
        "fossil_depletion": 0.125,
        "mineral_depletion": 0.125,
        "water_scarcity": 0.125,
        "land_use": 0.125,
        "digital_footprint": 0.125
    }
}

# Normalization factors based on planetary boundaries and industry benchmarks
NORMALIZATION_FACTORS = {
    "climate_change": 50000,       # 50 tons CO2-eq (good for manufacturing system)
    "human_toxicity": 5000,        # 5000 CTUh
    "freshwater_ecotoxicity": 10000, # 10000 CTUe
    "fossil_depletion": 500000,    # 500 GJ
    "mineral_depletion": 1000,     # 1000 kg Sb-eq
    "water_scarcity": 50000,       # 50000 m³ water-eq
    "land_use": 10000,            # 10000 m² crop-eq
    "digital_footprint": 100000    # Digital footprint units
}

# Impact category mapping for result interpretation
IMPACT_MAPPING = {
    "climate_change": ["climate change", "gwp", "carbon", "co2"],
    "human_toxicity": ["human toxicity", "human health", "toxicity"],
    "freshwater_ecotoxicity": ["ecotoxicity", "freshwater", "ecosystem"],
    "fossil_depletion": ["fossil depletion", "fossil", "depletion"],
    "mineral_depletion": ["mineral depletion", "mineral", "resource"],
    "water_scarcity": ["water", "scarcity", "consumption"],
    "land_use": ["land use", "land", "occupation"],
    "digital_footprint": ["digital", "footprint", "computing", "data"]
}

# Industry scaling factors based on typical performance
INDUSTRY_SCALING_FACTORS = {
    IndustryType.AUTOMOTIVE: {
        "climate_change": 1.1,     # Higher energy intensity
        "mineral_depletion": 1.3,  # High metal usage
        "digital_footprint": 0.9   # Moderate digitalization
    },
    IndustryType.ELECTRONICS: {
        "climate_change": 0.9,
        "mineral_depletion": 1.5,  # Very high rare earth usage
        "digital_footprint": 1.2   # High digitalization
    },
    IndustryType.AEROSPACE: {
        "climate_change": 1.2,     # High energy processes
        "mineral_depletion": 1.4,  # Specialized materials
        "digital_footprint": 1.1   # Advanced systems
    },
    IndustryType.CHEMICAL: {
        "climate_change": 1.3,     # Very high energy
        "human_toxicity": 1.4,     # Chemical emissions
        "water_scarcity": 1.2      # High water usage
    }
}

def map_results_to_categories(results: Dict[str, float]) -> Dict[str, float]:
    """
    Map LCA assessment results to impact categories
    
    Args:
        results: Dictionary of LCA results with method names as keys
        
    Returns:
        Dictionary mapping impact categories to total values
    """
    category_totals = {category: 0.0 for category in IMPACT_MAPPING.keys()}
    
    for result_key, value in results.items():
        result_key_lower = result_key.lower()
        
        # Find matching category based on keywords
        for category, keywords in IMPACT_MAPPING.items():
            if any(keyword in result_key_lower for keyword in keywords):
                category_totals[category] += abs(value)
                break
    
    return category_totals

def apply_regional_adjustments(category_totals: Dict[str, float], 
                             config: ImprovedDigitalTwinConfig) -> Dict[str, float]:
    """
    Apply regional adjustment factors to impact categories
    
    Args:
        category_totals: Impact category totals
        config: Digital twin configuration with regional parameters
        
    Returns:
        Regionally adjusted impact category totals
    """
    adjusted_totals = category_totals.copy()
    regional = config.regional_params
    
    try:
        # Climate change: adjust by regional grid carbon intensity
        carbon_factor = regional.grid_carbon_intensity_kg_co2_per_kwh / 0.5  # vs global avg 0.5 kg/kWh
        adjusted_totals["climate_change"] *= carbon_factor
        
        # Water consumption: apply water stress factor
        adjusted_totals["water_scarcity"] *= regional.water_stress_factor
        
        # Mineral depletion: adjust for regional recycling rates
        recycling_reduction = regional.regional_recycling_rate / 100 * 0.3  # Max 30% reduction
        recycling_factor = 1.0 - recycling_reduction
        adjusted_totals["mineral_depletion"] *= recycling_factor
        
        # Digital footprint: adjust by grid renewable percentage
        renewable_factor = 1.0 - (regional.grid_renewable_percentage / 100 * 0.2)  # Max 20% reduction
        adjusted_totals["digital_footprint"] *= renewable_factor
        
        logger.debug(f"Applied regional adjustments: carbon_factor={carbon_factor:.2f}, "
                    f"water_stress={regional.water_stress_factor}, "
                    f"recycling_factor={recycling_factor:.2f}")
        
    except Exception as e:
        logger.warning(f"Error applying regional adjustments: {e}")
        # Return original totals if adjustment fails
        return category_totals
    
    return adjusted_totals

def apply_industry_scaling(category_totals: Dict[str, float],
                         industry: IndustryType) -> Dict[str, float]:
    """
    Apply industry-specific scaling factors
    
    Args:
        category_totals: Impact category totals
        industry: Industry type
        
    Returns:
        Industry-scaled impact category totals
    """
    scaled_totals = category_totals.copy()
    factors = INDUSTRY_SCALING_FACTORS.get(industry, {})
    
    for category, factor in factors.items():
        if category in scaled_totals:
            scaled_totals[category] *= factor
    
    return scaled_totals

def normalize_and_score(category_totals: Dict[str, float]) -> Dict[str, float]:
    """
    Normalize impact categories and convert to 0-100 scores
    
    Args:
        category_totals: Impact category totals
        
    Returns:
        Dictionary of normalized scores (0-100, higher is better)
    """
    category_scores = {}
    
    for category, total_impact in category_totals.items():
        try:
            norm_factor = NORMALIZATION_FACTORS.get(category, 1.0)
            
            if total_impact > 0 and norm_factor > 0:
                # Calculate impact ratio (capped at 1.0)
                impact_ratio = min(1.0, total_impact / norm_factor)
                
                # Convert to score (invert so lower impact = higher score)
                normalized_score = (1.0 - impact_ratio) * 100
                
                # Ensure score is within bounds
                category_scores[category] = max(0.0, min(100.0, normalized_score))
            else:
                # Perfect score if no impact or invalid normalization
                category_scores[category] = 100.0
                
        except Exception as e:
            logger.warning(f"Error normalizing category {category}: {e}")
            category_scores[category] = 50.0  # Neutral score on error
    
    return category_scores

def calculate_weighted_scores(category_scores: Dict[str, float], 
                            weighting_scheme: WeightingScheme) -> Dict[str, float]:
    """
    Calculate weighted scores for each category
    
    Args:
        category_scores: Normalized category scores (0-100)
        weighting_scheme: Weighting scheme to apply
        
    Returns:
        Dictionary of weighted scores
    """
    weights = WEIGHTING_SCHEMES.get(weighting_scheme, WEIGHTING_SCHEMES[WeightingScheme.RECIPE_2016])
    
    weighted_scores = {}
    for category, score in category_scores.items():
        weight = weights.get(category, 0.0)
        weighted_scores[category] = score * weight
    
    return weighted_scores

def determine_rating(elca_score: float) -> tuple[str, str]:
    """
    Determine environmental rating based on ELCA score
    
    Args:
        elca_score: Overall ELCA score (0-100)
        
    Returns:
        Tuple of (rating, description)
    """
    if elca_score >= 85:
        return "Excellent", "Outstanding environmental performance across all categories"
    elif elca_score >= 70:
        return "Good", "Above average environmental performance with minor improvement opportunities"
    elif elca_score >= 55:
        return "Average", "Typical environmental performance for the industry"
    elif elca_score >= 40:
        return "Poor", "Below average environmental performance requiring attention"
    else:
        return "Very Poor", "Significant environmental concerns requiring immediate action"

def analyze_performance(category_scores: Dict[str, float], 
                      weighted_scores: Dict[str, float]) -> Dict[str, Any]:
    """
    Analyze performance across categories
    
    Args:
        category_scores: Normalized category scores
        weighted_scores: Weighted category scores
        
    Returns:
        Performance analysis dictionary
    """
    if not category_scores:
        return {}
    
    try:
        best_category = max(category_scores.items(), key=lambda x: x[1])
        worst_category = min(category_scores.items(), key=lambda x: x[1])
        dominant_contributor = max(weighted_scores.items(), key=lambda x: x[1])
        
        # Get bottom 3 categories for improvement priorities
        improvement_priorities = sorted(category_scores.items(), key=lambda x: x[1])[:3]
        
        return {
            "best_performing_category": best_category[0],
            "best_category_score": round(best_category[1], 1),
            "worst_performing_category": worst_category[0],
            "worst_category_score": round(worst_category[1], 1),
            "dominant_impact_contributor": dominant_contributor[0],
            "dominant_contribution": round(dominant_contributor[1], 2),
            "improvement_priorities": [cat for cat, score in improvement_priorities],
            "score_spread": round(best_category[1] - worst_category[1], 1),
            "categories_below_average": [cat for cat, score in category_scores.items() if score < 50]
        }
    except Exception as e:
        logger.error(f"Error analyzing performance: {e}")
        return {"error": "Could not complete performance analysis"}

def get_recommendations(worst_category: str, config: ImprovedDigitalTwinConfig, elca_score: float) -> List[str]:
    """
    Generate improvement recommendations based on ELCA score results
    
    Args:
        worst_category: Worst performing impact category
        config: Digital twin configuration
        elca_score: Overall ELCA score
        
    Returns:
        List of improvement recommendations
    """
    recommendations = []
    
    try:
        # Category-specific recommendations
        if worst_category == "climate_change":
            recommendations.extend([
                "Transition to renewable energy sources where possible",
                "Optimize energy efficiency of digital infrastructure",
                "Consider carbon offsetting for unavoidable emissions",
                "Implement energy management systems"
            ])
        elif worst_category == "digital_footprint":
            recommendations.extend([
                "Optimize data storage and processing efficiency",
                "Reduce unnecessary data generation and retention",
                "Implement edge computing to reduce network transfers",
                "Use more efficient algorithms and software"
            ])
        elif worst_category == "mineral_depletion":
            recommendations.extend([
                "Extend hardware lifecycles through better maintenance",
                "Increase use of recycled materials",
                "Consider refurbished equipment where appropriate",
                "Implement circular economy principles"
            ])
        elif worst_category == "water_scarcity":
            recommendations.extend([
                "Implement water recycling in cooling systems",
                "Optimize cooling efficiency",
                "Consider air-cooling alternatives",
                "Monitor and reduce water consumption"
            ])
        elif worst_category == "human_toxicity":
            recommendations.extend([
                "Use cleaner production processes",
                "Implement better emission controls",
                "Choose less toxic materials where possible",
                "Improve workplace safety measures"
            ])
        
        # Industry-specific recommendations
        industry = config.industry_type
        if industry == IndustryType.AUTOMOTIVE:
            recommendations.append("Consider lean manufacturing principles to reduce waste")
        elif industry == IndustryType.ELECTRONICS:
            recommendations.append("Implement circular design principles for electronic components")
        elif industry == IndustryType.CHEMICAL:
            recommendations.append("Evaluate process intensification opportunities")
        elif industry == IndustryType.AEROSPACE:
            recommendations.append("Focus on lightweight materials and design optimization")
        
        # Severity-based recommendations
        if elca_score < 40:
            recommendations.insert(0, "Consider comprehensive environmental management system implementation")
        elif elca_score < 55:
            recommendations.insert(0, "Focus on addressing the lowest-scoring impact categories first")
        
    except Exception as e:
        logger.warning(f"Error generating recommendations: {e}")
        recommendations.append("Conduct detailed environmental impact assessment for specific recommendations")
    
    return recommendations[:10]  # Limit to top 10 recommendations

# Exception classes for better error handling
class LCAFrameworkError(Exception):
    """Base exception for LCA framework errors"""
    pass

class DatabaseSetupError(LCAFrameworkError):
    """Error during database setup"""
    pass

class FunctionalUnitError(LCAFrameworkError):
    """Error in functional unit construction"""
    pass

class ImpactAssessmentError(LCAFrameworkError):
    """Error during impact assessment"""
    pass

class ELCAScoreError(LCAFrameworkError):
    """Error during ELCA score calculation"""
    pass
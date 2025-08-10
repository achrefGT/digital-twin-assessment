import numpy as np
from typing import Dict, List, Optional, Tuple, Any
import logging
from cashflows import cashflow, interest_rate
from cashflows.analysis import timevalue
import warnings

from shared.models.exceptions import ScoringException
from .models import DigitalTwinCosts, DigitalTwinBenefits, LCCInput, IndustryType
from .config import settings

try:
    import numpy_financial as npf
    HAS_NUMPY_FINANCIAL = True
except ImportError:
    HAS_NUMPY_FINANCIAL = False
    warnings.warn("numpy_financial not installed; IRR will be skipped. Install: pip install numpy-financial")


logger = logging.getLogger(__name__)


class DigitalTwinLCC:
    """Enhanced LCC analysis specifically for Digital Twin implementations with 0-100 scoring"""
    
    def __init__(self, industry_type: IndustryType = IndustryType.MANUFACTURING):
        self.industry_type = industry_type
        self.industry_factors = self._get_industry_factors()
    
    def _get_industry_factors(self) -> Dict[str, float]:
        """Get industry-specific adjustment factors"""
        factors = {
            IndustryType.MANUFACTURING: {
                'downtime_cost_multiplier': 1.0,
                'quality_impact_multiplier': 1.2,
                'maintenance_impact_multiplier': 1.1,
                'regulatory_complexity': 1.0
            },
            IndustryType.ENERGY: {
                'downtime_cost_multiplier': 2.5,
                'quality_impact_multiplier': 0.8,
                'maintenance_impact_multiplier': 1.5,
                'regulatory_complexity': 1.3
            },
            IndustryType.AEROSPACE: {
                'downtime_cost_multiplier': 3.0,
                'quality_impact_multiplier': 2.0,
                'maintenance_impact_multiplier': 1.8,
                'regulatory_complexity': 2.0
            },
            IndustryType.AUTOMOTIVE: {
                'downtime_cost_multiplier': 1.5,
                'quality_impact_multiplier': 1.5,
                'maintenance_impact_multiplier': 1.0,
                'regulatory_complexity': 1.2
            }
        }
        return factors.get(self.industry_type, factors[IndustryType.MANUFACTURING])
    
    def compute_enhanced_lcc(
        self,
        capex: float,
        costs: DigitalTwinCosts,
        benefits: DigitalTwinBenefits,
        discount_rate: float,
        start_year: int = 2025,
        freq: str = 'A',
        roi_bounds: Tuple[float, float] = (0.0, 2.0)
    ) -> Dict:
        """
        Compute enhanced LCC metrics for digital twin implementation
        
        Parameters:
            capex: Upfront investment
            costs: DigitalTwinCosts object
            benefits: DigitalTwinBenefits object
            discount_rate: Discount rate (decimal)
            start_year: Starting year
            freq: Frequency ('A' for annual)
            roi_bounds: ROI normalization bounds
            
        Returns:
            Dictionary with comprehensive LCC metrics (scores on 0-100 scale)
        """
        print(f"--- ENHANCED DIGITAL TWIN LCC START ---")
        print(f"Industry: {self.industry_type.value}")
        print(f"CAPEX: ${capex:,.2f}, Discount rate: {discount_rate:.1%}")
        
        # Calculate total costs and benefits
        total_costs = self._calculate_total_costs(costs)
        total_benefits = self._calculate_total_benefits(benefits)
        
        # Apply industry-specific adjustments
        adjusted_benefits = self._apply_industry_adjustments(total_benefits)
        
        # Build cash flow
        cf_list = self._build_cash_flow(capex, total_costs, adjusted_benefits)
        
        # Calculate base metrics
        base_metrics = self._calculate_base_metrics(cf_list, discount_rate, start_year, freq, roi_bounds)
        
        # Calculate digital twin specific metrics
        dt_metrics = self._calculate_dt_metrics(costs, benefits, capex)
        
        # Calculate comprehensive economic sustainability score
        econ_sustainability = self._calculate_economic_sustainability(
            base_metrics, dt_metrics, capex, discount_rate, roi_bounds
        )
        
        # Combine all metrics
        results = {
            **base_metrics,
            **dt_metrics,
            **econ_sustainability,
            'industry_type': self.industry_type.value,
            'total_costs_pv': sum(total_costs) / (1 + discount_rate) ** len(total_costs),
            'total_benefits_pv': sum(adjusted_benefits) / (1 + discount_rate) ** len(adjusted_benefits)
        }
        
        return results
    
    def _calculate_total_costs(self, costs: DigitalTwinCosts) -> List[float]:
        """Calculate total annual costs"""
        n = len(costs.energy_costs)
        total_costs = []
        
        for i in range(n):
            annual_cost = (
                costs.dt_software_license[i] +
                costs.cloud_computing[i] +
                costs.data_storage[i] +
                costs.sensor_hardware[i] +
                costs.networking_infra[i] +
                costs.edge_devices[i] +
                costs.integration_costs[i] +
                costs.customization[i] +
                costs.training[i] +
                costs.dt_maintenance[i] +
                costs.cybersecurity[i] +
                costs.data_management[i] +
                costs.energy_costs[i] +
                costs.maintenance_costs[i] +
                costs.downtime_costs[i] +
                costs.replacement_costs[i]
            )
            total_costs.append(annual_cost)
        
        return total_costs
    
    def _calculate_total_benefits(self, benefits: DigitalTwinBenefits) -> List[float]:
        """Calculate total annual benefits"""
        n = len(benefits.predictive_maintenance_savings)
        total_benefits = []
        
        for i in range(n):
            annual_benefit = (
                benefits.predictive_maintenance_savings[i] +
                benefits.maintenance_optimization[i] +
                benefits.process_efficiency_gains[i] +
                benefits.energy_optimization[i] +
                benefits.quality_improvements[i] +
                benefits.reduced_prototype_costs[i] +
                benefits.faster_time_to_market[i] +
                benefits.risk_mitigation_value[i] +
                benefits.compliance_savings[i] +
                benefits.inventory_optimization[i] +
                benefits.supply_chain_optimization[i] +
                benefits.innovation_value[i] +
                benefits.competitive_advantage[i]
            )
            total_benefits.append(annual_benefit)
        
        return total_benefits
    
    def _apply_industry_adjustments(self, benefits: List[float]) -> List[float]:
        """Apply industry-specific adjustments to benefits"""
        factors = self.industry_factors
        adjusted = []
        
        for benefit in benefits:
            # Apply composite adjustment factor
            adjustment = (
                factors['downtime_cost_multiplier'] * 0.3 +
                factors['quality_impact_multiplier'] * 0.25 +
                factors['maintenance_impact_multiplier'] * 0.25 +
                factors['regulatory_complexity'] * 0.2
            )
            adjusted.append(benefit * adjustment)
        
        return adjusted
    
    def _build_cash_flow(self, capex: float, costs: List[float], benefits: List[float]) -> List[float]:
        """Build cash flow list"""
        cf_list = [-capex]  # Initial investment
        
        for cost, benefit in zip(costs, benefits):
            net_cf = benefit - cost
            cf_list.append(net_cf)
            
        return cf_list
    
    def _calculate_base_metrics(self, cf_list: List[float], discount_rate: float, 
                              start_year: int, freq: str, roi_bounds: Tuple[float, float]) -> Dict:
        """Calculate base financial metrics"""
        n = len(cf_list) - 1  # Exclude initial investment
        
        # Create cashflow series
        start = str(start_year)
        cf_series = cashflow(cf_list, start=start, freq=freq)
        ir_series = interest_rate([discount_rate * 100] * (n + 1), start=start, freq=freq)
        
        # NPV
        npv_val = timevalue(cf_series, prate=ir_series)
        
        # IRR
        irr_val = None
        if HAS_NUMPY_FINANCIAL:
            try:
                raw = npf.irr(np.array(cf_list))
                irr_val = float(raw) if not np.isnan(raw) else None
            except Exception as ex:
                print(f"Warning: IRR calculation error: {ex}")
        
        # Payback period
        cumulative = np.cumsum(cf_list)
        payback = None
        for i, cum_val in enumerate(cumulative):
            if cum_val >= 0:
                payback = i
                break
        
        # ROI
        capex = abs(cf_list[0])
        roi_val = (npv_val / capex) if capex else None
        
        return {
            'npv': npv_val,
            'irr': irr_val,
            'payback_period': payback,
            'roi': roi_val
        }
    
    def _calculate_dt_metrics(self, costs: DigitalTwinCosts, benefits: DigitalTwinBenefits, 
                             capex: float) -> Dict:
        """Calculate digital twin specific metrics (0-100 scale)"""
        
        # Digital twin implementation maturity score (0-100)
        dt_cost_categories = [
            sum(costs.dt_software_license),
            sum(costs.cloud_computing),
            sum(costs.sensor_hardware),
            sum(costs.integration_costs),
            sum(costs.cybersecurity)
        ]
        
        total_dt_costs = sum(dt_cost_categories)
        maturity_score_normalized = min(1.0, total_dt_costs / capex) if capex > 0 else 0
        maturity_score = maturity_score_normalized * 100  # Convert to 0-100
        
        # Benefit realization score
        total_benefits = sum([
            sum(benefits.predictive_maintenance_savings),
            sum(benefits.process_efficiency_gains),
            sum(benefits.quality_improvements),
            sum(benefits.risk_mitigation_value)
        ])
        
        benefit_cost_ratio = total_benefits / total_dt_costs if total_dt_costs > 0 else 0
        
        # Digital transformation readiness (0-100)
        readiness_factors = {
            'infrastructure_readiness': min(1.0, sum(costs.networking_infra) / (capex * 0.1)),
            'data_readiness': min(1.0, sum(costs.data_management) / (capex * 0.05)),
            'organizational_readiness': min(1.0, sum(costs.training) / (capex * 0.08))
        }
        
        transformation_readiness_normalized = np.mean(list(readiness_factors.values()))
        transformation_readiness = transformation_readiness_normalized * 100  # Convert to 0-100
        
        # Convert readiness breakdown to 0-100 scale
        readiness_breakdown_100 = {k: v * 100 for k, v in readiness_factors.items()}
        
        return {
            'dt_implementation_maturity': maturity_score,
            'benefit_cost_ratio': benefit_cost_ratio,
            'transformation_readiness': transformation_readiness,
            'readiness_breakdown': readiness_breakdown_100
        }
    
    def _calculate_economic_sustainability(self, base_metrics: Dict, dt_metrics: Dict, 
                                         capex: float, discount_rate: float, 
                                         roi_bounds: Tuple[float, float]) -> Dict:
        """Calculate comprehensive economic sustainability score (0-100 scale)"""
        
        # 1. Financial Viability Score (40% weight)
        financial_score = 0.0
        
        # NPV component (normalized by CAPEX)
        npv_ratio = base_metrics['npv'] / capex if capex > 0 else 0
        npv_score = min(1.0, max(0.0, npv_ratio / 2.0))  # Normalize assuming 2x CAPEX is excellent
        
        # IRR component (vs discount rate)
        irr_score = 0.0
        if base_metrics['irr'] is not None:
            irr_premium = base_metrics['irr'] - discount_rate
            irr_score = min(1.0, max(0.0, irr_premium / 0.5))  # 50% premium over discount rate = 1.0
        
        # Payback component (shorter is better)
        payback_score = 0.0
        if base_metrics['payback_period'] is not None:
            # 1 year = 1.0, 5 years = 0.0
            payback_score = max(0.0, min(1.0, (5 - base_metrics['payback_period']) / 4))
        
        # ROI component (using original bounds)
        roi_score = 0.0
        if base_metrics['roi'] is not None:
            norm_min, norm_max = roi_bounds
            roi_score = max(0.0, min(1.0, (base_metrics['roi'] - norm_min) / (norm_max - norm_min)))
        
        financial_score = (npv_score * 0.3 + irr_score * 0.3 + payback_score * 0.2 + roi_score * 0.2)
        
        # 2. Digital Twin Readiness Score (25% weight) - already converted to 0-100
        dt_readiness_normalized = dt_metrics['transformation_readiness'] / 100  # Convert back to 0-1 for calculation
        
        # 3. Implementation Maturity Score (20% weight) - already converted to 0-100
        implementation_maturity_normalized = dt_metrics['dt_implementation_maturity'] / 100  # Convert back to 0-1 for calculation
        
        # 4. Benefit Realization Score (15% weight)
        # Based on benefit-cost ratio
        bcr = dt_metrics['benefit_cost_ratio']
        benefit_score = min(1.0, max(0.0, (bcr - 1.0) / 2.0))  # BCR of 3.0 = perfect score
        
        # 5. Industry Risk Adjustment (based on industry factors)
        industry_risk_factor = 1.0
        if hasattr(self, 'industry_factors'):
            # Higher regulatory complexity = higher risk
            reg_complexity = self.industry_factors.get('regulatory_complexity', 1.0)
            industry_risk_factor = max(0.7, min(1.0, 2.0 - reg_complexity))
        
        # Composite Economic Sustainability Score (0-1 scale first)
        composite_score_normalized = (
            financial_score * 0.40 +
            dt_readiness_normalized * 0.25 +
            implementation_maturity_normalized * 0.20 +
            benefit_score * 0.15
        ) * industry_risk_factor
        
        # Convert to 0-100 scale
        composite_score = composite_score_normalized * 100
        
        # Risk-adjusted score categories
        if composite_score >= 80:
            sustainability_rating = "Excellent"
        elif composite_score >= 60:
            sustainability_rating = "Good"
        elif composite_score >= 40:
            sustainability_rating = "Moderate"
        else:
            sustainability_rating = "Poor"
        
        # Convert all component scores to 0-100 scale
        return {
            'economic_sustainability_score': composite_score,
            'sustainability_rating': sustainability_rating,
            'score_components': {
                'financial_viability': financial_score * 100,
                'dt_readiness': dt_metrics['transformation_readiness'],  # Already 0-100
                'implementation_maturity': dt_metrics['dt_implementation_maturity'],  # Already 0-100
                'benefit_realization': benefit_score * 100,
                'industry_risk_factor': industry_risk_factor * 100
            },
            'financial_breakdown': {
                'npv_score': npv_score * 100,
                'irr_score': irr_score * 100,
                'payback_score': payback_score * 100,
                'roi_score': roi_score * 100
            }
        }


def calculate_lcc_score(lcc_input: LCCInput) -> Dict[str, Any]:
    """Calculate LCC scores from assessment input (0-100 scale)"""
    
    try:
        logger.info(f"Starting LCC calculation for assessment {lcc_input.analysisId}")
        print(f"DEBUG: Starting LCC calculation for {lcc_input.analysisId}")
        
        # Validate inputs
        if lcc_input.capex <= 0:
            raise ScoringException("CAPEX must be greater than zero")
        
        if not (settings.min_discount_rate <= lcc_input.discount_rate <= settings.max_discount_rate):
            raise ScoringException(f"Discount rate must be between {settings.min_discount_rate:.1%} and {settings.max_discount_rate:.1%}")
        
        # Validate cost and benefit array lengths
        cost_lengths = set([
            len(lcc_input.costs.dt_software_license),
            len(lcc_input.costs.cloud_computing),
            len(lcc_input.costs.energy_costs),
            len(lcc_input.costs.maintenance_costs)
        ])
        
        benefit_lengths = set([
            len(lcc_input.benefits.predictive_maintenance_savings),
            len(lcc_input.benefits.process_efficiency_gains),
            len(lcc_input.benefits.energy_optimization)
        ])
        
        if len(cost_lengths) > 1 or len(benefit_lengths) > 1 or cost_lengths != benefit_lengths:
            raise ScoringException("All cost and benefit arrays must have the same length")
        
        analysis_years = list(cost_lengths)[0]
        if not (settings.min_analysis_years <= analysis_years <= settings.max_analysis_years):
            raise ScoringException(f"Analysis period must be between {settings.min_analysis_years} and {settings.max_analysis_years} years")
        
        logger.debug(f"Validation passed - Analysis years: {analysis_years}, CAPEX: {lcc_input.capex:,.2f}")
        print(f"DEBUG: Validation passed - {analysis_years} years, CAPEX: ${lcc_input.capex:,.2f}")
        
        # Create DigitalTwinLCC analyzer
        dt_lcc = DigitalTwinLCC(lcc_input.industry)
        
        # Convert Pydantic models to dataclass format
        costs = DigitalTwinCosts(
            dt_software_license=lcc_input.costs.dt_software_license,
            cloud_computing=lcc_input.costs.cloud_computing,
            data_storage=lcc_input.costs.data_storage,
            sensor_hardware=lcc_input.costs.sensor_hardware,
            networking_infra=lcc_input.costs.networking_infra,
            edge_devices=lcc_input.costs.edge_devices,
            integration_costs=lcc_input.costs.integration_costs,
            customization=lcc_input.costs.customization,
            training=lcc_input.costs.training,
            dt_maintenance=lcc_input.costs.dt_maintenance,
            cybersecurity=lcc_input.costs.cybersecurity,
            data_management=lcc_input.costs.data_management,
            energy_costs=lcc_input.costs.energy_costs,
            maintenance_costs=lcc_input.costs.maintenance_costs,
            downtime_costs=lcc_input.costs.downtime_costs,
            replacement_costs=lcc_input.costs.replacement_costs
        )
        
        benefits = DigitalTwinBenefits(
            predictive_maintenance_savings=lcc_input.benefits.predictive_maintenance_savings,
            maintenance_optimization=lcc_input.benefits.maintenance_optimization,
            process_efficiency_gains=lcc_input.benefits.process_efficiency_gains,
            energy_optimization=lcc_input.benefits.energy_optimization,
            quality_improvements=lcc_input.benefits.quality_improvements,
            reduced_prototype_costs=lcc_input.benefits.reduced_prototype_costs,
            faster_time_to_market=lcc_input.benefits.faster_time_to_market,
            risk_mitigation_value=lcc_input.benefits.risk_mitigation_value,
            compliance_savings=lcc_input.benefits.compliance_savings,
            inventory_optimization=lcc_input.benefits.inventory_optimization,
            supply_chain_optimization=lcc_input.benefits.supply_chain_optimization,
            innovation_value=lcc_input.benefits.innovation_value,
            competitive_advantage=lcc_input.benefits.competitive_advantage
        )
        
        logger.debug("Converted Pydantic models to dataclass format")
        print(f"DEBUG: Converted models for industry: {lcc_input.industry.value}")
        
        # Perform the enhanced LCC analysis
        try:
            results = dt_lcc.compute_enhanced_lcc(
                capex=lcc_input.capex,
                costs=costs,
                benefits=benefits,
                discount_rate=lcc_input.discount_rate,
                start_year=lcc_input.start_year,
                roi_bounds=lcc_input.roi_bounds
            )
            
            logger.debug(f"LCC computation completed successfully")
            print(f"DEBUG: LCC computation completed - Overall score: {results['economic_sustainability_score']:.1f}/100")
            
        except Exception as e:
            logger.error(f"LCC computation failed: {e}")
            print(f"DEBUG: ❌ LCC computation failed: {type(e).__name__}: {e}")
            raise ScoringException(f"LCC computation failed: {e}")
        
        # Validate results
        required_result_keys = [
            'economic_sustainability_score', 'sustainability_rating',
            'dt_implementation_maturity', 'benefit_cost_ratio',
            'transformation_readiness', 'score_components', 'industry_type'
        ]
        
        for key in required_result_keys:
            if key not in results:
                raise ScoringException(f"Missing required result field: {key}")
        
        # Ensure scores are within valid ranges (0-100)
        score_fields = ['economic_sustainability_score', 'dt_implementation_maturity', 'transformation_readiness']
        for field in score_fields:
            score = results[field]
            if not isinstance(score, (int, float)) or not (0.0 <= score <= 100.0):
                logger.warning(f"Score {field} out of range: {score}, clamping to [0,100]")
                results[field] = max(0.0, min(100.0, float(score)))

        
        # Add additional metadata for detailed analysis
        results['calculation_metadata'] = {
            'analysis_years': analysis_years,
            'capex': lcc_input.capex,
            'discount_rate': lcc_input.discount_rate,
            'start_year': lcc_input.start_year,
            'roi_bounds': lcc_input.roi_bounds,
            'industry_factors_applied': settings.enable_industry_adjustments,
            'scoring_scale': '0-100',
            'total_costs_nominal': sum([
                sum(getattr(lcc_input.costs, field)) 
                for field in ['dt_software_license', 'energy_costs', 'maintenance_costs', 'downtime_costs']
            ]),
            'total_benefits_nominal': sum([
                sum(getattr(lcc_input.benefits, field)) 
                for field in ['predictive_maintenance_savings', 'process_efficiency_gains', 'energy_optimization']
            ])
        }
        
        # Round numerical values for consistency
        # Financial metrics keep original precision
        financial_fields = ['npv', 'irr', 'roi', 'benefit_cost_ratio']
        # Score fields round to 1 decimal place for 0-100 scale
        score_fields = ['economic_sustainability_score', 'dt_implementation_maturity', 'transformation_readiness']
        
        for field in financial_fields:
            if field in results and results[field] is not None:
                if isinstance(results[field], (int, float)):
                    results[field] = round(float(results[field]), 4)
        
        for field in score_fields:
            if field in results and results[field] is not None:
                if isinstance(results[field], (int, float)):
                    results[field] = round(float(results[field]), 1)
        
        # Round score components (0-100 scale)
        if 'score_components' in results and isinstance(results['score_components'], dict):
            for key, value in results['score_components'].items():
                if isinstance(value, (int, float)):
                    results['score_components'][key] = round(float(value), 1)
        
        # Round financial breakdown (0-100 scale)
        if 'financial_breakdown' in results and isinstance(results['financial_breakdown'], dict):
            for key, value in results['financial_breakdown'].items():
                if isinstance(value, (int, float)):
                    results['financial_breakdown'][key] = round(float(value), 1)
        
        # Round readiness breakdown (0-100 scale)
        if 'readiness_breakdown' in results and isinstance(results['readiness_breakdown'], dict):
            for key, value in results['readiness_breakdown'].items():
                if isinstance(value, (int, float)):
                    results['readiness_breakdown'][key] = round(float(value), 1)
        
        logger.info(f"Successfully calculated LCC scores for assessment {lcc_input.analysisId}: "
                   f"sustainability_score={results['economic_sustainability_score']:.1f}/100, "
                   f"rating={results['sustainability_rating']}")
        print(f"DEBUG: ✅ LCC calculation complete for {lcc_input.analysisId}")
        
        return results
        
    except ScoringException:
        # Re-raise scoring exceptions
        raise
    except Exception as e:
        logger.error(f"Unexpected error in LCC scoring: {e}")
        print(f"DEBUG: ❌ Unexpected error in LCC scoring: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        raise ScoringException(f"Unexpected error during LCC scoring calculation: {e}")


def validate_lcc_input(lcc_input: LCCInput) -> Dict[str, Any]:
    """Validate LCC input and return validation results"""
    
    validation_results = {
        'is_valid': True,
        'errors': [],
        'warnings': [],
        'recommendations': []
    }
    
    try:
        # Basic validation
        if lcc_input.capex <= 0:
            validation_results['errors'].append("CAPEX must be greater than zero")
            validation_results['is_valid'] = False
        
        if lcc_input.capex > 1_000_000_000:  # $1B threshold
            validation_results['warnings'].append("Very high CAPEX detected - please verify accuracy")
        
        # Discount rate validation
        if not (0.01 <= lcc_input.discount_rate <= 0.30):
            validation_results['errors'].append(f"Discount rate must be between 1% and 30%")
            validation_results['is_valid'] = False
        
        if lcc_input.discount_rate > 0.15:
            validation_results['warnings'].append("High discount rate may indicate high-risk assessment")
        
        # Array length validation
        cost_fields = ['dt_software_license', 'cloud_computing', 'energy_costs', 'maintenance_costs']
        benefit_fields = ['predictive_maintenance_savings', 'process_efficiency_gains', 'energy_optimization']
        
        lengths = []
        for field in cost_fields:
            length = len(getattr(lcc_input.costs, field, []))
            lengths.append(length)
        
        for field in benefit_fields:
            length = len(getattr(lcc_input.benefits, field, []))
            lengths.append(length)
        
        if len(set(lengths)) > 1:
            validation_results['errors'].append("All cost and benefit arrays must have the same length")
            validation_results['is_valid'] = False
        
        analysis_years = lengths[0] if lengths else 0
        if analysis_years < 3:
            validation_results['errors'].append("Analysis period must be at least 3 years")
            validation_results['is_valid'] = False
        elif analysis_years > 20:
            validation_results['warnings'].append("Very long analysis period - consider model uncertainty")
        
        # Value validation
        total_annual_costs = []
        total_annual_benefits = []
        
        if analysis_years > 0:
            for year in range(analysis_years):
                annual_cost = sum([
                    getattr(lcc_input.costs, field)[year] 
                    for field in cost_fields 
                    if len(getattr(lcc_input.costs, field, [])) > year
                ])
                annual_benefit = sum([
                    getattr(lcc_input.benefits, field)[year] 
                    for field in benefit_fields 
                    if len(getattr(lcc_input.benefits, field, [])) > year
                ])
                
                total_annual_costs.append(annual_cost)
                total_annual_benefits.append(annual_benefit)
                
                if annual_cost < 0:
                    validation_results['warnings'].append(f"Negative costs in year {year + 1}")
                if annual_benefit < 0:
                    validation_results['warnings'].append(f"Negative benefits in year {year + 1}")
        
        # Business logic recommendations
        total_costs = sum(total_annual_costs)
        total_benefits = sum(total_annual_benefits)
        
        if total_benefits < total_costs:
            validation_results['warnings'].append("Total benefits are less than total costs")
        
        if total_benefits / total_costs < 1.2:  # Less than 20% benefit premium
            validation_results['recommendations'].append("Consider reviewing benefit estimates - current projections show modest returns")
        
        benefit_cost_ratio = total_benefits / total_costs if total_costs > 0 else 0
        if benefit_cost_ratio > 5.0:
            validation_results['warnings'].append("Very high benefit-to-cost ratio - please verify benefit estimates")
        
        # Industry-specific recommendations
        if lcc_input.industry == IndustryType.AEROSPACE:
            validation_results['recommendations'].append("Aerospace industry: Consider additional regulatory compliance costs")
        elif lcc_input.industry == IndustryType.ENERGY:
            validation_results['recommendations'].append("Energy industry: Factor in long asset lifecycles and regulatory changes")
        
        return validation_results
        
    except Exception as e:
        validation_results['is_valid'] = False
        validation_results['errors'].append(f"Validation error: {str(e)}")
        return validation_results
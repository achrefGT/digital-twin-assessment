import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import AssessmentNotFoundException
from .models import LCCInput, LCCResult, IndustryInfo, IndustryType
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import LCCKafkaHandler
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = LCCKafkaHandler(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting LCC Analysis Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("LCC Analysis Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start LCC Analysis Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down LCC Analysis Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("LCC Analysis Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Life Cycle Cost (LCC) Analysis Service",
    description="Microservice for conducting Digital Twin Life Cycle Cost analysis",
    version=settings.version,
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=settings.cors_allow_methods,
    allow_headers=settings.cors_allow_headers,
)


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    additional_checks = {}
    
    if settings.kafka_health_check_enabled:
        additional_checks["kafka_connected"] = kafka_handler.is_running()
    
    if settings.database_health_check_enabled:
        additional_checks["database_connected"] = db_manager.health_check()
        
    return create_health_response(settings.service_name, additional_checks)


@app.get("/ready")
async def readiness_check():
    """Readiness check"""
    if not kafka_handler.is_running():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Kafka handler not ready"
        )
    return {"status": "ready"}


@app.get("/industries", response_model=IndustryInfo)
async def get_industry_info():
    """Get available industry types and their factors"""
    industry_factors = {
        IndustryType.MANUFACTURING.value: {
            'downtime_cost_multiplier': 1.0,
            'quality_impact_multiplier': 1.2,
            'maintenance_impact_multiplier': 1.1,
            'regulatory_complexity': 1.0
        },
        IndustryType.ENERGY.value: {
            'downtime_cost_multiplier': 2.5,
            'quality_impact_multiplier': 0.8,
            'maintenance_impact_multiplier': 1.5,
            'regulatory_complexity': 1.3
        },
        IndustryType.AEROSPACE.value: {
            'downtime_cost_multiplier': 3.0,
            'quality_impact_multiplier': 2.0,
            'maintenance_impact_multiplier': 1.8,
            'regulatory_complexity': 2.0
        },
        IndustryType.AUTOMOTIVE.value: {
            'downtime_cost_multiplier': 1.5,
            'quality_impact_multiplier': 1.5,
            'maintenance_impact_multiplier': 1.0,
            'regulatory_complexity': 1.2
        }
    }
    
    return IndustryInfo(
        types=[industry.value for industry in IndustryType],
        factors=industry_factors
    )


@app.get("/template")
async def get_analysis_template():
    """Get a template for LCC analysis input"""
    years = 10
    template = {
        "industry": "manufacturing",
        "capex": 2500000,
        "costs": {
            "dt_software_license": [150000] * years,
            "cloud_computing": [80000] * years,
            "data_storage": [40000] * years,
            "sensor_hardware": [100000] + [20000] * (years - 1),
            "networking_infra": [50000] + [10000] * (years - 1),
            "edge_devices": [75000] + [15000] * (years - 1),
            "integration_costs": [200000] + [50000] * (years - 1),
            "customization": [150000] + [30000] * (years - 1),
            "training": [100000] + [25000] * (years - 1),
            "dt_maintenance": [60000] * years,
            "cybersecurity": [70000] * years,
            "data_management": [45000] * years,
            "energy_costs": [200000] * years,
            "maintenance_costs": [300000] * years,
            "downtime_costs": [150000] * years,
            "replacement_costs": [80000] * years
        },
        "benefits": {
            "predictive_maintenance_savings": [400000] * years,
            "maintenance_optimization": [300000] * years,
            "process_efficiency_gains": [500000] * years,
            "energy_optimization": [150000] * years,
            "quality_improvements": [250000] * years,
            "reduced_prototype_costs": [200000] * years,
            "faster_time_to_market": [300000] * years,
            "risk_mitigation_value": [180000] * years,
            "compliance_savings": [120000] * years,
            "inventory_optimization": [220000] * years,
            "supply_chain_optimization": [180000] * years,
            "innovation_value": [150000] * years,
            "competitive_advantage": [200000] * years
        },
        "discount_rate": 0.08,
        "start_year": 2025,
        "roi_bounds": [0.0, 1.5]
    }
    
    return template


@app.get("/constants")
async def get_assessment_constants():
    """Get LCC assessment constants and limits"""
    return {
        "discount_rate_limits": {
            "min": settings.min_discount_rate,
            "max": settings.max_discount_rate,
            "default": settings.default_discount_rate
        },
        "analysis_period_limits": {
            "min_years": settings.min_analysis_years,
            "max_years": settings.max_analysis_years,
            "default_years": settings.default_analysis_years
        },
        "roi_bounds_by_industry": {
            "manufacturing": settings.roi_bounds_manufacturing,
            "energy": settings.roi_bounds_energy,
            "aerospace": settings.roi_bounds_aerospace,
            "automotive": settings.roi_bounds_automotive
        },
        "scoring_info": {
            "sustainability_rating_thresholds": {
                "excellent": "≥ 80%",
                "good": "60-79%", 
                "moderate": "40-59%",
                "poor": "< 40%"
            },
            "score_components": [
                "financial_viability (40%)",
                "dt_readiness (25%)",
                "implementation_maturity (20%)",
                "benefit_realization (15%)"
            ]
        }
    }


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get LCC assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "user_id": assessment.user_id,
            "system_name": assessment.system_name,
            "industry_type": assessment.industry_type,
            
            # Financial metrics
            "npv": assessment.npv,
            "irr": assessment.irr,
            "payback_period": assessment.payback_period,
            "roi": assessment.roi,
            
            # Sustainability scores
            "economic_sustainability_score": assessment.economic_sustainability_score,
            "sustainability_rating": assessment.sustainability_rating,
            "dt_implementation_maturity": assessment.dt_implementation_maturity,
            "benefit_cost_ratio": assessment.benefit_cost_ratio,
            "transformation_readiness": assessment.transformation_readiness,
            
            # Detailed data
            "score_components": make_json_serializable(assessment.score_components),
            "detailed_results": make_json_serializable(assessment.detailed_results),
            
            # Metadata
            "capex": assessment.capex,
            "discount_rate": assessment.discount_rate,
            "analysis_years": assessment.analysis_years,
            "metadata": make_json_serializable(assessment.meta_data),
            
            # Timestamps
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "processed_at": assessment.processed_at.isoformat() if assessment.processed_at else None,
        }
        
        return response_data
        
    except AssessmentNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Assessment {assessment_id} not found"
        )
    except Exception as e:
        logger.error(f"Error retrieving assessment {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/assessments/user/{user_id}")
async def get_user_assessments(user_id: str, limit: int = 50):
    """Get assessments for a specific user"""
    try:
        assessments = db_manager.get_assessments_by_user(user_id, limit)
        
        return {
            "user_id": user_id,
            "count": len(assessments),
            "assessments": [
                {
                    "assessment_id": a.assessment_id,
                    "system_name": a.system_name,
                    "industry_type": a.industry_type,
                    "economic_sustainability_score": a.economic_sustainability_score,
                    "sustainability_rating": a.sustainability_rating,
                    "npv": a.npv,
                    "roi": a.roi,
                    "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None
                }
                for a in assessments
            ]
        }
        
    except Exception as e:
        logger.error(f"Error retrieving assessments for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/assessments/industry/{industry}")
async def get_industry_assessments(industry: str, limit: int = 100):
    """Get assessments for a specific industry"""
    try:
        assessments = db_manager.get_assessments_by_industry(industry, limit)
        
        return {
            "industry": industry,
            "count": len(assessments),
            "assessments": [
                {
                    "assessment_id": a.assessment_id,
                    "system_name": a.system_name,
                    "economic_sustainability_score": a.economic_sustainability_score,
                    "sustainability_rating": a.sustainability_rating,
                    "npv": a.npv,
                    "roi": a.roi,
                    "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None
                }
                for a in assessments
            ]
        }
        
    except Exception as e:
        logger.error(f"Error retrieving assessments for industry {industry}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "description": "Life Cycle Cost Analysis Service for Digital Twin Implementations"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.api_host, 
        port=settings.api_port,
        workers=settings.api_workers
    )
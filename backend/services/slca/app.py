import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import AssessmentNotFoundException
from .models import SLCAStructure, StakeholderGroup, STAKEHOLDER_DESCRIPTIONS, INDICATOR_DESCRIPTIONS, DEFAULT_WEIGHTINGS
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import SLCAKafkaHandler
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = SLCAKafkaHandler(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting S-LCA Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("S-LCA Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start S-LCA Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down S-LCA Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("S-LCA Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Social Life Cycle Assessment (S-LCA) Service",
    description="Microservice for calculating social sustainability scores for digital twins",
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


@app.get("/structure", response_model=SLCAStructure)
async def get_assessment_structure():
    """Get assessment structure including stakeholder groups, indicators, and scales"""
    return SLCAStructure(
        stakeholder_groups=[group.value for group in StakeholderGroup],
        stakeholder_descriptions=STAKEHOLDER_DESCRIPTIONS,
        indicators=list(INDICATOR_DESCRIPTIONS.keys()),
        indicator_descriptions=INDICATOR_DESCRIPTIONS,
        rating_scales={
            "percentage": {
                "range": [0, 100],
                "description": "Percentage scale from 0 to 100"
            },
            "job_creation": {
                "range": [0, settings.max_jobs_per_year],
                "description": f"Number of jobs created (max {settings.max_jobs_per_year} per year)"
            },
            "years": {
                "range": [settings.min_assessment_years, settings.max_assessment_years],
                "description": f"Assessment period in years ({settings.min_assessment_years}-{settings.max_assessment_years})"
            },
            "sustainability_rating": {
                "levels": ["Critical", "Poor", "Fair", "Good", "Excellent"],
                "thresholds": {
                    "Critical": [0.0, 0.2],
                    "Poor": [0.2, 0.4],
                    "Fair": [0.4, 0.6],
                    "Good": [0.6, 0.8],
                    "Excellent": [0.8, 1.0]
                }
            }
        },
        default_weightings=DEFAULT_WEIGHTINGS
    )


@app.get("/stakeholders")
async def get_stakeholder_info():
    """Get available stakeholder groups and their descriptions"""
    return {
        "groups": [group.value for group in StakeholderGroup],
        "descriptions": STAKEHOLDER_DESCRIPTIONS
    }


@app.get("/indicators")
async def get_indicators_info():
    """Get available social indicators and their descriptions"""
    return {
        "indicators": list(INDICATOR_DESCRIPTIONS.keys()),
        "descriptions": INDICATOR_DESCRIPTIONS,
        "categories": {
            "worker_focused": [
                "safety_incident_reduction",
                "worker_satisfaction",
                "skills_development",
                "health_safety_improvements",
                "fair_wages",
                "working_conditions"
            ],
            "community_focused": [
                "community_engagement",
                "local_employment",
                "community_investment",
                "cultural_preservation",
                "stakeholder_participation"
            ],
            "economic": [
                "job_creation",
                "local_employment",
                "fair_wages"
            ],
            "social_equity": [
                "gender_equality",
                "fair_wages",
                "cultural_preservation",
                "stakeholder_participation"
            ]
        }
    }


@app.get("/weightings")
async def get_default_weights():
    """Get default weighting schemes for different stakeholder groups"""
    return {
        "default_weights": DEFAULT_WEIGHTINGS,
        "description": "Recommended weighting schemes based on stakeholder group priorities",
        "usage_notes": [
            "Weights must sum to 1.0 for each stakeholder group",
            "Higher weights indicate greater importance for that stakeholder",
            "Custom weights can be provided to override defaults"
        ]
    }


@app.get("/template")
async def get_analysis_template():
    """Get a template for S-LCA analysis input"""
    years = 5
    template = {
        "stakeholderGroup": "workers",
        "years": years,
        "indicators": {
            "safety_incident_reduction": [5, 10, 15, 20, 25],
            "worker_satisfaction": [70, 75, 80, 85, 90],
            "community_engagement": [60, 65, 70, 75, 80],
            "job_creation": [2, 4, 6, 8, 10],
            "skills_development": [65, 70, 75, 80, 85],
            "health_safety_improvements": [70, 75, 80, 85, 90],
            "local_employment": [50, 55, 60, 65, 70],
            "gender_equality": [60, 62, 65, 68, 70],
            "fair_wages": [75, 77, 80, 82, 85],
            "working_conditions": [70, 73, 76, 79, 82],
            "community_investment": [40, 45, 50, 55, 60],
            "cultural_preservation": [80, 80, 81, 82, 83],
            "stakeholder_participation": [55, 60, 65, 70, 75]
        },
        "weightings": {
            "safety_incident_reduction": 0.25,
            "worker_satisfaction": 0.25,
            "community_engagement": 0.25,
            "job_creation": 0.25
        }
    }
    
    return {
        "template": template,
        "notes": [
            "All indicator arrays must have the same length as 'years'",
            "Percentage indicators should be between 0-100",
            "Job creation values are absolute numbers",
            "Custom weightings are optional - defaults will be used if not provided",
            "Weightings must sum to 1.0 if provided"
        ]
    }


@app.get("/constants")
async def get_assessment_constants():
    """Get assessment constants and limits"""
    return {
        "assessment_limits": {
            "min_years": settings.min_assessment_years,
            "max_years": settings.max_assessment_years,
            "max_jobs_per_year": settings.max_jobs_per_year
        },
        "scoring_info": {
            "stakeholder_weighting": "Different weightings applied based on stakeholder group",
            "scale_normalization": "All scores normalized to 0-1 range",
            "rating_thresholds": {
                "Critical": "0.0 - 0.2",
                "Poor": "0.2 - 0.4", 
                "Fair": "0.4 - 0.6",
                "Good": "0.6 - 0.8",
                "Excellent": "0.8 - 1.0"
            }
        },
        "trend_analysis": {
            "strongly_improving": "> 10% improvement",
            "improving": "5-10% improvement",
            "stable": "-5% to +5% change",
            "declining": "-10% to -5% decline",
            "strongly_declining": "> 10% decline"
        }
    }


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get S-LCA assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"S-LCA assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "overall_score": assessment.overall_score,
            "annual_scores": make_json_serializable(assessment.annual_scores),
            "stakeholder_group": assessment.stakeholder_group,
            "social_sustainability_rating": assessment.social_sustainability_rating,
            "stakeholder_impact_score": assessment.stakeholder_impact_score,
            "social_performance_trend": assessment.social_performance_trend,
            "key_metrics": make_json_serializable(assessment.key_metrics),
            "recommendations": make_json_serializable(assessment.recommendations),
            "detailed_metrics": make_json_serializable(assessment.detailed_metrics),
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "processed_at": assessment.processed_at.isoformat() if assessment.processed_at else None,
            "metadata": make_json_serializable(assessment.meta_data)
        }
        
        return response_data
        
    except AssessmentNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"S-LCA assessment {assessment_id} not found"
        )
    except Exception as e:
        logger.error(f"Error retrieving S-LCA assessment {assessment_id}: {e}")
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
        "description": "Social Life Cycle Assessment (S-LCA) Service for Digital Twins",
        "timestamp": datetime.utcnow().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.api_host, 
        port=settings.api_port,
        workers=settings.api_workers
    )
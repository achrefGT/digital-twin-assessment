import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import AssessmentNotFoundException
from .models import IndustryType, WeightingScheme
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import ELCAKafkaHandler
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = ELCAKafkaHandler(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting ELCA Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("ELCA Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start ELCA Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down ELCA Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("ELCA Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="ELCA Scoring Service",
    description="Microservice for calculating Environmental Life Cycle Assessment (ELCA) scores for digital twin systems",
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
    
    if settings.brightway_health_check_enabled and kafka_handler.lca_framework:
        try:
            # Simple check to see if LCA framework is responsive
            additional_checks["lca_framework_ready"] = True
        except Exception:
            additional_checks["lca_framework_ready"] = False
        
    return create_health_response(settings.service_name, additional_checks)


@app.get("/metadata")
async def get_metadata():
    """Get ELCA assessment metadata including available options"""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "supported_industries": [industry.value for industry in IndustryType],
        "available_weighting_schemes": [scheme.value for scheme in WeightingScheme],
        "assessment_years_range": {"min": 1, "max": 20, "default": settings.default_assessment_years},
        "score_range": {"min": settings.elca_scale_min, "max": settings.elca_scale_max},
        "features": {
            "regional_adjustments": settings.enable_regional_adjustments,
            "industry_scaling": settings.enable_industry_scaling,
            "detailed_metrics": settings.enable_detailed_metrics,
            "performance_monitoring": settings.enable_performance_monitoring
        }
    }


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get ELCA assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"ELCA assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using your custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "elca_score": assessment.elca_score,
            "environmental_rating": assessment.environmental_rating,
            "rating_description": assessment.rating_description,
            "category_breakdown": make_json_serializable(assessment.category_breakdown),
            "performance_analysis": make_json_serializable(assessment.performance_analysis),
            "detailed_impacts": make_json_serializable(assessment.detailed_impacts),
            "key_performance_indicators": make_json_serializable(assessment.key_performance_indicators),
            "sustainability_insights": make_json_serializable(assessment.sustainability_insights),
            "configuration_summary": make_json_serializable(assessment.configuration_summary),
            "weighting_scheme": assessment.weighting_scheme,
            "processing_time_ms": assessment.processing_time_ms,
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "processed_at": assessment.processed_at.isoformat() if assessment.processed_at else None,
            "metadata": make_json_serializable(assessment.meta_data)
        }
        
        return response_data
        
    except AssessmentNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ELCA assessment {assessment_id} not found"
        )
    except Exception as e:
        logger.error(f"Error retrieving ELCA assessment {assessment_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/assessments/user/{user_id}")
async def get_user_assessments(
    user_id: str,
    limit: int = Query(default=10, ge=1, le=100, description="Number of assessments to retrieve")
):
    """Get ELCA assessments for a specific user"""
    try:
        assessments = db_manager.get_assessments_by_user(user_id, limit)
        
        results = []
        for assessment in assessments:
            results.append({
                "assessment_id": assessment.assessment_id,
                "system_name": assessment.system_name,
                "elca_score": assessment.elca_score,
                "environmental_rating": assessment.environmental_rating,
                "weighting_scheme": assessment.weighting_scheme,
                "processing_time_ms": assessment.processing_time_ms,
                "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
                "processed_at": assessment.processed_at.isoformat() if assessment.processed_at else None
            })
        
        return {
            "user_id": user_id,
            "total_assessments": len(results),
            "assessments": results
        }
        
    except Exception as e:
        logger.error(f"Error retrieving ELCA assessments for user {user_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/assessments/recent")
async def get_recent_assessments(
    limit: int = Query(default=10, ge=1, le=100, description="Number of recent assessments to retrieve")
):
    """Get most recent ELCA assessments"""
    try:
        assessments = db_manager.get_recent_assessments(limit)
        
        results = []
        for assessment in assessments:
            results.append({
                "assessment_id": assessment.assessment_id,
                "user_id": assessment.user_id,
                "system_name": assessment.system_name,
                "elca_score": assessment.elca_score,
                "environmental_rating": assessment.environmental_rating,
                "weighting_scheme": assessment.weighting_scheme,
                "processing_time_ms": assessment.processing_time_ms,
                "created_at": assessment.created_at.isoformat() if assessment.created_at else None
            })
        
        return {
            "total_assessments": len(results),
            "assessments": results
        }
        
    except Exception as e:
        logger.error(f"Error retrieving recent ELCA assessments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/statistics")
async def get_assessment_statistics():
    """Get ELCA assessment statistics"""
    try:
        stats = db_manager.get_assessment_statistics()
        
        return {
            "service": settings.service_name,
            "statistics": stats,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error retrieving ELCA assessment statistics: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


@app.get("/industries")
async def get_supported_industries():
    """Get list of supported industries for ELCA assessment"""
    return {
        "industries": [
            {
                "value": industry.value,
                "name": industry.value.replace("_", " ").title(),
                "description": f"ELCA assessment for {industry.value.replace('_', ' ')} industry"
            }
            for industry in IndustryType
        ]
    }


@app.get("/weighting-schemes")
async def get_weighting_schemes():
    """Get available weighting schemes for ELCA scoring"""
    return {
        "weighting_schemes": [
            {
                "value": scheme.value,
                "name": scheme.value.replace("_", " ").title(),
                "description": _get_scheme_description(scheme)
            }
            for scheme in WeightingScheme
        ]
    }


def _get_scheme_description(scheme: WeightingScheme) -> str:
    """Get description for weighting scheme"""
    descriptions = {
        WeightingScheme.RECIPE_2016: "ReCiPe 2016 - Balanced weighting with emphasis on digital footprint",
        WeightingScheme.IPCC_FOCUSED: "IPCC-focused - Climate change weighted at 50% for carbon-focused assessment",
        WeightingScheme.EQUAL_WEIGHTS: "Equal weights - All impact categories weighted equally"
    }
    return descriptions.get(scheme, "Standard ELCA weighting scheme")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "description": "Environmental Life Cycle Assessment (ELCA) scoring service for digital twin systems",
        "status": "running",
        "features": {
            "lca_framework_ready": kafka_handler.lca_framework is not None,
            "supported_industries": len(IndustryType),
            "weighting_schemes": len(WeightingScheme),
            "regional_adjustments": settings.enable_regional_adjustments,
            "industry_scaling": settings.enable_industry_scaling
        },
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
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
from .models import HumanCentricityStructure, ASSESSMENT_STATEMENTS
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import HumanCentricityKafkaHandler
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = HumanCentricityKafkaHandler(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Human Centricity Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("Human Centricity Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start Human Centricity Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Human Centricity Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("Human Centricity Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Human Centricity Assessment Service",
    description="Microservice for calculating human-centric digital twin scores",
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


@app.get("/structure", response_model=HumanCentricityStructure)
async def get_assessment_structure():
    """Get assessment structure including statements and scales"""
    return HumanCentricityStructure(
        statements=ASSESSMENT_STATEMENTS,
        scales={
            "likert": {
                "range": [1, 7],
                "labels": {
                    1: "Strongly Disagree",
                    2: "Disagree", 
                    3: "Somewhat Disagree",
                    4: "Neutral",
                    5: "Somewhat Agree",
                    6: "Agree",
                    7: "Strongly Agree"
                }
            },
            "workload": {
                "range": [0, 100],
                "description": "0 = Very Low, 100 = Very High"
            },
            "cybersickness": {
                "range": [1, 5],
                "labels": {
                    1: "None",
                    2: "Slight",
                    3: "Moderate", 
                    4: "Severe",
                    5: "Very Severe"
                }
            },
            "sam_valence": {
                "range": [1, 5],
                "labels": {
                    1: "Very Negative",
                    2: "Negative",
                    3: "Neutral",
                    4: "Positive", 
                    5: "Very Positive"
                }
            },
            "sam_arousal": {
                "range": [1, 5],
                "labels": {
                    1: "Very Calm",
                    2: "Calm",
                    3: "Neutral",
                    4: "Excited",
                    5: "Very Excited"
                }
            }
        }
    )


@app.get("/constants")
async def get_assessment_constants():
    """Get assessment constants and limits"""
    return {
        "performance_limits": {
            "max_time_minutes": settings.max_time_minutes,
            "max_errors": settings.max_errors,
            "max_help_requests": settings.max_help_requests
        },
        "scoring_info": {
            "domain_weights": "Equal weighting across all domains",
            "scale_normalization": "All scores normalized to 0-100 range",
            "performance_scoring": "Lower values (time, errors, help) result in higher scores"
        }
    }


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get human centricity assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using your custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "overall_score": assessment.overall_score,
            "domain_scores": make_json_serializable(assessment.domain_scores),
            "detailed_metrics": make_json_serializable(assessment.detailed_metrics),
            "submitted_at": assessment.submitted_at.isoformat() if assessment.submitted_at else None,
            "processed_at": assessment.processed_at.isoformat() if assessment.processed_at else None,
            "metadata": make_json_serializable(assessment.meta_data)
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


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "status": "running",
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
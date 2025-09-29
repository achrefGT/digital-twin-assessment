import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, status, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import AssessmentNotFoundException
from .models import (
    SustainabilityScenarios, SUSTAINABILITY_SCENARIOS, CriterionCreate, 
    CriterionUpdate, CriterionResponse
)
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import SustainabilityKafkaHandler
from .criterion_manager import CriterionManager
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = SustainabilityKafkaHandler(db_manager)
criterion_manager = CriterionManager(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Sustainability Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("Sustainability Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start Sustainability Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Sustainability Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("Sustainability Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Sustainability Assessment Service",
    description="Microservice for calculating digital twin sustainability scores across environmental, economic, and social dimensions",
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


@app.get("/scenarios", response_model=SustainabilityScenarios)
async def get_sustainability_scenarios():
    """Get available sustainability assessment criteria"""
    try:
        config = criterion_manager.get_current_scenarios_config()
        return SustainabilityScenarios(scenarios=config['scenarios'])
    except Exception as e:
        logger.error(f"Error retrieving scenarios: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scenarios"
        )


# Criterion Management Endpoints

@app.get("/criteria/all", response_model=List[CriterionResponse])
async def get_all_criteria():
    """Get all criteria with detailed information"""
    try:
        return criterion_manager.get_all_criteria()
    except Exception as e:
        logger.error(f"Error retrieving all criteria: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve criteria"
        )


@app.get("/criteria/domain/{domain}", response_model=List[CriterionResponse])
async def get_criteria_by_domain(domain: str = Path(..., description="Domain name")):
    """Get criteria for a specific domain"""
    try:
        criteria = criterion_manager.get_criteria_by_domain(domain)
        if not criteria:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No criteria found for domain {domain}"
            )
        return criteria
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving criteria for domain {domain}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve domain criteria"
        )


@app.get("/criteria/{domain}/{criterion_key}", response_model=CriterionResponse)
async def get_criterion_by_key(
    domain: str = Path(..., description="Domain name"),
    criterion_key: str = Path(..., description="Criterion key")
):
    """Get a specific criterion by domain and key"""
    try:
        criterion = criterion_manager.get_criterion_by_key(domain, criterion_key)
        if not criterion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Criterion {criterion_key} not found in domain {domain}"
            )
        return criterion
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving criterion {criterion_key} for domain {domain}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve criterion"
        )


@app.post("/criteria", response_model=CriterionResponse, status_code=status.HTTP_201_CREATED)
async def create_criterion(criterion: CriterionCreate):
    """Create a new sustainability criterion"""
    try:
        return criterion_manager.create_criterion(criterion)
    except ValueError as e:
        logger.warning(f"Validation error creating criterion: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating criterion: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create criterion"
        )


@app.put("/criteria/{criterion_id}", response_model=CriterionResponse)
async def update_criterion(
    criterion_id: str = Path(..., description="Criterion ID"),
    criterion_update: CriterionUpdate = Body(...)
):
    """Update an existing criterion"""
    try:
        updated_criterion = criterion_manager.update_criterion(criterion_id, criterion_update)
        if not updated_criterion:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Criterion {criterion_id} not found"
            )
        return updated_criterion
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating criterion {criterion_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update criterion"
        )


@app.delete("/criteria/{criterion_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_criterion(criterion_id: str = Path(..., description="Criterion ID")):
    """Delete a criterion"""
    try:
        success = criterion_manager.delete_criterion(criterion_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Criterion {criterion_id} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting criterion {criterion_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete criterion"
        )


@app.post("/criteria/reset")
async def reset_criteria(request_body: Optional[Dict[str, Any]] = Body(None)):
    """Reset criteria to defaults for a domain or all domains"""
    try:
        # Extract domain from request body if provided
        domain = None
        if request_body and isinstance(request_body, dict):
            domain = request_body.get("domain")
        
        success = criterion_manager.reset_to_defaults(domain)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to reset criteria{f' for domain {domain}' if domain else ''}"
            )
        
        return {
            "message": f"Successfully reset criteria{f' for domain {domain}' if domain else ''} to defaults",
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting criteria: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset criteria"
        )


@app.post("/criteria/validate")
async def validate_assessment_criteria(assessments: Dict[str, Any] = Body(...)):
    """Validate that assessment criteria exist in current configuration"""
    try:
        missing_criteria = criterion_manager.validate_assessments_compatibility(assessments)
        
        if missing_criteria:
            return {
                "valid": False,
                "missing_criteria": missing_criteria,
                "message": "Some criteria in the assessment are not found in current configuration"
            }
        else:
            return {
                "valid": True,
                "message": "All assessment criteria are valid"
            }
    except Exception as e:
        logger.error(f"Error validating assessment criteria: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate assessment criteria"
        )


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get sustainability assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using your custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "overall_score": assessment.overall_score,
            "dimension_scores": make_json_serializable(assessment.dimension_scores),
            "sustainability_metrics": make_json_serializable(assessment.sustainability_metrics),
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
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "sustainability_scoring",
            "criterion_management",
            "dynamic_configuration"
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.api_host, 
        port=settings.api_port,
        workers=settings.api_workers
    )
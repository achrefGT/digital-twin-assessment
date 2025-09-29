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
    ResilienceScenarios, RESILIENCE_SCENARIOS, ScenarioCreate, 
    ScenarioUpdate, ScenarioResponse
)
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import ResilienceKafkaHandler
from .scenario_manager import ScenarioManager
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = ResilienceKafkaHandler(db_manager)
scenario_manager = ScenarioManager(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Resilience Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Start Kafka handler
        await kafka_handler.start()
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("Resilience Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start Resilience Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Resilience Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        await kafka_handler.stop()
        logger.info("Resilience Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Resilience Scoring Service",
    description="Microservice for calculating digital twin resilience scores",
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


@app.get("/scenarios", response_model=ResilienceScenarios)
async def get_resilience_scenarios():
    """Get available resilience scenarios for assessment"""
    try:
        config = scenario_manager.get_current_scenarios_config()
        return ResilienceScenarios(
            scenarios=config['scenarios'],
            domain_descriptions=config['domain_descriptions'],
            scenario_categories={}  # Can be extended if needed
        )
    except Exception as e:
        logger.error(f"Error retrieving scenarios: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scenarios"
        )


# Scenario Management Endpoints

@app.get("/scenarios/all", response_model=List[ScenarioResponse])
async def get_all_scenarios():
    """Get all scenarios with detailed information"""
    try:
        return scenario_manager.get_all_scenarios()
    except Exception as e:
        logger.error(f"Error retrieving all scenarios: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scenarios"
        )


@app.get("/scenarios/domain/{domain}", response_model=List[ScenarioResponse])
async def get_scenarios_by_domain(domain: str = Path(..., description="Domain name")):
    """Get scenarios for a specific domain"""
    try:
        scenarios = scenario_manager.get_scenarios_by_domain(domain)
        if not scenarios:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No scenarios found for domain {domain}"
            )
        return scenarios
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving scenarios for domain {domain}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve domain scenarios"
        )


@app.post("/scenarios", response_model=ScenarioResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(scenario: ScenarioCreate):
    """Create a new resilience scenario"""
    try:
        return scenario_manager.create_scenario(scenario)
    except Exception as e:
        logger.error(f"Error creating scenario: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create scenario"
        )


@app.put("/scenarios/{scenario_id}", response_model=ScenarioResponse)
async def update_scenario(
    scenario_id: str = Path(..., description="Scenario ID"),
    scenario_update: ScenarioUpdate = Body(...)
):
    """Update an existing scenario"""
    try:
        updated_scenario = scenario_manager.update_scenario(scenario_id, scenario_update)
        if not updated_scenario:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario {scenario_id} not found"
            )
        return updated_scenario
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating scenario {scenario_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update scenario"
        )


@app.delete("/scenarios/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scenario(scenario_id: str = Path(..., description="Scenario ID")):
    """Delete a scenario"""
    try:
        success = scenario_manager.delete_scenario(scenario_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scenario {scenario_id} not found"
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting scenario {scenario_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete scenario"
        )


@app.post("/scenarios/reset")
async def reset_scenarios(request_body: Optional[Dict[str, Any]] = Body(None)):
    """Reset scenarios to defaults for a domain or all domains"""
    try:
        # Extract domain from request body if provided
        domain = None
        if request_body and isinstance(request_body, dict):
            domain = request_body.get("domain")
        
        success = scenario_manager.reset_to_defaults(domain)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to reset scenarios{f' for domain {domain}' if domain else ''}"
            )
        
        return {
            "message": f"Successfully reset scenarios{f' for domain {domain}' if domain else ''} to defaults",
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting scenarios: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset scenarios"
        )


@app.post("/scenarios/validate")
async def validate_assessment_scenarios(assessments: Dict[str, Any] = Body(...)):
    """Validate that assessment scenarios exist in current configuration"""
    try:
        missing_scenarios = scenario_manager.validate_assessments_compatibility(assessments)
        
        if missing_scenarios:
            return {
                "valid": False,
                "missing_scenarios": missing_scenarios,
                "message": "Some scenarios in the assessment are not found in current configuration"
            }
        else:
            return {
                "valid": True,
                "message": "All assessment scenarios are valid"
            }
    except Exception as e:
        logger.error(f"Error validating assessment scenarios: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to validate assessment scenarios"
        )


@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get resilience assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using your custom function
        response_data = {
            "assessment_id": assessment.assessment_id,
            "overall_score": assessment.overall_score,
            "domain_scores": make_json_serializable(assessment.domain_scores),
            "risk_metrics": make_json_serializable(assessment.risk_metrics),
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
            "resilience_scoring",
            "scenario_management",
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
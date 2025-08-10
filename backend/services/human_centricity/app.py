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
from .models import (
    HumanCentricityStructure, ASSESSMENT_STATEMENTS, ASSESSMENT_SCALES, 
    ASSESSMENT_STRUCTURE, PERFORMANCE_CONSTANTS
)
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


@app.get("/structure")
async def get_assessment_structure():
    """Get complete assessment structure including statements, scales, and section organization"""
    return {
        "assessment_structure": ASSESSMENT_STRUCTURE,
        "statements": ASSESSMENT_STATEMENTS,
        "scales": ASSESSMENT_SCALES,
        "performance_constants": PERFORMANCE_CONSTANTS,
        "metadata": {
            "total_sections": len(ASSESSMENT_STRUCTURE['sections']),
            "total_likert_statements": (
                len(ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX']) + 
                len(ASSESSMENT_STATEMENTS['Section2_Trust_Transparency'])
            ),
            "workload_metrics_count": len(ASSESSMENT_STATEMENTS['Section3_Workload_Metrics']['metrics']),
            "cybersickness_symptoms_count": len(ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms']),
            "sam_components_count": 2,  # valence and arousal
            "performance_metrics_count": len(ASSESSMENT_STATEMENTS['Section5_Objective_Performance']['metrics'])
        }
    }


@app.get("/structure/simple", response_model=HumanCentricityStructure)
async def get_simple_assessment_structure():
    """Get simplified assessment structure (legacy compatibility)"""
    return HumanCentricityStructure(
        statements=ASSESSMENT_STATEMENTS,
        scales=ASSESSMENT_SCALES
    )


@app.get("/sections")
async def get_assessment_sections():
    """Get assessment sections for dynamic form generation"""
    return {
        "sections": ASSESSMENT_STRUCTURE['sections'],
        "section_count": len(ASSESSMENT_STRUCTURE['sections']),
        "description": "Structured sections for building the human centricity assessment form"
    }


@app.get("/sections/{section_id}")
async def get_assessment_section(section_id: str):
    """Get specific assessment section details"""
    section = next(
        (s for s in ASSESSMENT_STRUCTURE['sections'] if s['id'] == section_id), 
        None
    )
    
    if not section:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Section '{section_id}' not found"
        )
    
    # Add scale details
    if 'scale' in section:
        section['scale_details'] = ASSESSMENT_SCALES.get(section['scale'], {})
    
    return section


@app.get("/constants")
async def get_assessment_constants():
    """Get assessment constants and limits"""
    return {
        "performance_limits": {
            "max_time_minutes": PERFORMANCE_CONSTANTS['MAX_TIME'],
            "max_errors": PERFORMANCE_CONSTANTS['MAX_ERRORS'], 
            "max_help_requests": PERFORMANCE_CONSTANTS['MAX_HELP']
        },
        "scoring_info": {
            "domain_weights": "Equal weighting across all domains",
            "scale_normalization": "All scores normalized to 0-100 range",
            "performance_scoring": "Lower values (time, errors, help) result in higher scores"
        },
        "validation_rules": {
            "likert_range": [1, 7],
            "workload_range": [0, 100],
            "cybersickness_range": [1, 5],
            "sam_range": [1, 5],
            "performance_minimums": {
                "task_completion_time_min": 0.0,
                "error_rate": 0,
                "help_requests": 0
            }
        }
    }


@app.get("/statements")
async def get_all_statements():
    """Get all assessment statements organized by section"""
    return {
        "statements": ASSESSMENT_STATEMENTS,
        "statement_counts": {
            "core_usability_ux": len(ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX']),
            "trust_transparency": len(ASSESSMENT_STATEMENTS['Section2_Trust_Transparency']),
            "workload_metrics": len(ASSESSMENT_STATEMENTS['Section3_Workload_Metrics']['metrics']),
            "cybersickness_symptoms": len(ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms']),
            "performance_metrics": len(ASSESSMENT_STATEMENTS['Section5_Objective_Performance']['metrics'])
        },
        "total_statements": (
            len(ASSESSMENT_STATEMENTS['Section1_Core_Usability_UX']) +
            len(ASSESSMENT_STATEMENTS['Section2_Trust_Transparency']) +
            len(ASSESSMENT_STATEMENTS['Section3_Workload_Metrics']['metrics']) +
            len(ASSESSMENT_STATEMENTS['Section3_Cybersickness_Symptoms']['symptoms']) +
            len(ASSESSMENT_STATEMENTS['Section5_Objective_Performance']['metrics'])
        )
    }


@app.get("/scales")
async def get_all_scales():
    """Get all assessment scales and their definitions"""
    return {
        "scales": ASSESSMENT_SCALES,
        "scale_types": list(ASSESSMENT_SCALES.keys()),
        "description": "Scale definitions for all assessment components"
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
        "timestamp": datetime.utcnow().isoformat(),
        "available_endpoints": {
            "structure": "/structure - Complete assessment structure",
            "sections": "/sections - Assessment sections for form generation",
            "statements": "/statements - All assessment statements",  
            "scales": "/scales - All scale definitions",
            "constants": "/constants - Performance limits and validation rules",
            "assessment": "/assessment/{id} - Get assessment results by ID"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.api_host, 
        port=settings.api_port,
        workers=settings.api_workers
    )
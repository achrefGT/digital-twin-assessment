import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any, List, Set

from fastapi import FastAPI, HTTPException, status, Query, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.encoders import jsonable_encoder

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import AssessmentNotFoundException
from .models import (
    HumanCentricityStructure, HumanCentricityDomain, StatementCreate, StatementUpdate, 
    StatementResponse, ASSESSMENT_STRUCTURE, PERFORMANCE_CONSTANTS,
    FIXED_DOMAINS, DEFAULT_STATEMENTS
)
from .database import DatabaseManager, make_json_serializable
from .kafka_handler import HumanCentricityKafkaHandler
from .statement_manager import StatementManager
from .config import settings

# Setup logging
logger = setup_logging(settings.service_name, settings.log_level)

# Global instances
db_manager = DatabaseManager()
kafka_handler = HumanCentricityKafkaHandler(db_manager)
statement_manager = StatementManager(db_manager)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Human Centricity Service...")
    
    try:
        # Create database tables
        db_manager.create_tables()
        
        # Initialize statement manager (creates default statements if needed)
        # This is handled automatically in StatementManager.__init__
        
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
    description="Microservice for calculating human-centric digital twin scores with dynamic statement management",
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


# Health and Info Endpoints

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    additional_checks = {}
    
    if settings.kafka_health_check_enabled:
        additional_checks["kafka_connected"] = kafka_handler.is_running()
    
    if settings.database_health_check_enabled:
        additional_checks["database_connected"] = db_manager.health_check()
        
    return create_health_response(settings.service_name, additional_checks)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "dynamic_statement_management",
            "fixed_domain_structure", 
            "custom_statement_creation",
            "assessment_preview",
            "bulk_operations"
        ],
        "available_endpoints": {
            "domains": "/domains - List all assessment domains",
            "statements": "/statements - Manage assessment statements",
            "structure": "/structure - Complete assessment structure",
            "scales": "/scales - Scale definitions",
            "assessment": "/assessment/{id} - Get assessment results by ID",
            "admin": "/admin/* - Administrative endpoints"
        }
    }


# Domain Endpoints

@app.get("/domains")
async def get_all_domains():
    """Get all fixed domains with their configuration and statement counts"""
    try:
        domains = statement_manager.get_all_domains()
        return {
            "domains": {domain.value: info for domain, info in domains.items()},
            "total_domains": len(domains),
            "enabled_domains": [d.value for d in statement_manager.get_enabled_domains()],
            "metadata": {
                "domain_management": "read_only",
                "statement_management": "full_crud",
                "customization_level": "statement_level_only"
            }
        }
    except Exception as e:
        logger.error(f"Error retrieving domains: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve domains"
        )


@app.get("/domains/{domain}")
async def get_domain_info(domain: HumanCentricityDomain):
    """Get information about a specific domain"""
    try:
        domain_info = statement_manager.get_domain_info(domain)
        if not domain_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Domain '{domain.value}' not found"
            )
        
        statements = statement_manager.get_statements_by_domain(domain)
        
        return {
            "domain": domain.value,
            "config": domain_info,
            "statements": [stmt.dict() for stmt in statements],
            "statement_count": len(statements),
            "compatible_widgets": statement_manager.get_compatible_widgets_for_domain(domain),
            "compatible_scales": statement_manager.get_compatible_scales_for_domain(domain)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving domain {domain.value}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve domain information"
        )


# Statement Management Endpoints

@app.get("/statements", response_model=List[StatementResponse])
async def get_all_statements(
    domain: Optional[HumanCentricityDomain] = Query(None, description="Filter by domain"),
    active_only: bool = Query(True, description="Return only active statements")
):
    """Get all statements or filter by domain"""
    try:
        if domain:
            statements = statement_manager.get_statements_by_domain(domain)
        else:
            statements = statement_manager.get_all_statements()
        
        if not active_only:
            # For now, we only support active statements in the main endpoint
            # Inactive statements can be accessed via admin endpoints
            pass
        
        return statements
    except Exception as e:
        logger.error(f"Error retrieving statements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statements"
        )


@app.get("/statements/{statement_id}", response_model=StatementResponse)
async def get_statement(statement_id: str):
    """Get statement by ID"""
    try:
        statement = statement_manager.get_statement_by_id(statement_id)
        if not statement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement '{statement_id}' not found"
            )
        return statement
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving statement {statement_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statement"
        )


@app.post("/statements", response_model=StatementResponse, status_code=status.HTTP_201_CREATED)
async def create_statement(statement_data: StatementCreate):
    """Create new custom statement"""
    try:
        statement = statement_manager.create_statement(statement_data)
        logger.info(f"Created new statement: {statement.id} in domain {statement.domain_key.value}")
        return statement
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error creating statement: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create statement"
        )


@app.put("/statements/{statement_id}", response_model=StatementResponse)
async def update_statement(statement_id: str, statement_update: StatementUpdate):
    """Update existing statement"""
    try:
        updated_statement = statement_manager.update_statement(statement_id, statement_update)
        if not updated_statement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement '{statement_id}' not found"
            )
        logger.info(f"Updated statement: {statement_id}")
        return updated_statement
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating statement {statement_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update statement"
        )


@app.delete("/statements/{statement_id}")
async def delete_statement(statement_id: str):
    """Delete statement"""
    try:
        success = statement_manager.delete_statement(statement_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement '{statement_id}' not found"
            )
        logger.info(f"Deleted statement: {statement_id}")
        return {"message": "Statement deleted successfully", "statement_id": statement_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting statement {statement_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete statement"
        )


@app.post("/statements/{statement_id}/duplicate", response_model=StatementResponse)
async def duplicate_statement(
    statement_id: str, 
    new_text: Optional[str] = Body(None, description="New statement text")
):
    """Duplicate an existing statement"""
    try:
        duplicated_statement = statement_manager.duplicate_statement(statement_id, new_text)
        if not duplicated_statement:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Statement '{statement_id}' not found"
            )
        logger.info(f"Duplicated statement {statement_id} -> {duplicated_statement.id}")
        return duplicated_statement
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error duplicating statement {statement_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to duplicate statement"
        )


# Domain Statement Management

@app.put("/domains/{domain}/statements/reorder")
async def reorder_domain_statements(domain: HumanCentricityDomain, statement_ids: List[str]):
    """Reorder statements within a domain"""
    try:
        success = statement_manager.reorder_statements_in_domain(domain, statement_ids)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reorder statements - check that all IDs belong to the domain"
            )
        logger.info(f"Reordered statements in domain {domain.value}")
        return {"message": "Statements reordered successfully", "domain": domain.value}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reordering statements in domain {domain.value}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reorder statements"
        )


@app.post("/domains/{domain}/reset")
async def reset_domain_to_defaults(domain: HumanCentricityDomain):
    """Reset domain statements to defaults"""
    try:
        success = statement_manager.reset_domain_to_defaults(domain)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to reset domain to defaults"
            )
        logger.info(f"Reset domain {domain.value} to defaults")
        return {"message": f"Domain {domain.value} reset to defaults successfully"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resetting domain {domain.value}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to reset domain"
        )


# Assessment Structure and Configuration

@app.get("/structure")
async def get_assessment_structure():
    """Get complete dynamic assessment structure"""
    try:
        structure = statement_manager.get_assessment_structure()
        return {
            "structure": structure,
            "validation": statement_manager.validate_assessment_structure(),
            "metadata": {
                "structure_type": "dynamic",
                "supports_customization": True,
                "statement_management": "enabled"
            }
        }
    except Exception as e:
        logger.error(f"Error retrieving assessment structure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve assessment structure"
        )


@app.get("/structure/legacy", response_model=HumanCentricityStructure)
async def get_legacy_assessment_structure():
    """Get legacy assessment structure format for backward compatibility"""
    try:
        all_statements = statement_manager.get_all_statements()
        
        # Convert to legacy format - this is a simplified conversion
        # In a real implementation, you might want to maintain better backward compatibility
        legacy_statements = {}
        for stmt in all_statements:
            domain_key = f"Section_{stmt.domain_key.value}"
            if domain_key not in legacy_statements:
                legacy_statements[domain_key] = []
            legacy_statements[domain_key].append({
                "id": stmt.id,
                "text": stmt.statement_text,
                "widget": stmt.widget,
                "scale": stmt.scale_key
            })
        
        return HumanCentricityStructure(
            domains={"legacy_mode": "This endpoint provides backward compatibility"},
        )
    except Exception as e:
        logger.error(f"Error retrieving legacy assessment structure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve legacy assessment structure"
        )


@app.get("/structure/preview")
async def get_assessment_preview(
    domains: Optional[List[HumanCentricityDomain]] = Query(None, description="Selected domains for preview")
):
    """Get assessment preview for selected domains"""
    try:
        selected_domains = set(domains) if domains else None
        preview = statement_manager.get_assessment_preview(selected_domains)
        return preview
    except Exception as e:
        logger.error(f"Error generating assessment preview: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate assessment preview"
        )


# Scale and Configuration Endpoints

@app.get("/scales")
async def get_all_scales():
    """Get all assessment scales and their definitions"""
    try:
        scales = statement_manager.get_all_scales()
        return {
            "scales": scales,
            "scale_types": list(scales.keys()),
            "description": "Scale definitions for all assessment components"
        }
    except Exception as e:
        logger.error(f"Error retrieving scales: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scales"
        )


@app.get("/scales/{scale_key}")
async def get_scale_info(scale_key: str):
    """Get information about a specific scale"""
    try:
        scale_info = statement_manager.get_scale_info(scale_key)
        if not scale_info:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Scale '{scale_key}' not found"
            )
        return {"scale_key": scale_key, "scale_info": scale_info}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving scale {scale_key}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve scale information"
        )


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
        "validation_rules": ASSESSMENT_STRUCTURE.get('validation_rules', {}),
        "fixed_domains": {domain.value: config for domain, config in FIXED_DOMAINS.items()}
    }


# Assessment Results

@app.get("/assessment/{assessment_id}")
async def get_assessment_result(assessment_id: str):
    """Get human centricity assessment result by ID"""
    try:
        assessment = db_manager.get_assessment(assessment_id)
        if not assessment:
            raise AssessmentNotFoundException(f"Assessment {assessment_id} not found")
        
        # Convert to JSON-safe format using the custom function
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


# Admin and Bulk Operations

@app.post("/statements/bulk-update")
async def bulk_update_statements(updates: List[Dict[str, Any]]):
    """Bulk update multiple statements"""
    try:
        results = statement_manager.bulk_update_statements(updates)
        return {
            "operation": "bulk_update",
            "results": results,
            "summary": {
                "total": results['total'],
                "successful": len(results['successful']),
                "failed": len(results['failed'])
            }
        }
    except Exception as e:
        logger.error(f"Error in bulk update: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bulk update failed"
        )


@app.delete("/statements/bulk-delete")
async def bulk_delete_statements(statement_ids: List[str]):
    """Bulk delete multiple statements"""
    try:
        results = statement_manager.bulk_delete_statements(statement_ids)
        return {
            "operation": "bulk_delete",
            "results": results,
            "summary": {
                "total": results['total'],
                "successful": len(results['successful']),
                "failed": len(results['failed'])
            }
        }
    except Exception as e:
        logger.error(f"Error in bulk delete: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Bulk delete failed"
        )


@app.get("/statements/export")
async def export_statements(
    format: str = Query("json", description="Export format"),
    include_inactive: bool = Query(False, description="Include inactive statements")
):
    """Export statements"""
    try:
        export_data = statement_manager.export_statements(format, include_inactive)
        return export_data
    except Exception as e:
        logger.error(f"Error exporting statements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Export failed"
        )


@app.post("/statements/import")
async def import_statements(
    import_data: Dict[str, Any],
    overwrite_existing: bool = Query(False, description="Overwrite existing statements")
):
    """Import statements"""
    try:
        results = statement_manager.import_statements(import_data, overwrite_existing)
        return {
            "operation": "import",
            "results": results,
            "summary": {
                "total": results['total'],
                "successful": len(results['successful']),
                "failed": len(results['failed']),
                "skipped": len(results['skipped'])
            }
        }
    except Exception as e:
        logger.error(f"Error importing statements: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Import failed"
        )


@app.get("/validation")
async def validate_assessment_structure():
    """Validate current assessment structure"""
    try:
        validation_result = statement_manager.validate_assessment_structure()
        return validation_result
    except Exception as e:
        logger.error(f"Error validating structure: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Validation failed"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=settings.api_host, 
        port=settings.api_port,
        workers=settings.api_workers
    )
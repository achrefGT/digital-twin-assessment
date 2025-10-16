"""
Recommendation Service - FastAPI Application
Follows sustainability service pattern with lifespan management
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Optional, Dict, Any, List

from fastapi import FastAPI, HTTPException, status, Path, Query, Body
from fastapi.middleware.cors import CORSMiddleware

from shared.logging_config import setup_logging
from shared.health import create_health_response
from shared.models.exceptions import DatabaseConnectionException

from .kafka_handler import RecommendationKafkaHandler
from .database import (
    RecommendationDatabaseManager,
    RecommendationStatus,
    RecommendationPriority
)
from .ai_engine import AIRecommendationEngine
from .config import get_config

# Setup logging
config = get_config()
logger = setup_logging("recommendation-service", config.log_level)

# Global instances
db_manager = None
kafka_handler = None
ai_engine = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    global db_manager, kafka_handler, ai_engine
    
    # Startup
    logger.info("Starting Recommendation Service...")
    
    try:
        # Initialize Database
        logger.info("Initializing database...")
        db_manager = RecommendationDatabaseManager(config.database_url)
        db_manager.create_tables()
        logger.info("✅ Database initialized")
        
        # Initialize AI Engine
        logger.info("Initializing AI engine...")
        ai_engine = AIRecommendationEngine()
        logger.info("✅ AI Engine initialized")
        
        # Initialize Kafka Handler
        logger.info("Initializing Kafka handler...")
        kafka_handler = RecommendationKafkaHandler(db_manager, ai_engine)
        await kafka_handler.start()
        logger.info("✅ Kafka handler initialized")
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_handler.consume_messages())
        
        logger.info("🚀 Recommendation Service started successfully")
        
        yield
        
    except Exception as e:
        logger.error(f"❌ Failed to start Recommendation Service: {e}")
        raise
    finally:
        # Shutdown
        logger.info("Shutting down Recommendation Service...")
        if 'consumer_task' in locals():
            consumer_task.cancel()
            try:
                await consumer_task
            except asyncio.CancelledError:
                pass
        if kafka_handler:
            await kafka_handler.stop()
        logger.info("✅ Recommendation Service shutdown complete")


# Create FastAPI app
app = FastAPI(
    title="Digital Twin Recommendation Service",
    description="Microservice for generating AI-powered recommendations for digital twin assessments",
    version="0.2.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Health & Info Endpoints
# ============================================================================

@app.get("/api/recommendations/health")
async def health_check():
    """Health check endpoint"""
    additional_checks = {}
    
    if kafka_handler:
        additional_checks["kafka_connected"] = kafka_handler.is_running()
    
    if db_manager:
        additional_checks["database_connected"] = db_manager.health_check()
    
    if ai_engine:
        additional_checks["ai_engine_ready"] = True
        
    return create_health_response("recommendation-service", additional_checks)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "recommendation-service",
        "version": "0.2.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "features": [
            "ai_recommendations",
            "custom_criteria_support",
            "database_persistence",
            "user_feedback",
            "implementation_tracking"
        ]
    }


# ============================================================================
# Recommendation Query Endpoints
# ============================================================================

@app.get("/api/recommendations/assessment/{assessment_id}")
async def get_recommendations_by_assessment(
    assessment_id: str = Path(..., description="Assessment ID"),
    latest_only: bool = Query(True, description="Return only the latest recommendation set")
):
    """
    Get recommendations for a specific assessment from database
    
    Args:
        assessment_id: Assessment ID
        latest_only: If True, return only the most recent recommendation set
    """
    try:
        rec_sets = db_manager.get_recommendations_by_assessment(
            assessment_id=assessment_id,
            latest_only=latest_only
        )
        
        if not rec_sets:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No recommendations found for assessment {assessment_id}"
            )
        
        # Convert to response format
        result = []
        for rec_set in rec_sets:
            result.append({
                "recommendation_set_id": rec_set.recommendation_set_id,
                "assessment_id": rec_set.assessment_id,
                "generated_at": rec_set.generated_at.isoformat(),
                "source": rec_set.source.value if hasattr(rec_set.source, 'value') else rec_set.source,
                "model_used": rec_set.model_used,
                "generation_time_ms": rec_set.generation_time_ms,
                "overall_score": rec_set.overall_score,
                "domain_scores": rec_set.domain_scores,
                "total_recommendations": rec_set.total_recommendations,
                "has_custom_criteria": rec_set.has_custom_criteria,
                "recommendations_by_priority": rec_set.recommendations_by_priority,
                "recommendations_by_domain": rec_set.recommendations_by_domain,
                "recommendations": [
                    {
                        "recommendation_id": rec.recommendation_id,
                        "domain": rec.domain,
                        "category": rec.category,
                        "title": rec.title,
                        "description": rec.description,
                        "priority": rec.priority.value if hasattr(rec.priority, 'value') else rec.priority,
                        "estimated_impact": rec.estimated_impact,
                        "implementation_effort": rec.implementation_effort,
                        "criterion_id": rec.criterion_id,
                        "is_custom_criterion": rec.is_custom_criterion,
                        "status": rec.status.value if hasattr(rec.status, 'value') else rec.status,
                        "user_rating": rec.user_rating,
                        "confidence_score": rec.confidence_score
                    }
                    for rec in rec_set.recommendations
                ]
            })
        
        return {"recommendation_sets": result} if not latest_only else result[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recommendations"
        )


@app.get("/api/recommendations/user/{user_id}")
async def get_recommendations_by_user(
    user_id: str = Path(..., description="User ID"),
    limit: int = Query(10, ge=1, le=100, description="Maximum number of recommendation sets to return")
):
    """Get recent recommendation sets for a user"""
    try:
        rec_sets = db_manager.get_recommendations_by_user(
            user_id=user_id,
            limit=limit
        )
        
        if not rec_sets:
            return {"recommendation_sets": []}
        
        # Convert to response format (simplified)
        result = []
        for rec_set in rec_sets:
            result.append({
                "recommendation_set_id": rec_set.recommendation_set_id,
                "assessment_id": rec_set.assessment_id,
                "generated_at": rec_set.generated_at.isoformat(),
                "total_recommendations": rec_set.total_recommendations,
                "overall_score": rec_set.overall_score,
                "domain_scores": rec_set.domain_scores,
                "has_custom_criteria": rec_set.has_custom_criteria,
                "source": rec_set.source.value if hasattr(rec_set.source, 'value') else rec_set.source
            })
        
        return {"recommendation_sets": result}
        
    except Exception as e:
        logger.error(f"Failed to retrieve user recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve user recommendations"
        )


@app.get("/api/recommendations/{recommendation_set_id}")
async def get_recommendation_set(
    recommendation_set_id: str = Path(..., description="Recommendation Set ID")
):
    """Get a specific recommendation set by ID with full details"""
    try:
        rec_set = db_manager.get_recommendation_set(recommendation_set_id)
        
        if not rec_set:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation set {recommendation_set_id} not found"
            )
        
        return {
            "recommendation_set_id": rec_set.recommendation_set_id,
            "assessment_id": rec_set.assessment_id,
            "user_id": rec_set.user_id,
            "generated_at": rec_set.generated_at.isoformat(),
            "source": rec_set.source.value if hasattr(rec_set.source, 'value') else rec_set.source,
            "model_used": rec_set.model_used,
            "generation_time_ms": rec_set.generation_time_ms,
            "overall_score": rec_set.overall_score,
            "domain_scores": rec_set.domain_scores,
            "total_recommendations": rec_set.total_recommendations,
            "has_custom_criteria": rec_set.has_custom_criteria,
            "custom_criteria_info": rec_set.custom_criteria_info,
            "recommendations_by_priority": rec_set.recommendations_by_priority,
            "recommendations_by_domain": rec_set.recommendations_by_domain,
            "recommendations": [
                {
                    "recommendation_id": rec.recommendation_id,
                    "domain": rec.domain,
                    "category": rec.category,
                    "title": rec.title,
                    "description": rec.description,
                    "priority": rec.priority.value if hasattr(rec.priority, 'value') else rec.priority,
                    "estimated_impact": rec.estimated_impact,
                    "implementation_effort": rec.implementation_effort,
                    "source": rec.source.value if hasattr(rec.source, 'value') else rec.source,
                    "criterion_id": rec.criterion_id,
                    "confidence_score": rec.confidence_score,
                    "is_custom_criterion": rec.is_custom_criterion,
                    "custom_criterion_details": rec.custom_criterion_details,
                    "status": rec.status.value if hasattr(rec.status, 'value') else rec.status,
                    "implementation_notes": rec.implementation_notes,
                    "user_rating": rec.user_rating,
                    "user_feedback": rec.user_feedback,
                    "created_at": rec.created_at.isoformat()
                }
                for rec in rec_set.recommendations
            ]
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to retrieve recommendation set: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve recommendation set"
        )


# ============================================================================
# Recommendation Update Endpoints
# ============================================================================

@app.patch("/api/recommendation/{recommendation_id}/status")
async def update_recommendation_status(
    recommendation_id: str = Path(..., description="Recommendation ID"),
    status_update: Dict[str, Any] = Body(...)
):
    """
    Update the implementation status of a recommendation
    
    Body should contain:
        - status: RecommendationStatus enum value
        - notes: Optional implementation notes
    """
    try:
        status_value = status_update.get("status")
        notes = status_update.get("notes")
        
        if not status_value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Status is required"
            )
        
        # Convert string to enum
        try:
            status_enum = RecommendationStatus(status_value)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {[s.value for s in RecommendationStatus]}"
            )
        
        rec = db_manager.update_recommendation_status(
            recommendation_id=recommendation_id,
            status=status_enum,
            notes=notes
        )
        
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation {recommendation_id} not found"
            )
        
        return {
            "recommendation_id": rec.recommendation_id,
            "status": rec.status.value if hasattr(rec.status, 'value') else rec.status,
            "implementation_notes": rec.implementation_notes,
            "implemented_at": rec.implemented_at.isoformat() if rec.implemented_at else None,
            "updated_at": rec.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update recommendation status"
        )


@app.post("/api/recommendation/{recommendation_id}/rating")
async def add_recommendation_rating(
    recommendation_id: str = Path(..., description="Recommendation ID"),
    rating_data: Dict[str, Any] = Body(...)
):
    """
    Add user rating and feedback to a recommendation
    
    Body should contain:
        - rating: Integer from 1-5 stars
        - feedback: Optional text feedback
    """
    try:
        rating = rating_data.get("rating")
        feedback = rating_data.get("feedback")
        
        if rating is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating is required"
            )
        
        if not (1 <= rating <= 5):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rating must be between 1 and 5"
            )
        
        rec = db_manager.add_recommendation_rating(
            recommendation_id=recommendation_id,
            rating=rating,
            feedback=feedback
        )
        
        if not rec:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Recommendation {recommendation_id} not found"
            )
        
        return {
            "recommendation_id": rec.recommendation_id,
            "user_rating": rec.user_rating,
            "user_feedback": rec.user_feedback,
            "feedback_at": rec.feedback_at.isoformat() if rec.feedback_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to add rating: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add rating"
        )


@app.post("/api/recommendation/{recommendation_id}/detailed-feedback")
async def submit_detailed_feedback(
    recommendation_id: str = Path(..., description="Recommendation ID"),
    feedback_data: Dict[str, Any] = Body(...)
):
    """
    Submit detailed feedback for ML training
    
    Body should contain:
        - user_id: User ID
        - relevance_score: 1-5
        - clarity_score: 1-5
        - actionability_score: 1-5
        - was_implemented: Boolean
        - actual_impact: Optional string
        - implementation_time: Optional string
        - feedback_text: Optional text
    """
    try:
        if "user_id" not in feedback_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="user_id is required"
            )
        
        feedback_data['recommendation_id'] = recommendation_id
        
        feedback = db_manager.save_detailed_feedback(feedback_data)
        
        return {
            "feedback_id": feedback.id,
            "recommendation_id": feedback.recommendation_id,
            "submitted_at": feedback.submitted_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to save detailed feedback: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save detailed feedback"
        )


# ============================================================================
# Statistics & Analytics Endpoints
# ============================================================================

@app.get("/api/recommendations/statistics")
async def get_statistics():
    """Get overall recommendation service statistics"""
    try:
        stats = db_manager.get_statistics()
        return stats
    except Exception as e:
        logger.error(f"Failed to get statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve statistics"
        )


# ============================================================================
# Manual Generation Endpoint (for testing without Kafka)
# ============================================================================

@app.post("/api/recommendations/generate")
async def generate_recommendations_manual(request: Dict[str, Any] = Body(...)):
    """
    Manual API endpoint for generating recommendations.
    Useful for testing without Kafka.
    Saves to database and returns results directly.
    """
    try:
        from shared.models.events import RecommendationRequestEvent
        import uuid
        
        # Parse request into RecommendationRequestEvent
        event = RecommendationRequestEvent(**request)
        
        start_time = datetime.utcnow()
        
        # Generate recommendations
        recommendations = await ai_engine.generate_recommendations(
            assessment_data=event.dict(),
            custom_criteria=event.custom_criteria
        )
        
        generation_time = (datetime.utcnow() - start_time).total_seconds() * 1000
        
        # Save to database
        recommendation_set_id = str(uuid.uuid4())
        
        # Prepare recommendation set data
        set_data = {
            'recommendation_set_id': recommendation_set_id,
            'assessment_id': event.assessment_id,
            'user_id': event.user_id,
            'source': 'api',
            'model_used': ai_engine.current_model if hasattr(ai_engine, 'current_model') else None,
            'generation_time_ms': generation_time,
            'overall_score': event.overall_score,
            'domain_scores': event.domain_scores,
            'detailed_metrics': event.detailed_metrics,
            'generated_at': datetime.utcnow()
        }
        
        # Prepare individual recommendations
        rec_list = []
        for rec in recommendations:
            rec_dict = rec.dict() if hasattr(rec, 'dict') else rec
            rec_dict['recommendation_id'] = str(uuid.uuid4())
            
            # Check if this is for a custom criterion
            criterion_id = rec_dict.get('criterion_id', '')
            if criterion_id and ('_CUSTOM' in criterion_id or 
                                (event.custom_criteria and 
                                 any(cc.criterion_id == criterion_id for cc in event.custom_criteria))):
                rec_dict['is_custom_criterion'] = True
                # Find and attach custom criterion details
                if event.custom_criteria:
                    for cc in event.custom_criteria:
                        if cc.criterion_id == criterion_id:
                            rec_dict['custom_criterion_details'] = cc.dict()
                            break
            
            rec_list.append(rec_dict)
        
        # Save to database
        try:
            db_manager.save_recommendation_set(set_data, rec_list)
            logger.info(f"💾 Saved recommendations to database: {recommendation_set_id}")
        except Exception as db_error:
            logger.error(f"Failed to save to database: {db_error}")
            # Continue - return results even if DB save fails
        
        return {
            "assessment_id": event.assessment_id,
            "recommendation_set_id": recommendation_set_id,
            "recommendations": [r.dict() for r in recommendations],
            "source": "api",
            "count": len(recommendations),
            "generation_time_ms": generation_time,
            "model_used": ai_engine.current_model if hasattr(ai_engine, 'current_model') else None
        }
    
    except Exception as e:
        logger.error(f"API generation failed: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate recommendations: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app, 
        host=config.api_host, 
        port=config.api_port,
        workers=config.api_workers
    )
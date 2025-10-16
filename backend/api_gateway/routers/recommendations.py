"""
API Gateway - Recommendation Router
Handles fetching recommendations from the recommendation service database
Prevents loss of recommendations on page refresh
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import logging

from fastapi import APIRouter, HTTPException, status, Path, Query, Depends
import httpx

from ..config import settings
from ..dependencies import get_current_user_optional, get_current_user_required, handle_exceptions
from ..auth.models import TokenData

router = APIRouter(prefix="/recommendations", tags=["recommendations"])
logger = logging.getLogger(__name__)

# Recommendation service URL from settings
RECOMMENDATION_SERVICE_URL = getattr(
    settings, 
    'recommendation_service_url', 
    'http://localhost:8007'
)


# ============================================================================
# GET RECOMMENDATIONS BY ASSESSMENT
# ============================================================================

@router.get("/assessment/{assessment_id}")
@handle_exceptions
async def get_recommendations_by_assessment(
    assessment_id: str = Path(..., description="Assessment ID"),
    latest_only: bool = Query(True, description="Return only the latest recommendation set"),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """
    Get recommendations for a specific assessment from database.
    
    This endpoint fetches recommendations from the recommendation service database,
    allowing frontend to recover recommendations after page refresh.
    
    Args:
        assessment_id: Assessment ID
        latest_only: If True, return only the most recent recommendation set
        
    Returns:
        Recommendation set(s) with all recommendations
        
    Access Control:
        - Public access for unauthenticated users (own assessments only via session)
        - Authenticated users can access their own assessments
        - Admins can access any assessment
    """
    try:
        logger.info(f"Fetching recommendations for assessment {assessment_id}")
        
        # Make request to recommendation service
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendations/assessment/{assessment_id}",
                params={"latest_only": latest_only}
            )
            
            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No recommendations found for assessment {assessment_id}"
                )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch recommendations from recommendation service"
                )
            
            recommendations_data = response.json()
            
            # Authorization check: verify user owns this assessment if authenticated
            if current_user:
                # Fetch assessment to verify ownership
                try:
                    from ..database import DatabaseManager
                    from ..dependencies import get_db_manager
                    
                    db_manager = get_db_manager()
                    assessment = await db_manager.get_assessment(assessment_id)
                    
                    # Check if user owns this assessment (unless admin)
                    if (assessment.user_id and 
                        assessment.user_id != current_user.user_id and 
                        current_user.role not in ["admin", "super_admin"]):
                        raise HTTPException(
                            status_code=status.HTTP_403_FORBIDDEN,
                            detail="Access denied"
                        )
                except HTTPException:
                    raise
                except Exception as e:
                    logger.warning(f"Could not verify assessment ownership: {e}")
                    # Continue anyway - let recommendation service handle it
            
            logger.info(
                f"Successfully fetched recommendations for assessment {assessment_id}"
            )
            
            return recommendations_data
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching recommendations for {assessment_id}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error fetching recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recommendations"
        )


# ============================================================================
# GET RECOMMENDATIONS BY USER
# ============================================================================

@router.get("/my/recommendations")
@handle_exceptions
async def get_my_recommendations(
    limit: int = Query(10, ge=1, le=100, description="Maximum recommendation sets to return"),
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Get recent recommendation sets for the current user.
    
    Returns a list of recommendation sets (summaries) for all assessments
    belonging to the authenticated user.
    
    Args:
        limit: Maximum number of recommendation sets to return
        
    Returns:
        List of recommendation set summaries
    """
    try:
        logger.info(f"Fetching recommendations for user {current_user.user_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendations/user/{current_user.user_id}",
                params={"limit": limit}
            )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch user recommendations"
                )
            
            return response.json()
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching user recommendations for {current_user.user_id}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error fetching user recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user recommendations"
        )


# ============================================================================
# GET SPECIFIC RECOMMENDATION SET
# ============================================================================

@router.get("/{recommendation_set_id}")
@handle_exceptions
async def get_recommendation_set(
    recommendation_set_id: str = Path(..., description="Recommendation Set ID"),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """
    Get a specific recommendation set by ID with full details.
    
    Returns complete details including all individual recommendations,
    metadata, and statistics.
    
    Args:
        recommendation_set_id: Unique recommendation set identifier
        
    Returns:
        Complete recommendation set with all details
    """
    try:
        logger.info(f"Fetching recommendation set {recommendation_set_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendations/{recommendation_set_id}"
            )
            
            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recommendation set {recommendation_set_id} not found"
                )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch recommendation set"
                )
            
            recommendation_set = response.json()
            
            # Authorization check if authenticated
            if current_user:
                # Check if user owns this recommendation set (unless admin)
                rec_user_id = recommendation_set.get('user_id')
                if (rec_user_id and 
                    rec_user_id != current_user.user_id and 
                    current_user.role not in ["admin", "super_admin"]):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Access denied"
                    )
            
            return recommendation_set
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching recommendation set {recommendation_set_id}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error fetching recommendation set: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recommendation set"
        )


# ============================================================================
# UPDATE RECOMMENDATION STATUS
# ============================================================================

@router.patch("/{recommendation_id}/status")
@handle_exceptions
async def update_recommendation_status(
    recommendation_id: str = Path(..., description="Recommendation ID"),
    status_update: Dict[str, Any] = ...,
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Update the implementation status of a recommendation.
    
    Allows users to track progress on implementing recommendations.
    
    Args:
        recommendation_id: Unique recommendation identifier
        status_update: Dict containing 'status' and optional 'notes'
        
    Body example:
        {
            "status": "in_progress",  # pending, in_progress, completed, rejected
            "notes": "Started implementing this recommendation"
        }
    """
    try:
        logger.info(f"Updating status for recommendation {recommendation_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.patch(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendation/{recommendation_id}/status",
                json=status_update
            )
            
            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recommendation {recommendation_id} not found"
                )
            
            if response.status_code == 400:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=response.json().get('detail', 'Invalid status update')
                )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to update recommendation status"
                )
            
            return response.json()
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error(f"Timeout updating recommendation {recommendation_id}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error updating recommendation status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update recommendation status"
        )


# ============================================================================
# ADD RECOMMENDATION RATING
# ============================================================================

@router.post("/{recommendation_id}/rating")
@handle_exceptions
async def add_recommendation_rating(
    recommendation_id: str = Path(..., description="Recommendation ID"),
    rating_data: Dict[str, Any] = ...,
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Add user rating and feedback to a recommendation.
    
    Helps improve future recommendation quality through user feedback.
    
    Args:
        recommendation_id: Unique recommendation identifier
        rating_data: Dict containing 'rating' (1-5) and optional 'feedback'
        
    Body example:
        {
            "rating": 4,
            "feedback": "Very helpful recommendation"
        }
    """
    try:
        logger.info(f"Adding rating for recommendation {recommendation_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendation/{recommendation_id}/rating",
                json=rating_data
            )
            
            if response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Recommendation {recommendation_id} not found"
                )
            
            if response.status_code == 400:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=response.json().get('detail', 'Invalid rating data')
                )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to add recommendation rating"
                )
            
            return response.json()
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error(f"Timeout adding rating for recommendation {recommendation_id}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error adding recommendation rating: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add recommendation rating"
        )


# ============================================================================
# GET RECOMMENDATION STATISTICS
# ============================================================================

@router.get("/statistics/overview")
@handle_exceptions
async def get_recommendation_statistics(
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Get overall recommendation service statistics.
    
    Returns aggregated statistics about recommendations, implementation status,
    and user feedback. Useful for dashboards and analytics.
    
    Requires authentication (admin users get full stats, regular users get filtered stats).
    """
    try:
        logger.info(f"Fetching recommendation statistics for user {current_user.user_id}")
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendations/statistics"
            )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to fetch recommendation statistics"
                )
            
            stats = response.json()
            
            # Filter stats for non-admin users (optional - adjust based on requirements)
            if current_user.role not in ["admin", "super_admin"]:
                # Return filtered stats for regular users
                pass
            
            return stats
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("Timeout fetching recommendation statistics")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation service timeout"
        )
    except Exception as e:
        logger.error(f"Error fetching recommendation statistics: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch recommendation statistics"
        )


# ============================================================================
# MANUAL RECOMMENDATION GENERATION (TESTING)
# ============================================================================

@router.post("/generate")
@handle_exceptions
async def generate_recommendations_manual(
    request: Dict[str, Any] = ...,
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Manually trigger recommendation generation for an assessment.
    
    Useful for testing or regenerating recommendations.
    This bypasses Kafka and calls the recommendation service directly.
    
    Args:
        request: Assessment data including scores and detailed metrics
        
    Body example:
        {
            "assessment_id": "...",
            "user_id": "...",
            "overall_score": 75.5,
            "domain_scores": {
                "resilience": 80.0,
                "sustainability": 70.0,
                "human_centricity": 76.5
            },
            "detailed_metrics": {...}
        }
    """
    try:
        logger.info(f"Manual recommendation generation for assessment {request.get('assessment_id')}")
        
        # Ensure user_id matches current user (unless admin)
        if current_user.role not in ["admin", "super_admin"]:
            request['user_id'] = current_user.user_id
        
        async with httpx.AsyncClient(timeout=60.0) as client:  # Longer timeout for generation
            response = await client.post(
                f"{RECOMMENDATION_SERVICE_URL}/api/recommendations/generate",
                json=request
            )
            
            if response.status_code == 400:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=response.json().get('detail', 'Invalid request data')
                )
            
            if response.status_code != 200:
                logger.error(
                    f"Recommendation service error: {response.status_code} - {response.text}"
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Failed to generate recommendations"
                )
            
            return response.json()
            
    except HTTPException:
        raise
    except httpx.TimeoutException:
        logger.error("Timeout generating recommendations")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Recommendation generation timeout"
        )
    except Exception as e:
        logger.error(f"Error generating recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate recommendations"
        )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@router.get("/health")
async def recommendation_service_health():
    """
    Check if recommendation service is available.
    
    Returns health status of the recommendation service.
    Useful for monitoring and debugging.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{RECOMMENDATION_SERVICE_URL}/health")
            
            if response.status_code == 200:
                return {
                    "status": "healthy",
                    "service": "recommendation-service",
                    "details": response.json()
                }
            else:
                return {
                    "status": "unhealthy",
                    "service": "recommendation-service",
                    "status_code": response.status_code
                }
    except Exception as e:
        logger.error(f"Recommendation service health check failed: {e}")
        return {
            "status": "unavailable",
            "service": "recommendation-service",
            "error": str(e)
        }
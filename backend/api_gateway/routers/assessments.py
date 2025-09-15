from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
import logging

# Import shared models
from shared.models.assessment import (
    AssessmentStatus, 
    AssessmentProgress, 
    FormSubmissionRequest
)
from shared.models.events import EventFactory

from ..database import DatabaseManager
from ..kafka_service import KafkaService
from ..config import settings
from ..models import AssessmentCreate, AssessmentResponse, FormSubmission
from ..dependencies import get_db_manager, get_kafka_service, get_current_user, handle_exceptions
# from ..exceptions import AssessmentNotFoundException

router = APIRouter(prefix="/assessments", tags=["assessments"])

# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@router.post("/", response_model=AssessmentResponse)
@handle_exceptions
async def create_assessment(
    assessment_data: AssessmentCreate,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Create a new assessment with event publishing"""
    # Use authenticated user if available, otherwise use provided user_id
    user_id = current_user or assessment_data.user_id
    
    # Create assessment using shared model logic
    progress = AssessmentProgress(
        assessment_id=db_manager.generate_assessment_id(),
        user_id=user_id,
        system_name=assessment_data.system_name,
        status=AssessmentStatus.STARTED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Convert to database model and save
    assessment = db_manager.create_assessment_from_progress(progress, assessment_data.metadata)
    
    # Publish status update event
    try:
        await kafka_service.publish_assessment_status_update(progress)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to publish assessment creation event: {e}")
    
    return AssessmentResponse.from_orm(assessment)


@router.get("/{assessment_id}", response_model=AssessmentResponse)
@handle_exceptions
async def get_assessment(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get assessment by ID"""
    assessment = db_manager.get_assessment(assessment_id)
    
    # Basic authorization check (when auth is implemented)
    # if current_user and assessment.user_id and assessment.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    return AssessmentResponse.from_orm(assessment)


@router.post("/{assessment_id}/submit", response_model=AssessmentResponse)
@handle_exceptions
async def submit_form(
    assessment_id: str,
    form_submission: FormSubmission,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Submit a domain form for an assessment with event-driven processing"""
    
    # Get assessment and convert to shared model for business logic
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    previous_status = progress.status.value
    
    # Authorization check (when auth is implemented)
    # if current_user and progress.user_id and progress.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    # Use shared model business logic to validate submission
    if not _can_submit_domain(progress, form_submission.domain):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain {form_submission.domain} already submitted for this assessment"
        )
    
    # Create shared FormSubmissionRequest for consistent message format
    submission_request = FormSubmissionRequest(
        assessment_id=assessment_id,
        user_id=progress.user_id,
        system_name=progress.system_name,
        domain=form_submission.domain,
        form_data=form_submission.form_data,
        metadata=form_submission.metadata
    )
    
    try:
        # Publish form submission event using shared model
        await kafka_service.publish_form_submission(submission_request)
        
        # Update progress using shared model logic
        updated_progress = _mark_domain_complete(progress, form_submission.domain)
        
        # Update database
        updated_assessment = db_manager.update_assessment_from_progress(updated_progress)
        
        # Publish status update event if status changed
        if previous_status != updated_progress.status.value:
            await kafka_service.publish_assessment_status_update(updated_progress, previous_status)
        
        return AssessmentResponse.from_orm(updated_assessment)
        
    except Exception as e:
        # Publish error event
        try:
            # Don't await this to avoid blocking the response
            import asyncio
            asyncio.create_task(kafka_service._publish_error_event(
                assessment_id=assessment_id,
                error_type="form_submission_error",
                error_message=f"Failed to submit {form_submission.domain} form",
                error_details={"error": str(e), "domain": form_submission.domain},
                user_id=progress.user_id,
                domain=form_submission.domain
            ))
                    
        except Exception as publish_error:
            import logging
            logging.getLogger(__name__).error(f"Failed to publish error event: {publish_error}")
        
        # Re-raise the original exception
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to submit form: {str(e)}"
        )


@router.get("/user/{user_id}", response_model=List[AssessmentResponse])
@handle_exceptions
async def get_user_assessments(
    user_id: str,
    limit: int = 10,
    status_filter: Optional[AssessmentStatus] = None,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get assessments for a user with optional status filtering"""
    
    # Authorization check (when auth is implemented)
    # if current_user and current_user != user_id:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    # Use shared enum for status filtering
    assessments = db_manager.get_user_assessments(
        user_id, 
        min(limit, 50),  # Cap limit
        status_filter=status_filter.value if status_filter else None
    )
    
    return [AssessmentResponse.from_orm(assessment) for assessment in assessments]


@router.get("/{assessment_id}/progress", response_model=AssessmentProgress)
@handle_exceptions
async def get_assessment_progress(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get detailed assessment progress using shared model"""
    
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    
    # Authorization check (when auth is implemented)
    # if current_user and progress.user_id and progress.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    return progress


@router.patch("/{assessment_id}/status")
@handle_exceptions
async def update_assessment_status(
    assessment_id: str,
    new_status: AssessmentStatus,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Update assessment status (admin endpoint) with event publishing"""
    
    # This would typically require admin permissions
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    previous_status = progress.status.value
    
    # Authorization check (when auth is implemented)
    # if current_user and progress.user_id and progress.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    # Validate status transition using shared logic
    if not _is_valid_status_transition(progress.status, new_status):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition from {progress.status} to {new_status}"
        )
    
    # Update status
    progress.status = new_status
    progress.updated_at = datetime.utcnow()
    
    if new_status == AssessmentStatus.COMPLETED:
        progress.completed_at = datetime.utcnow()
    
    try:
        updated_assessment = db_manager.update_assessment_from_progress(progress)
        
        # Publish status update event
        await kafka_service.publish_assessment_status_update(progress, previous_status)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": f"Assessment status updated to {new_status}"}
        )
        
    except Exception as e:
        # Publish error event
        try:
        # Don't await this to avoid blocking the response
            import asyncio
            asyncio.create_task(kafka_service._publish_error_event(
                assessment_id=assessment_id,
                error_type="status_update_error",
                error_message=f"Failed to update status from {previous_status} to {new_status}",
                error_details={"error": str(e), "previous_status": previous_status, "new_status": new_status.value},
                user_id=progress.user_id
            ))
            
        except Exception as publish_error:
            import logging
            logging.getLogger(__name__).error(f"Failed to publish error event: {publish_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update status: {str(e)}"
        )


@router.delete("/{assessment_id}")
@handle_exceptions
async def delete_assessment(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Delete an assessment (soft delete) with event publishing"""
    
    assessment = db_manager.get_assessment(assessment_id)
    
    # Authorization check (when auth is implemented)
    # if current_user and assessment.user_id and assessment.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    try:
        # Get progress for event publishing
        progress = assessment.to_progress_model()
        previous_status = progress.status.value
        
        # In production, implement soft delete
        # For now, just publish status change event
        progress.status = AssessmentStatus.FAILED  # Or create DELETED status
        progress.updated_at = datetime.utcnow()
        
        # Publish status update event
        await kafka_service.publish_assessment_status_update(progress, previous_status)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "Assessment deletion requested"}
        )
        
    except Exception as e:
        # Publish error event
        try:
            # Don't await this to avoid blocking the response
            import asyncio
            asyncio.create_task(kafka_service._publish_error_event(
                assessment_id=assessment_id,
                error_type="deletion_error",
                error_message="Failed to delete assessment",
                error_details={"error": str(e)},
                user_id=assessment.user_id
            ))
            
        except Exception as publish_error:
            import logging
            logging.getLogger(__name__).error(f"Failed to publish error event: {publish_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete assessment: {str(e)}"
        )


@router.post("/{assessment_id}/retry")
@handle_exceptions
async def retry_assessment(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Retry a failed assessment with event publishing"""
    
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    
    # Authorization check (when auth is implemented)
    # if current_user and progress.user_id and progress.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    # Only allow retry for failed assessments
    if progress.status != AssessmentStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry assessment with status: {progress.status}"
        )
    
    try:
        previous_status = progress.status.value
        
        # Reset to appropriate status based on completion
        progress.status = _calculate_status(progress)
        progress.updated_at = datetime.utcnow()
        
        # Update database
        updated_assessment = db_manager.update_assessment_from_progress(progress)
        
        # Publish status update event
        await kafka_service.publish_assessment_status_update(progress, previous_status)
        
        return AssessmentResponse.from_orm(updated_assessment)
        
    except Exception as e:
        # Publish error event
        try:
            # Don't await this to avoid blocking the response
            import asyncio
            asyncio.create_task(kafka_service._publish_error_event(
                assessment_id=assessment_id,
                error_type="retry_error",
                error_message="Failed to retry assessment",
                error_details={"error": str(e)},
                user_id=progress.user_id
            ))
            
        except Exception as publish_error:
            import logging
            logging.getLogger(__name__).error(f"Failed to publish error event: {publish_error}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry assessment: {str(e)}"
        )


# Business logic functions using shared models
def _can_submit_domain(progress: AssessmentProgress, domain: str) -> bool:
    """Check if a domain can be submitted based on current progress"""
    domain_map = {
        "resilience": not progress.resilience_submitted,
        "sustainability": not progress.sustainability_submitted,
        "human_centricity": not progress.human_centricity_submitted
    }
    return domain_map.get(domain, False)


def _mark_domain_complete(progress: AssessmentProgress, domain: str) -> AssessmentProgress:
    """Mark a domain as complete and update progress status"""
    if domain == "resilience":
        progress.resilience_submitted = True
    elif domain == "human_centricity":
        progress.human_centricity_submitted = True
    elif domain == "sustainability":
        progress.sustainability_submitted = True
    
    # Update status based on completion
    progress.status = _calculate_status(progress)
    progress.updated_at = datetime.utcnow()
    
    return progress


def _calculate_status(progress: AssessmentProgress) -> AssessmentStatus:
    if (
        progress.resilience_submitted
        and progress.human_centricity_submitted
        and progress.sustainability_submitted
    ):
        return AssessmentStatus.ALL_COMPLETE
    elif progress.sustainability_submitted:
        return AssessmentStatus.SUSTAINABILITY_COMPLETE
    elif progress.human_centricity_submitted:
        return AssessmentStatus.HUMAN_CENTRICITY_COMPLETE
    elif progress.resilience_submitted:
        return AssessmentStatus.RESILIENCE_COMPLETE
    else:
        return AssessmentStatus.STARTED


def _is_valid_status_transition(current: AssessmentStatus, new: AssessmentStatus) -> bool:
    """Validate if status transition is allowed"""
    # Define valid transitions
    valid_transitions = {
        AssessmentStatus.STARTED: [
            AssessmentStatus.RESILIENCE_COMPLETE,
            AssessmentStatus.SUSTAINABILITY_COMPLETE,
            AssessmentStatus.HUMAN_CENTRICITY_COMPLETE,
            AssessmentStatus.PROCESSING,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.RESILIENCE_COMPLETE: [
            AssessmentStatus.HUMAN_CENTRICITY_COMPLETE,
            AssessmentStatus.ALL_COMPLETE,
            AssessmentStatus.PROCESSING,
            AssessmentStatus.SUSTAINABILITY_COMPLETE,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.HUMAN_CENTRICITY_COMPLETE: [
            AssessmentStatus.RESILIENCE_COMPLETE,
            AssessmentStatus.SUSTAINABILITY_COMPLETE,
            AssessmentStatus.ALL_COMPLETE,
            AssessmentStatus.PROCESSING,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.SUSTAINABILITY_COMPLETE: [
            AssessmentStatus.RESILIENCE_COMPLETE,
            AssessmentStatus.HUMAN_CENTRICITY_COMPLETE,
            AssessmentStatus.ALL_COMPLETE,
            AssessmentStatus.PROCESSING,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.ALL_COMPLETE: [
            AssessmentStatus.PROCESSING,
            AssessmentStatus.COMPLETED,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.PROCESSING: [
            AssessmentStatus.COMPLETED,
            AssessmentStatus.FAILED
        ],
        AssessmentStatus.COMPLETED: [],  # Terminal state
        AssessmentStatus.FAILED: [
            AssessmentStatus.STARTED,  # Allow restart
            AssessmentStatus.PROCESSING  # Allow retry
        ]
    }
    
    return new in valid_transitions.get(current, [])

@router.get("/{assessment_id}/domain-scores")
@handle_exceptions
async def get_assessment_domain_scores(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[str] = Depends(get_current_user)
):
    """Get detailed scores for all completed domains in an assessment"""
    
    # Get the main assessment
    assessment = db_manager.get_assessment(assessment_id)
    progress = assessment.to_progress_model()
    
    # Authorization check (when auth is implemented)
    # if current_user and progress.user_id and progress.user_id != current_user:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Access denied"
    #     )
    
    domain_scores = {
        "assessment_id": assessment_id,
        "overall_assessment": {
            "status": progress.status.value,
            "completion_percentage": _calculate_completion_percentage(progress),
            "completed_domains": _get_completed_domains(progress),
            "pending_domains": _get_pending_domains(progress),
            "overall_score": progress.overall_score,
            "created_at": progress.created_at.isoformat(),
            "updated_at": progress.updated_at.isoformat(),
            "completed_at": progress.completed_at.isoformat() if progress.completed_at else None
        },
        "domain_results": {}
    }
    
    # Helper function to safely fetch microservice results
    async def fetch_domain_result(domain_name: str, service_url: str):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{service_url}/assessment/{assessment_id}", timeout=5.0)
                if response.status_code == 200:
                    return response.json()
                elif response.status_code == 404:
                    return None  # Assessment not found in this service
                else:
                    logger.warning(f"Failed to fetch {domain_name} results: {response.status_code}")
                    return None
        except Exception as e:
            logger.error(f"Error fetching {domain_name} results: {e}")
            return None
    
    # Fetch results for completed domains
    if progress.resilience_submitted:
        resilience_result = await fetch_domain_result("resilience", settings.resilience_service_url)
        if resilience_result:
            domain_scores["domain_results"]["resilience"] = {
                "domain_name": "Resilience Assessment",
                "status": "completed",
                "submitted_at": resilience_result.get("submitted_at"),
                "processed_at": resilience_result.get("processed_at"),
                "overall_score": resilience_result.get("overall_score"),
                "detailed_scores": {
                    "domain_scores": resilience_result.get("domain_scores", {}),
                    "risk_metrics": resilience_result.get("risk_metrics", {})
                },
                "score_breakdown": _format_resilience_breakdown(resilience_result.get("domain_scores", {})),
                "insights": _generate_resilience_insights(resilience_result.get("overall_score"), resilience_result.get("domain_scores", {}))
            }
    
    if progress.sustainability_submitted:
        sustainability_result = await fetch_domain_result("sustainability", settings.sustainability_service_url)
        if sustainability_result:
            domain_scores["domain_results"]["sustainability"] = {
                "domain_name": "Sustainability Assessment",
                "status": "completed",
                "submitted_at": sustainability_result.get("submitted_at"),
                "processed_at": sustainability_result.get("processed_at"),
                "overall_score": sustainability_result.get("overall_score"),
                "detailed_scores": {
                    "dimension_scores": sustainability_result.get("dimension_scores", {}),
                    "sustainability_metrics": sustainability_result.get("sustainability_metrics", {})
                },
                "score_breakdown": _format_sustainability_breakdown(sustainability_result.get("dimension_scores", {})),
                "insights": _generate_sustainability_insights(sustainability_result.get("overall_score"), sustainability_result.get("dimension_scores", {}))
            }
    
    if progress.human_centricity_submitted:
        hc_result = await fetch_domain_result("human_centricity", settings.human_centricity_service_url)
        if hc_result:
            domain_scores["domain_results"]["human_centricity"] = {
                "domain_name": "Human Centricity Assessment", 
                "status": "completed",
                "submitted_at": hc_result.get("submitted_at"),
                "processed_at": hc_result.get("processed_at"),
                "overall_score": hc_result.get("overall_score"),
                "detailed_scores": {
                    "domain_scores": hc_result.get("domain_scores", {}),
                    "detailed_metrics": hc_result.get("detailed_metrics", {})
                },
                "score_breakdown": _format_human_centricity_breakdown(hc_result.get("domain_scores", {})),
                "insights": _generate_human_centricity_insights(hc_result.get("overall_score"), hc_result.get("domain_scores", {}))
            }
    
    # Add summary statistics
    completed_scores = [result.get("overall_score") for result in domain_scores["domain_results"].values() 
                       if result.get("overall_score") is not None]
    
    if completed_scores:
        domain_scores["summary_statistics"] = {
            "completed_domain_count": len(completed_scores),
            "average_score": sum(completed_scores) / len(completed_scores),
            "highest_score": max(completed_scores),
            "lowest_score": min(completed_scores),
            "score_distribution": _categorize_scores(completed_scores)
        }
    
    return domain_scores


def _calculate_completion_percentage(progress: AssessmentProgress) -> float:
    """Calculate percentage of domains completed"""
    total_domains = 3
    completed = sum([
        progress.resilience_submitted,
        progress.sustainability_submitted, 
        progress.human_centricity_submitted
    ])
    return (completed / total_domains) * 100


def _get_completed_domains(progress: AssessmentProgress) -> List[str]:
    """Get list of completed domain names"""
    completed = []
    if progress.resilience_submitted:
        completed.append("resilience")
    if progress.sustainability_submitted:
        completed.append("sustainability")
    if progress.human_centricity_submitted:
        completed.append("human_centricity")
    return completed


def _get_pending_domains(progress: AssessmentProgress) -> List[str]:
    """Get list of pending domain names"""
    pending = []
    if not progress.resilience_submitted:
        pending.append("resilience")
    if not progress.sustainability_submitted:
        pending.append("sustainability")
    if not progress.human_centricity_submitted:
        pending.append("human_centricity")
    return pending


def _format_resilience_breakdown(domain_scores: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Format resilience domain scores for frontend display"""
    breakdown = []
    for domain, score in domain_scores.items():
        breakdown.append({
            "category": domain.replace("_", " ").title(),
            "score": score,
            "status": _get_score_status(score)
        })
    return breakdown


def _format_sustainability_breakdown(dimension_scores: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Format sustainability dimension scores for frontend display"""
    breakdown = []
    for dimension, score in dimension_scores.items():
        breakdown.append({
            "category": dimension.replace("_", " ").title(),
            "score": score,
            "status": _get_score_status(score)
        })
    return breakdown


def _format_human_centricity_breakdown(domain_scores: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Format human centricity domain scores for frontend display"""
    breakdown = []
    for domain, score in domain_scores.items():
        breakdown.append({
            "category": domain.replace("_", " ").title(),
            "score": score,
            "status": _get_score_status(score)
        })
    return breakdown


def _get_score_status(score: float) -> str:
    """Get status category based on score"""
    if score >= 90:
        return "excellent"
    elif score >= 70:
        return "good"
    elif score >= 50:
        return "fair"
    elif score >= 30:
        return "poor"
    else:
        return "critical"


def _generate_resilience_insights(overall_score: float, domain_scores: Dict[str, Any]) -> List[str]:
    """Generate insights for resilience assessment"""
    insights = []
    if overall_score:
        if overall_score >= 80:
            insights.append("System demonstrates strong resilience across multiple domains")
        elif overall_score >= 60:
            insights.append("System shows moderate resilience with room for improvement")
        else:
            insights.append("System resilience requires significant attention")
    
    # Find strongest and weakest domains
    if domain_scores:
        strongest = max(domain_scores.items(), key=lambda x: x[1])
        weakest = min(domain_scores.items(), key=lambda x: x[1])
        insights.append(f"Strongest area: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})")
        insights.append(f"Area for improvement: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})")
    
    return insights


def _generate_sustainability_insights(overall_score: float, dimension_scores: Dict[str, Any]) -> List[str]:
    """Generate insights for sustainability assessment"""
    insights = []
    if overall_score:
        if overall_score >= 80:
            insights.append("System demonstrates strong sustainability performance")
        elif overall_score >= 60:
            insights.append("System shows good sustainability with opportunities for enhancement")
        else:
            insights.append("Sustainability performance needs significant improvement")
    
    if dimension_scores:
        strongest = max(dimension_scores.items(), key=lambda x: x[1])
        weakest = min(dimension_scores.items(), key=lambda x: x[1])
        insights.append(f"Best performing dimension: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})")
        insights.append(f"Focus area: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})")
    
    return insights


def _generate_human_centricity_insights(overall_score: float, domain_scores: Dict[str, Any]) -> List[str]:
    """Generate insights for human centricity assessment"""
    insights = []
    if overall_score:
        if overall_score >= 80:
            insights.append("System provides excellent user experience and human-centered design")
        elif overall_score >= 60:
            insights.append("System offers good user experience with areas for enhancement")
        else:
            insights.append("User experience requires significant improvement")
    
    if domain_scores:
        strongest = max(domain_scores.items(), key=lambda x: x[1])
        weakest = min(domain_scores.items(), key=lambda x: x[1])
        insights.append(f"Strongest aspect: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})")
        insights.append(f"Improvement opportunity: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})")
    
    return insights


def _categorize_scores(scores: List[float]) -> Dict[str, int]:
    """Categorize scores into performance bands"""
    categories = {"excellent": 0, "good": 0, "fair": 0, "poor": 0, "critical": 0}
    for score in scores:
        categories[_get_score_status(score)] += 1
    return categories
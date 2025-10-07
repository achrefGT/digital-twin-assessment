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
from ..dependencies import (
    get_db_manager, 
    get_kafka_service, 
    get_current_user_optional,
    get_current_user_required,
    handle_exceptions,
    require_roles
)
from ..auth.models import TokenData

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
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Create a new assessment
    
    NOTE: Assessment creation events are published DIRECTLY (not via outbox).
    This is acceptable because:
    - Creation is a lightweight operation
    - If event fails, assessment still exists in DB
    - Consumers can query DB if they miss the event
    """
    # Use authenticated user
    user_id = current_user.user_id
    
    # Create assessment using shared model logic
    progress = AssessmentProgress(
        assessment_id=db_manager.generate_assessment_id(),
        user_id=user_id,
        system_name=assessment_data.system_name,
        status=AssessmentStatus.STARTED,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    
    # Save to database
    assessment = db_manager.create_assessment_from_progress(progress, assessment_data.metadata)
    
    # Publish status update event (best-effort, non-critical)
    try:
        await kafka_service.publish_assessment_status_update(progress)
        logger.info(f"Published creation event for assessment {assessment.assessment_id}")
    except Exception as e:
        logger.warning(f"Failed to publish assessment creation event: {e}")
        # Don't fail the request - assessment is already saved
    
    return AssessmentResponse.from_orm(assessment)


@router.get("/{assessment_id}", response_model=AssessmentResponse)
@handle_exceptions
async def get_assessment(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get assessment by ID"""
    assessment = db_manager.get_assessment(assessment_id)
    
    # Authorization check
    if current_user:
        if (assessment.user_id and 
            assessment.user_id != current_user.user_id and 
            current_user.role not in ["admin", "super_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return AssessmentResponse.from_orm(assessment)


@router.post("/{assessment_id}/submit", response_model=AssessmentResponse)
@handle_exceptions
async def submit_form(
    assessment_id: str,
    form_submission: FormSubmission,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """
    Submit a domain form for scoring
    
    FLOW:
    1. Validate submission
    2. Publish form to scoring service (DIRECT - idempotent)
    3. Update assessment status in DB
    4. Publish status update (DIRECT - non-critical)
    
    NOTE: Form submissions are DIRECT (not outbox) because:
    - Scoring services are idempotent
    - User can resubmit if it fails
    - Not a state change, just triggering processing
    """
    
    # Get assessment
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    previous_status = progress.status.value
    
    # Authorization check
    if current_user:
        if (progress.user_id and 
            progress.user_id != current_user.user_id and 
            current_user.role not in ["admin", "super_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Validate submission
    if not _can_submit_domain(progress, form_submission.domain):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Domain {form_submission.domain} already submitted"
        )
    
    # Create submission request
    submission_request = FormSubmissionRequest(
        assessment_id=assessment_id,
        user_id=progress.user_id,
        system_name=progress.system_name,
        domain=form_submission.domain,
        form_data=form_submission.form_data,
        metadata=form_submission.metadata
    )
    
    try:
        # Step 1: Publish to scoring service (DIRECT)
        await kafka_service.publish_form_submission(submission_request)
        logger.info(f"Published {form_submission.domain} form for assessment {assessment_id}")
        
        # Step 2: Mark domain as submitted
        updated_progress = _mark_domain_complete(progress, form_submission.domain)
        
        # Step 3: Update database
        updated_assessment = db_manager.update_assessment_from_progress(updated_progress)
        
        # Step 4: Publish status update (DIRECT, best-effort)
        if previous_status != updated_progress.status.value:
            try:
                await kafka_service.publish_assessment_status_update(
                    updated_progress, 
                    previous_status
                )
            except Exception as e:
                logger.warning(f"Failed to publish status update: {e}")
        
        return AssessmentResponse.from_orm(updated_assessment)
        
    except Exception as e:
        logger.error(f"Form submission failed: {e}")
        
        # Try to publish error event (best-effort)
        try:
            import asyncio
            asyncio.create_task(kafka_service._try_publish_error_event(
                assessment_id=assessment_id,
                error_type="form_submission_error",
                error_message=f"Failed to submit {form_submission.domain} form",
                error_details={"error": str(e), "domain": form_submission.domain},
                user_id=progress.user_id,
                domain=form_submission.domain
            ))
        except:
            pass
        
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
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get assessments for a user"""
    
    # Authorization check
    if current_user:
        if (user_id != current_user.user_id and 
            current_user.role not in ["admin", "super_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    assessments = db_manager.get_user_assessments(
        user_id, 
        min(limit, 50),
        status_filter=status_filter.value if status_filter else None
    )
    
    return [AssessmentResponse.from_orm(assessment) for assessment in assessments]


@router.get("/my/assessments", response_model=List[AssessmentResponse])
@handle_exceptions
async def get_my_assessments(
    limit: int = 10,
    status_filter: Optional[AssessmentStatus] = None,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: TokenData = Depends(get_current_user_required)
):
    """Get current user's assessments"""
    
    assessments = db_manager.get_user_assessments(
        current_user.user_id, 
        min(limit, 50),
        status_filter=status_filter.value if status_filter else None
    )
    
    return [AssessmentResponse.from_orm(assessment) for assessment in assessments]


@router.get("/{assessment_id}/progress", response_model=AssessmentProgress)
@handle_exceptions
async def get_assessment_progress(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: Optional[TokenData] = Depends(get_current_user_optional)
):
    """Get detailed assessment progress"""
    
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    
    # Authorization check
    if current_user:
        if (progress.user_id and 
            progress.user_id != current_user.user_id and 
            current_user.role not in ["admin", "super_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    return progress


@router.patch("/{assessment_id}/status")
@handle_exceptions
@require_roles("admin", "super_admin")
async def update_assessment_status(
    assessment_id: str,
    new_status: AssessmentStatus,
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service),
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Update assessment status (admin only)
    
    NOTE: Status updates are published DIRECTLY (not via outbox).
    This is a manual admin action, not a critical business event.
    """
    
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    previous_status = progress.status.value
    
    # Validate transition
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
        
        # Publish status update (best-effort)
        try:
            await kafka_service.publish_assessment_status_update(progress, previous_status)
        except Exception as e:
            logger.warning(f"Failed to publish status update: {e}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": f"Assessment status updated to {new_status}"}
        )
        
    except Exception as e:
        logger.error(f"Status update failed: {e}")
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
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Delete an assessment (hard delete)
    
    NOTE: Deletion events are NOT published via outbox because:
    - Once deleted, the assessment is gone - no state to protect
    - Consumers can handle missing assessments gracefully
    """
    
    assessment = db_manager.get_assessment(assessment_id)
    
    # Authorization check
    if current_user:
        if (assessment.user_id and 
            assessment.user_id != current_user.user_id and 
            current_user.role not in ["admin", "super_admin"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    try:
        # Perform hard delete
        success = db_manager.delete_assessment(assessment_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Assessment not found"
            )
        
        logger.info(f"Deleted assessment {assessment_id}")
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content={"message": "Assessment deleted successfully"}
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Deletion failed: {e}")
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
    current_user: TokenData = Depends(get_current_user_required)
):
    """
    Retry a failed assessment
    
    NOTE: Retry events are published DIRECTLY (not via outbox).
    This is a manual user action to recover from failure.
    """
    
    db_assessment = db_manager.get_assessment(assessment_id)
    progress = db_assessment.to_progress_model()
    
    # Authorization check
    if current_user:
        if (progress.user_id and 
            progress.user_id != current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Only allow retry for failed assessments
    if progress.status != AssessmentStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot retry assessment with status: {progress.status}"
        )
    
    try:
        previous_status = progress.status.value
        
        # Reset status
        progress.status = _calculate_status(progress)
        progress.updated_at = datetime.utcnow()
        
        # Update database
        updated_assessment = db_manager.update_assessment_from_progress(progress)
        
        # Publish status update (best-effort)
        try:
            await kafka_service.publish_assessment_status_update(progress, previous_status)
        except Exception as e:
            logger.warning(f"Failed to publish retry event: {e}")
        
        return AssessmentResponse.from_orm(updated_assessment)
        
    except Exception as e:
        logger.error(f"Retry failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retry assessment: {str(e)}"
        )


@router.get("/{assessment_id}/domain-scores")
@handle_exceptions
async def get_assessment_domain_scores(
    assessment_id: str,
    db_manager: DatabaseManager = Depends(get_db_manager),
    current_user: TokenData = Depends(get_current_user_required)
):
    """Get detailed scores for all completed domains"""
    
    assessment = db_manager.get_assessment(assessment_id)
    progress = assessment.to_progress_model()
    
    # Authorization check
    if current_user:
        if (progress.user_id and 
            progress.user_id != current_user.user_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
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
    
    # Fetch results from microservices
    async def fetch_domain_result(domain_name: str, service_url: str):
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{service_url}/assessment/{assessment_id}", 
                    timeout=5.0
                )
                if response.status_code == 200:
                    return response.json()
                return None
        except Exception as e:
            logger.error(f"Error fetching {domain_name} results: {e}")
            return None
    
    # Fetch completed domains
    if progress.resilience_submitted:
        result = await fetch_domain_result("resilience", settings.resilience_service_url)
        if result:
            domain_scores["domain_results"]["resilience"] = {
                "domain_name": "Resilience",
                "status": "completed",
                "overall_score": result.get("overall_score"),
                "domain_scores": result.get("domain_scores", {}),  # subdomain scores
                "detailed_metrics": result.get("detailed_metrics", {}),  
                "submitted_at": result.get("submitted_at"),
                "processed_at": result.get("processed_at"),
                "insights": _generate_resilience_insights(
                    result.get("overall_score"), 
                    result.get("domain_scores", {})
                )
            }

    if progress.sustainability_submitted:
        result = await fetch_domain_result("sustainability", settings.sustainability_service_url)
        if result:
            domain_scores["domain_results"]["sustainability"] = {
                "domain_name": "Sustainability",
                "status": "completed",
                "overall_score": result.get("overall_score"),
                "domain_scores": result.get("dimension_scores", {}),  # subdomain scores
                "detailed_metrics": result.get("detailed_metrics", {}),  
                "submitted_at": result.get("submitted_at"),
                "processed_at": result.get("processed_at"),
                "insights": _generate_sustainability_insights(
                    result.get("overall_score"),
                    result.get("dimension_scores", {})
                )
            }

    if progress.human_centricity_submitted:
        result = await fetch_domain_result("human_centricity", settings.human_centricity_service_url)
        if result:
            domain_scores["domain_results"]["human_centricity"] = {
                "domain_name": "Human Centricity",
                "status": "completed",
                "overall_score": result.get("overall_score"),
                "domain_scores": result.get("domain_scores", {}),  # subdomain scores
                "detailed_metrics": result.get("detailed_metrics", {}), 
                "submitted_at": result.get("submitted_at"),
                "processed_at": result.get("processed_at"),
                "insights": _generate_human_centricity_insights(
                    result.get("overall_score"),
                    result.get("domain_scores", {})
                )
            }
            
    # Add summary statistics
    completed_scores = [
        result.get("overall_score") 
        for result in domain_scores["domain_results"].values() 
        if result.get("overall_score") is not None
    ]
    
    if completed_scores:
        domain_scores["summary_statistics"] = {
            "completed_domain_count": len(completed_scores),
            "average_score": sum(completed_scores) / len(completed_scores),
            "highest_score": max(completed_scores),
            "lowest_score": min(completed_scores),
            "score_distribution": _categorize_scores(completed_scores)
        }
    
    return domain_scores


# ==================== Business Logic Helper Functions ====================

def _can_submit_domain(progress: AssessmentProgress, domain: str) -> bool:
    """Check if a domain can be submitted"""
    domain_map = {
        "resilience": not progress.resilience_submitted,
        "sustainability": not progress.sustainability_submitted,
        "human_centricity": not progress.human_centricity_submitted
    }
    return domain_map.get(domain, False)


def _mark_domain_complete(progress: AssessmentProgress, domain: str) -> AssessmentProgress:
    """Mark a domain as complete and update status"""
    if domain == "resilience":
        progress.resilience_submitted = True
    elif domain == "human_centricity":
        progress.human_centricity_submitted = True
    elif domain == "sustainability":
        progress.sustainability_submitted = True
    
    progress.status = _calculate_status(progress)
    progress.updated_at = datetime.utcnow()
    
    return progress


def _calculate_status(progress: AssessmentProgress) -> AssessmentStatus:
    """Calculate assessment status based on completed domains"""
    if (progress.resilience_submitted and 
        progress.human_centricity_submitted and 
        progress.sustainability_submitted):
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
            AssessmentStatus.STARTED,
            AssessmentStatus.PROCESSING
        ]
    }
    
    return new in valid_transitions.get(current, [])


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


def _generate_resilience_insights(
    overall_score: float, 
    domain_scores: Dict[str, Any]
) -> List[str]:
    """Generate insights for resilience assessment"""
    insights = []
    
    if overall_score:
        if overall_score >= 80:
            insights.append("Strong resilience across multiple domains")
        elif overall_score >= 60:
            insights.append("Moderate resilience with room for improvement")
        else:
            insights.append("Resilience requires significant attention")
    
    if domain_scores:
        strongest = max(domain_scores.items(), key=lambda x: x[1])
        weakest = min(domain_scores.items(), key=lambda x: x[1])
        insights.append(
            f"Strongest: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})"
        )
        insights.append(
            f"Needs improvement: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})"
        )
    
    return insights


def _generate_sustainability_insights(
    overall_score: float, 
    dimension_scores: Dict[str, Any]
) -> List[str]:
    """Generate insights for sustainability assessment"""
    insights = []
    
    if overall_score:
        if overall_score >= 80:
            insights.append("Strong sustainability performance")
        elif overall_score >= 60:
            insights.append("Good sustainability with enhancement opportunities")
        else:
            insights.append("Sustainability needs significant improvement")
    
    if dimension_scores:
        strongest = max(dimension_scores.items(), key=lambda x: x[1])
        weakest = min(dimension_scores.items(), key=lambda x: x[1])
        insights.append(
            f"Best: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})"
        )
        insights.append(
            f"Focus area: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})"
        )
    
    return insights


def _generate_human_centricity_insights(
    overall_score: float, 
    domain_scores: Dict[str, Any]
) -> List[str]:
    """Generate insights for human centricity assessment"""
    insights = []
    
    if overall_score:
        if overall_score >= 80:
            insights.append("Excellent user experience and human-centered design")
        elif overall_score >= 60:
            insights.append("Good user experience with areas for enhancement")
        else:
            insights.append("User experience requires significant improvement")
    
    if domain_scores:
        strongest = max(domain_scores.items(), key=lambda x: x[1])
        weakest = min(domain_scores.items(), key=lambda x: x[1])
        insights.append(
            f"Strongest: {strongest[0].replace('_', ' ').title()} ({strongest[1]:.1f})"
        )
        insights.append(
            f"Opportunity: {weakest[0].replace('_', ' ').title()} ({weakest[1]:.1f})"
        )
    
    return insights


def _categorize_scores(scores: List[float]) -> Dict[str, int]:
    """Categorize scores into performance bands"""
    categories = {
        "excellent": 0, 
        "good": 0, 
        "fair": 0, 
        "poor": 0, 
        "critical": 0
    }
    
    for score in scores:
        categories[_get_score_status(score)] += 1
    
    return categories
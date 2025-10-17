from fastapi import HTTPException
from fastapi import status

from shared.models.exceptions import (
    DigitalTwinAssessmentException,
    AssessmentNotFoundException,
    InvalidFormDataException,
    KafkaConnectionException,
    DatabaseConnectionException,
    ScoringException,
)


def create_http_exception(exc: DigitalTwinAssessmentException) -> HTTPException:
    """
    Convert a DigitalTwinAssessmentException into an HTTPException.

    Uses each exception's `status_code` and `error_code` attributes for the response.

    Example:
        try:
            # some operation that may fail
            assessment = get_assessment(assessment_id)
        except DigitalTwinAssessmentException as e:
            # FastAPI will return the mapped HTTP error
            raise create_http_exception(e)
    """
    # Build the response payload
    detail = {
        "error": exc.error_code,
        "message": str(exc)
    }
    # Use the exception's own status_code if provided, otherwise fallback
    status_code = getattr(exc, "status_code", status.HTTP_500_INTERNAL_SERVER_ERROR)

    return HTTPException(
        status_code=status_code,
        detail=detail
    )


# Example usage in a FastAPI route:
#
# from fastapi import APIRouter
# from shared.exceptions import AssessmentNotFoundException
#
# router = APIRouter()
#
# @router.get("/assessments/{assessment_id}")
# async def read_assessment(assessment_id: str):
#     try:
#         return fetch_assessment(assessment_id)
#     except AssessmentNotFoundException as e:
#         raise create_http_exception(e)


# Expose public symbols
__all__ = [
    "create_http_exception",
]

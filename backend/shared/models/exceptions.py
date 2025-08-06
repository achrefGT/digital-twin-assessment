"""Custom exceptions for the digital twin assessment system."""

from typing import Optional


class DigitalTwinAssessmentException(Exception):
    """
    Base exception for digital twin assessment system.

    Attributes:
        message: Human-readable description of the error.
        error_code: Machine-readable code identifying the error type.
        status_code: Suggested HTTP status code when translating to an HTTP response.
    """
    error_code: str = "unknown_error"
    status_code: int = 500

    def __init__(self, message: Optional[str] = None):
        # Use the class docstring as a default message if none provided
        default_msg = self.__class__.__doc__.strip().splitlines()[0] if self.__class__.__doc__ else ""
        self.message = message or default_msg
        super().__init__(self.message)

    def __str__(self) -> str:
        return self.message


class KafkaConnectionException(DigitalTwinAssessmentException):
    "Raised when Kafka connection fails."
    error_code = "kafka_connection_error"
    status_code = 503


class DatabaseConnectionException(DigitalTwinAssessmentException):
    "Raised when database connection fails."
    error_code = "database_connection_error"
    status_code = 503


class AssessmentNotFoundException(DigitalTwinAssessmentException):
    "Raised when an assessment is not found."
    error_code = "assessment_not_found"
    status_code = 404


class InvalidFormDataException(DigitalTwinAssessmentException):
    "Raised when submitted form data is invalid."
    error_code = "invalid_form_data"
    status_code = 400


class InvalidDomainException(InvalidFormDataException):
    "Raised when the provided domain field is invalid."
    error_code = "invalid_domain"
    # Inherits status_code = 400 from InvalidFormDataError


class ScoringException(DigitalTwinAssessmentException):
    "Raised when scoring calculation fails."
    error_code = "scoring_error"
    status_code = 500


# Public API
__all__ = [
    "DigitalTwinAssessmentException",
    "KafkaConnectionException",
    "DatabaseConnectionException",
    "AssessmentNotFoundException",
    "InvalidFormDataException",
    "InvalidDomainException",
    "ScoringException",
]

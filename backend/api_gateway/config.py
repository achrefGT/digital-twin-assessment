import os
from typing import List, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from shared.kafka_utils import KafkaConfig
from shared.database import get_database_url


class Settings(BaseSettings):
    """Application settings - Simplified for development"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )

    # Weight calculation settings - database-based
    weighting_alpha: float = 0.8  # Compromise parameter (0=objective, 1=subjective)
    weight_update_interval_hours: int = 24  # How often to update weights
    weight_calculation_lookback_days: int = 30  # How many days back to look for assessments
    max_assessments_for_weights: int = 1000  # Maximum assessments to use for weight calculation
    min_assessments_for_objective: int = 10  # Minimum assessments needed for objective weighting
    
    # Additional database performance settings
    weight_calculation_batch_size: int = 100  # Batch size for processing large numbers of assessments
    enable_weight_calculation_caching: bool = True  # Cache weight calculations for performance
    
    # Microservice URLs
    resilience_service_url: str = "http://resilience-service:8001"
    sustainability_service_url: str = "http://sustainability-service:8006" 
    human_centricity_service_url: str = "http://human-centricity-service:8002"
    slca_service_url: str = "http://slca-service:8003"
    elca_service_url: str = "http://elca-service:8005"
    lcc_service_url: str = "http://lcc-service:8004"

    # Database - Use shared database config utility
    database_pool_size: int = 10
    database_max_overflow: int = 20
    
    # Kafka - Use shared config as defaults but allow overrides
    kafka_bootstrap_servers: str = KafkaConfig.BOOTSTRAP_SERVERS
    kafka_retry_backoff_ms: int = KafkaConfig.RETRY_BACKOFF
    kafka_request_timeout_ms: int = KafkaConfig.REQUEST_TIMEOUT
    kafka_consumer_group_id: str = "api-gateway"

    # Kafka topics
    resilience_scores_topic: str = KafkaConfig.RESILIENCE_SCORES_TOPIC
    sustainability_scores_topic: str = KafkaConfig.SUSTAINABILITY_SCORES_TOPIC
    elca_scores_topic: str = KafkaConfig.ELCA_SCORES_TOPIC
    lcc_scores_topic: str = KafkaConfig.LCC_SCORES_TOPIC
    slca_scores_topic: str = KafkaConfig.SLCA_SCORES_TOPIC
    human_centricity_scores_topic: str = KafkaConfig.HUMAN_CENTRICITY_SCORES_TOPIC
    final_results_topic: str = KafkaConfig.FINAL_RESULT_TOPIC
    
    # Producer topics
    resilience_submission_topic: str = KafkaConfig.RESILIENCE_SUBMISSION_TOPIC
    sustainability_submission_topic: str = KafkaConfig.SUSTAINABILITY_SUBMISSION_TOPIC
    elca_submission_topic: str = KafkaConfig.ELCA_SUBMISSION_TOPIC
    lcc_submission_topic: str = KafkaConfig.LCC_SUBMISSION_TOPIC
    slca_submission_topic: str = KafkaConfig.SLCA_SUBMISSION_TOPIC
    human_centricity_submission_topic: str = KafkaConfig.HUMAN_CENTRICITY_SUBMISSION_TOPIC
    assessment_status_topic: str = KafkaConfig.ASSESSEMENT_STATUS_TOPIC
    error_events_topic: str = KafkaConfig.ERROR_EVENTS_TOPIC

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_workers: int = 1
    
    # CORS - Allow all for development (use Union to handle different input types)
    cors_origins: Union[List[str], str] = "*"  # Allow all origins for now
    cors_allow_credentials: bool = False  # No credentials needed
    
    # Rate limiting - Disabled for development
    rate_limit_per_minute: int = 0  # 0 = disabled
    
    # Logging
    log_level: str = "INFO"
    service_name: str = "api-gateway"

    # Auth settings
    jwt_secret_key: str = os.getenv("JWT_SECRET_KEY")
    jwt_algorithm: str = os.getenv("JWT_ALGORITHM", "HS256")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    refresh_token_expire_days: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))
    
    # Admin proxy settings
    admin_proxy_timeout: float = Field(default=30.0, env="ADMIN_PROXY_TIMEOUT")
    admin_proxy_retries: int = Field(default=3, env="ADMIN_PROXY_RETRIES")
        
        
    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        # Handle None or empty values
        if v is None or v == "":
            return ["*"]
        
        # Handle string values
        if isinstance(v, str):
            # Handle wildcard
            if v.strip() == "*":
                return ["*"]
            # Handle empty string
            if not v.strip():
                return ["*"]
            # Handle comma-separated values
            try:
                return [origin.strip() for origin in v.split(',') if origin.strip()]
            except Exception:
                return ["*"]
        
        # Handle list values (already parsed)
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        
        # Fallback to wildcard
        return ["*"]
    
    @property
    def database_url(self) -> str:
        """Get database URL using shared utility"""
        return get_database_url("api_gateway")


settings = Settings()
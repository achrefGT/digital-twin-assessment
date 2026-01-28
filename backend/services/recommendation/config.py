"""
Recommendation Service Configuration
Following sustainability service pattern
"""

import os
from typing import List, Dict, Any, Union, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from shared.kafka_utils import KafkaConfig
from shared.database import get_database_url


class RecommendationSettings(BaseSettings):
    """Recommendation service configuration settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        env_prefix="RECOMMENDATION_"  # Environment variables prefixed with RECOMMENDATION_
    )
    
    # Service identity
    service_name: str = "recommendation-service"
    version: str = "0.2.0"
    
    # Database configuration
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_pre_ping: bool = True
    database_pool_recycle: int = 3600  # 1 hour
    
    # Kafka configuration - Use shared config as defaults but allow overrides
    kafka_bootstrap_servers: str = KafkaConfig.BOOTSTRAP_SERVERS
    kafka_retry_backoff_ms: int = KafkaConfig.RETRY_BACKOFF
    kafka_request_timeout_ms: int = KafkaConfig.REQUEST_TIMEOUT
    kafka_consumer_group_id: str = "recommendation-service"
    kafka_auto_offset_reset: str = "latest"
    kafka_session_timeout_ms: int = 30000
    kafka_heartbeat_interval_ms: int = 3000
    
    # Kafka topics
    recommendation_request_topic: str = KafkaConfig.RECOMMENDATION_REQUEST_TOPIC
    recommendation_completed_topic: str = KafkaConfig.RECOMMENDATION_COMPLETED_TOPIC
    error_events_topic: str = KafkaConfig.ERROR_EVENTS_TOPIC
    
    # API configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8004
    api_workers: int = 1
    
    # CORS settings
    cors_origins: Union[List[str], str] = "*"
    cors_allow_credentials: bool = True
    cors_allow_methods: Union[List[str], str] = "*"
    cors_allow_headers: Union[List[str], str] = "*"
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
    
    # AI Configuration
    groq_api_key: str = os.getenv("RECOMMENDATION_GROQ_API_KEY")
    nvidia_api_key: Optional[str] = os.getenv("RECOMMENDATION_NVIDIA_API_KEY")
    groq_model: str = "llama-3.3-70b-versatile"
    nvidia_model: str = "meta/llama-3.1-70b-instruct"
    
    # AI Settings
    ai_max_retries: int = 3
    ai_timeout_seconds: int = 30
    ai_rate_limit_delay: float = 2.0
    ai_default_temperature: float = 0.7
    ai_max_tokens: int = 2500
    
    # Feature Flags
    enable_ai_recommendations: bool = True
    enable_groq: bool = True
    enable_nvidia: bool = True
    enable_caching: bool = False
    enable_custom_criteria_tips: bool = True
    use_rule_based_fallback: bool = True
    merge_ai_and_rules: bool = False
    
    # Processing settings
    max_concurrent_requests: int = 10
    processing_timeout_seconds: int = 60
    retry_attempts: int = 3
    retry_delay_seconds: int = 5
    
    # Recommendation settings
    max_recommendations_per_set: int = 12
    min_recommendations_per_set: int = 5
    recommendation_priority_threshold: float = 0.6  # Confidence threshold
    
    # Health check settings
    health_check_timeout_seconds: int = 5
    kafka_health_check_enabled: bool = True
    database_health_check_enabled: bool = True
    
    # Feature flags
    enable_detailed_metrics: bool = True
    enable_performance_monitoring: bool = True
    enable_request_logging: bool = True
    
    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if v is None or v == "":
            return ["*"]
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [origin.strip() for origin in v.split(',') if origin.strip()]
            except Exception:
                return ["*"]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["*"]
    
    @field_validator('cors_allow_methods', mode='before')
    @classmethod
    def parse_cors_methods(cls, v):
        if v is None or v == "":
            return ["*"]
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [method.strip().upper() for method in v.split(',') if method.strip()]
            except Exception:
                return ["*"]
        if isinstance(v, list):
            return [str(method).strip().upper() for method in v if str(method).strip()]
        return ["*"]
    
    @field_validator('cors_allow_headers', mode='before')
    @classmethod
    def parse_cors_headers(cls, v):
        if v is None or v == "":
            return ["*"]
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [header.strip() for header in v.split(',') if header.strip()]
            except Exception:
                return ["*"]
        if isinstance(v, list):
            return [str(header).strip() for header in v if str(header).strip()]
        return ["*"]
    
    @field_validator('log_level')
    @classmethod
    def validate_log_level(cls, v):
        valid_levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        if v.upper() not in valid_levels:
            raise ValueError(f'Invalid log level. Must be one of: {valid_levels}')
        return v.upper()
    
    @field_validator('groq_api_key', mode='before')
    @classmethod
    def get_groq_key(cls, v):
        # Allow direct value or fetch from env
        return v or os.getenv("RECOMMENDATION_GROQ_API_KEY", "")
    
    @field_validator('nvidia_api_key', mode='before')
    @classmethod
    def get_nvidia_key(cls, v):
        # Allow direct value or fetch from env
        return v or os.getenv("RECOMMENDATION_NVIDIA_API_KEY")
    
    @property
    def database_url(self) -> str:
        """Get database URL using shared utility"""
        return get_database_url("recommendation")
    
    @property
    def kafka_consumer_config(self) -> Dict[str, Any]:
        """Get Kafka consumer configuration"""
        return {
            "bootstrap_servers": self.kafka_bootstrap_servers,
            "group_id": self.kafka_consumer_group_id,
            "auto_offset_reset": self.kafka_auto_offset_reset,
            "session_timeout_ms": self.kafka_session_timeout_ms,
            "heartbeat_interval_ms": self.kafka_heartbeat_interval_ms,
            "retry_backoff_ms": self.kafka_retry_backoff_ms,
            "request_timeout_ms": self.kafka_request_timeout_ms,
        }
    
    @property
    def kafka_producer_config(self) -> Dict[str, Any]:
        """Get Kafka producer configuration"""
        return {
            "bootstrap_servers": self.kafka_bootstrap_servers,
            "retry_backoff_ms": self.kafka_retry_backoff_ms,
            "request_timeout_ms": self.kafka_request_timeout_ms,
            "compression_type": "gzip",
            "acks": "all",
            "enable_idempotence": True,
        }
    
    @property
    def database_engine_config(self) -> Dict[str, Any]:
        """Get database engine configuration"""
        return {
            "pool_size": self.database_pool_size,
            "max_overflow": self.database_max_overflow,
            "pool_pre_ping": self.database_pool_pre_ping,
            "pool_recycle": self.database_pool_recycle,
        }
    
    def get_topic_config(self) -> Dict[str, str]:
        """Get all topic configurations"""
        return {
            "input": self.recommendation_request_topic,
            "output": self.recommendation_completed_topic,
            "error": self.error_events_topic,
        }
    
    def validate_ai_config(self) -> bool:
        """Validate AI configuration"""
        if self.enable_ai_recommendations:
            if not self.groq_api_key and not self.nvidia_api_key:
                raise ValueError(
                    "At least one API key (RECOMMENDATION_GROQ_API_KEY or RECOMMENDATION_NVIDIA_API_KEY) is required "
                    "when AI recommendations are enabled"
                )
        
        if self.ai_max_retries < 1:
            raise ValueError("ai_max_retries must be at least 1")
        
        if self.ai_timeout_seconds < 1:
            raise ValueError("ai_timeout_seconds must be at least 1")
        
        return True


# Global settings instance
settings = RecommendationSettings()

# Validate AI config on load
try:
    settings.validate_ai_config()
except ValueError as e:
    import logging
    logging.warning(f"AI configuration validation warning: {e}")


# Convenience function for backward compatibility
def get_config() -> RecommendationSettings:
    """Get global configuration (singleton pattern)"""
    return settings
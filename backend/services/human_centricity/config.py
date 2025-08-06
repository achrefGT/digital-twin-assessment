import os
from typing import List, Dict, Any, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from shared.kafka_utils import KafkaConfig
from shared.database import get_database_url


class HumanCentricitySettings(BaseSettings):
    """human_centricity service configuration settings"""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        env_prefix="HUMAN_CENTRICITY_"  # Environment variables prefixed with SERVICE_NAME_
    )
    
    # Service identity
    service_name: str = "human-centricity-service"
    version: str = "0.1.0"
    
    # Database configuration
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_pre_ping: bool = True
    database_pool_recycle: int = 3600  # 1 hour
    
    # Kafka configuration - Use shared config as defaults but allow overrides
    kafka_bootstrap_servers: str = KafkaConfig.BOOTSTRAP_SERVERS
    kafka_retry_backoff_ms: int = KafkaConfig.RETRY_BACKOFF
    kafka_request_timeout_ms: int = KafkaConfig.REQUEST_TIMEOUT
    kafka_consumer_group_id: str = "human-centricity-service"
    kafka_auto_offset_reset: str = "latest"
    kafka_session_timeout_ms: int = 30000
    kafka_heartbeat_interval_ms: int = 3000
    
    # Kafka topics
    human_centricity_submission_topic: str = KafkaConfig.HUMAN_CENTRICITY_SUBMISSION_TOPIC
    human_centricity_scores_topic: str = KafkaConfig.HUMAN_CENTRICITY_SCORES_TOPIC
    error_events_topic: str = KafkaConfig.ERROR_EVENTS_TOPIC

    
    # API configuration
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    api_workers: int = 1
    
    # CORS settings (use Union to handle different input types)
    cors_origins: Union[List[str], str] = "*"
    cors_allow_credentials: bool = True
    cors_allow_methods: Union[List[str], str] = "*"
    cors_allow_headers: Union[List[str], str] = "*"
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s"
    
    # Processing settings
    max_concurrent_assessments: int = 10
    processing_timeout_seconds: int = 30
    retry_attempts: int = 3
    retry_delay_seconds: int = 5
    
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
        # Handle None or empty values
        if v is None or v == "":
            return ["*"]
        
        # Handle string values
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [origin.strip() for origin in v.split(',') if origin.strip()]
            except Exception:
                return ["*"]
        
        # Handle list values
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        
        return ["*"]
    
    @field_validator('cors_allow_methods', mode='before')
    @classmethod
    def parse_cors_methods(cls, v):
        # Handle None or empty values
        if v is None or v == "":
            return ["*"]
        
        # Handle string values
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [method.strip().upper() for method in v.split(',') if method.strip()]
            except Exception:
                return ["*"]
        
        # Handle list values
        if isinstance(v, list):
            return [str(method).strip().upper() for method in v if str(method).strip()]
        
        return ["*"]
    
    @field_validator('cors_allow_headers', mode='before')
    @classmethod
    def parse_cors_headers(cls, v):
        # Handle None or empty values
        if v is None or v == "":
            return ["*"]
        
        # Handle string values
        if isinstance(v, str):
            if v.strip() == "*":
                return ["*"]
            if not v.strip():
                return ["*"]
            try:
                return [header.strip() for header in v.split(',') if header.strip()]
            except Exception:
                return ["*"]
        
        # Handle list values
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
    
    @property
    def database_url(self) -> str:
        """Get database URL using shared utility"""
        return get_database_url("resilience")
    
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
            "input": self.human_centricity_submission_topic,
            "output": self.human_centricity_scores_topic,
            "error": self.error_events_topic,
        }


# Global settings instance
settings = HumanCentricitySettings()
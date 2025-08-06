import os
import logging
from functools import lru_cache
from typing import Any

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine.url import URL

logger = logging.getLogger(__name__)

class DatabaseSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False
    )
    
    host: str = Field("localhost", env="DATABASE_HOST")
    port: int = Field(5432, env="DATABASE_PORT")
    sslmode: str = Field("prefer", env="DATABASE_SSLMODE")

@lru_cache(maxsize=None)
def get_database_url(service_name: str) -> str:
    svc = service_name.upper()
    
    # Get service-specific database configuration with fallbacks
    host = os.getenv(f"{svc}_DB_HOST", os.getenv("DATABASE_HOST", "localhost"))
    port = int(os.getenv(f"{svc}_DB_PORT", os.getenv("DATABASE_PORT", "5432")))
    user = os.getenv(f"{svc}_DB_USER", f"{service_name}_user")
    password = os.getenv(f"{svc}_DB_PASSWORD")
    name = os.getenv(f"{svc}_DB_NAME", f"{service_name}_db")
    sslmode = os.getenv(f"{svc}_DB_SSLMODE", os.getenv("DATABASE_SSLMODE", "prefer"))

    if password is None:
        logger.error("Missing password for %s; please set %s_DB_PASSWORD", service_name, svc)
        raise EnvironmentError(f"{svc}_DB_PASSWORD is required")

    # Build URL manually to ensure password is included
    # This is more reliable than URL.create() for this case
    url = f"postgresql://{user}:{password}@{host}:{port}/{name}?sslmode={sslmode}"
    
    logger.info(f"Database URL for {service_name}: postgresql://{user}@{host}:{port}/{name}")
    
    return url
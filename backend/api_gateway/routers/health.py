from datetime import datetime
from fastapi import APIRouter, Depends
from typing import Dict, Any

from ..database.database_manager import DatabaseManager
from ..services.kafka_service import KafkaService
from ..utils.dependencies import get_db_manager, get_kafka_service

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service)
) -> Dict[str, Any]:
    """Comprehensive health check endpoint"""
    
    # Check database health
    db_healthy = db_manager.health_check()
    
    # Check Kafka health
    kafka_healthy = await kafka_service.health_check()
    
    # Overall health status
    healthy = db_healthy and kafka_healthy
    
    return {
        "service": "api-gateway",
        "version": "0.1.0",
        "status": "healthy" if healthy else "unhealthy",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "database": {
                "status": "healthy" if db_healthy else "unhealthy",
                "details": "PostgreSQL connection" if db_healthy else "Connection failed"
            },
            "kafka": {
                "status": "healthy" if kafka_healthy else "unhealthy", 
                "details": "Kafka broker connection" if kafka_healthy else "Connection failed"
            }
        }
    }


@router.get("/ready")
async def readiness_check(
    kafka_service: KafkaService = Depends(get_kafka_service)
) -> Dict[str, Any]:
    """Readiness check for Kubernetes"""
    
    ready = kafka_service.running
    
    return {
        "status": "ready" if ready else "not ready",
        "services_started": ready,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Liveness check for Kubernetes"""
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/metrics")
async def get_metrics(
    db_manager: DatabaseManager = Depends(get_db_manager),
    kafka_service: KafkaService = Depends(get_kafka_service)
) -> Dict[str, Any]:
    """Get service metrics for monitoring"""
    
    # Get Kafka service metrics
    kafka_metrics = await kafka_service.get_service_metrics()
    
    # Basic database metrics
    db_metrics = {
        "healthy": db_manager.health_check(),
        "pool_size": getattr(db_manager.engine.pool, 'size', lambda: 0)(),
        "checked_out": getattr(db_manager.engine.pool, 'checkedout', lambda: 0)()
    }
    
    return {
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat(),
        "database": db_metrics,
        "kafka": kafka_metrics
    }

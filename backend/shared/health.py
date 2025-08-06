from datetime import datetime
from typing import Dict, Any, Optional


def create_health_response(
    service_name: str, 
    additional_checks: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Create standardized health check response"""
    
    health_data = {
        "service": service_name,
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "0.1.0"
    }
    
    if additional_checks:
        health_data["checks"] = additional_checks
        # Set status to unhealthy if any check fails
        if not all(additional_checks.values()):
            health_data["status"] = "unhealthy"
    
    return health_data


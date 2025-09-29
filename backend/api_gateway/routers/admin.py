from fastapi import APIRouter, HTTPException, Depends, Path, Body, Query
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any, List
import httpx
import logging
from datetime import datetime

from ..dependencies import get_current_user_required
from ..auth.models import TokenData, UserRole
from ..config import settings

logger = logging.getLogger(__name__)

async def require_admin(current_user: TokenData = Depends(get_current_user_required)) -> TokenData:
    """Require admin role"""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    return current_user

router = APIRouter(
    prefix="/admin",
    tags=["admin"],
    dependencies=[Depends(require_admin)]  # Require admin authentication
)

# Service endpoints configuration
SERVICE_ENDPOINTS = {
    "sustainability": {
        "base_url": f"{settings.sustainability_service_url}",
        "health_endpoint": "/health"
    },
    "resilience": {
        "base_url": f"{settings.resilience_service_url}",
        "health_endpoint": "/health"
    },
    "human_centricity": {
        "base_url": f"{settings.human_centricity_service_url}",
        "health_endpoint": "/health"
    }
}

async def proxy_request(service_name: str, endpoint: str, method: str = "GET", 
                       data: Optional[Dict] = None, params: Optional[Dict] = None):
    """Generic proxy function to forward requests to microservices"""
    if service_name not in SERVICE_ENDPOINTS:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
    
    service_config = SERVICE_ENDPOINTS[service_name]
    url = f"{service_config['base_url']}{endpoint}"
    
    timeout = getattr(settings, 'admin_proxy_timeout', 30.0)
    
    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            if method.upper() == "GET":
                response = await client.get(url, params=params)
            elif method.upper() == "POST":
                response = await client.post(url, json=data, params=params)
            elif method.upper() == "PUT":
                response = await client.put(url, json=data, params=params)
            elif method.upper() == "DELETE":
                response = await client.delete(url, params=params)
            else:
                raise HTTPException(status_code=405, detail="Method not allowed")
            
            response.raise_for_status()
            
            # Handle responses with no content (like 204 No Content)
            if response.status_code == 204 or not response.content:
                return {"success": True, "message": "Operation completed successfully"}
            
            # Try to parse JSON, but handle cases where response is not JSON
            try:
                return response.json()
            except ValueError:
                # If response is not JSON, return the text content
                return {"success": True, "content": response.text}
            
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail=f"Service {service_name} timeout")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=f"Service error: {e.response.text}")
        except Exception as e:
            logger.error(f"Error proxying to {service_name}: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")


# =============================================================================
# SUSTAINABILITY SERVICE ADMIN ENDPOINTS
# =============================================================================

@router.get("/sustainability/criteria/all")
async def get_all_sustainability_criteria(current_user: TokenData = Depends(require_admin)):
    """Admin: Get all sustainability criteria"""
    return await proxy_request("sustainability", "/criteria/all")

@router.get("/sustainability/criteria/domain/{domain}")
async def get_sustainability_criteria_by_domain(
    domain: str = Path(...), 
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get sustainability criteria for specific domain"""
    return await proxy_request("sustainability", f"/criteria/domain/{domain}")

@router.post("/sustainability/criteria")
async def create_sustainability_criterion(
    criterion_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Create new sustainability criterion"""
    result = await proxy_request("sustainability", "/criteria", "POST", criterion_data)
    logger.info(f"Admin {current_user.username} created sustainability criterion: {result.get('criterion_key', 'unknown')}")
    return result

@router.put("/sustainability/criteria/{criterion_id}")
async def update_sustainability_criterion(
    criterion_id: str = Path(...),
    criterion_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Update sustainability criterion"""
    result = await proxy_request("sustainability", f"/criteria/{criterion_id}", "PUT", criterion_data)
    logger.info(f"Admin {current_user.username} updated sustainability criterion: {criterion_id}")
    return result

@router.delete("/sustainability/criteria/{criterion_id}")
async def delete_sustainability_criterion(
    criterion_id: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Delete sustainability criterion"""
    await proxy_request("sustainability", f"/criteria/{criterion_id}", "DELETE")
    logger.info(f"Admin {current_user.username} deleted sustainability criterion: {criterion_id}")
    return {"message": "Criterion deleted successfully"}

@router.post("/sustainability/criteria/reset")
async def reset_sustainability_criteria(
    request_body: Optional[Dict[str, Any]] = Body(None),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Reset sustainability criteria to defaults"""
    # Handle different request body formats
    domain = None
    if request_body:
        # Handle both {"domain": "environmental"} and just "environmental"
        if isinstance(request_body, dict):
            domain = request_body.get("domain")
        elif isinstance(request_body, str):
            domain = request_body
    
    # Create the payload for the sustainability service
    payload = {"domain": domain} if domain else {}
    
    result = await proxy_request("sustainability", "/criteria/reset", "POST", payload)
    logger.warning(f"Admin {current_user.username} reset sustainability criteria{f' for domain {domain}' if domain else ''}")
    return result


# =============================================================================
# RESILIENCE SERVICE ADMIN ENDPOINTS
# =============================================================================

@router.get("/resilience/scenarios/all")
async def get_all_resilience_scenarios(current_user: TokenData = Depends(require_admin)):
    """Admin: Get all resilience scenarios"""
    return await proxy_request("resilience", "/scenarios/all")

@router.get("/resilience/scenarios/domain/{domain}")
async def get_resilience_scenarios_by_domain(
    domain: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get resilience scenarios for specific domain"""
    return await proxy_request("resilience", f"/scenarios/domain/{domain}")

@router.post("/resilience/scenarios")
async def create_resilience_scenario(
    scenario_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Create new resilience scenario"""
    result = await proxy_request("resilience", "/scenarios", "POST", scenario_data)
    logger.info(f"Admin {current_user.username} created resilience scenario in domain: {scenario_data.get('domain', 'unknown')}")
    return result

@router.put("/resilience/scenarios/{scenario_id}")
async def update_resilience_scenario(
    scenario_id: str = Path(...),
    scenario_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Update resilience scenario"""
    result = await proxy_request("resilience", f"/scenarios/{scenario_id}", "PUT", scenario_data)
    logger.info(f"Admin {current_user.username} updated resilience scenario: {scenario_id}")
    return result

@router.delete("/resilience/scenarios/{scenario_id}")
async def delete_resilience_scenario(
    scenario_id: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Delete resilience scenario"""
    await proxy_request("resilience", f"/scenarios/{scenario_id}", "DELETE")
    logger.info(f"Admin {current_user.username} deleted resilience scenario: {scenario_id}")
    return {"message": "Scenario deleted successfully"}

@router.post("/resilience/scenarios/reset")
async def reset_resilience_scenarios(
    request_body: Optional[Dict[str, Any]] = Body(None),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Reset resilience scenarios to defaults"""
    # Handle different request body formats
    domain = None
    if request_body:
        # Handle both {"domain": "Robustness"} and just "Robustness"
        if isinstance(request_body, dict):
            domain = request_body.get("domain")
        elif isinstance(request_body, str):
            domain = request_body
    
    # Create the payload for the resilience service
    payload = {"domain": domain} if domain else {}
    
    result = await proxy_request("resilience", "/scenarios/reset", "POST", payload)
    logger.warning(f"Admin {current_user.username} reset resilience scenarios{f' for domain {domain}' if domain else ''}")
    return result


# =============================================================================
# HUMAN CENTRICITY SERVICE ADMIN ENDPOINTS
# =============================================================================

@router.get("/human-centricity/statements")
async def get_all_human_centricity_statements(
    domain: Optional[str] = Query(None),
    active_only: bool = Query(True),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get all human centricity statements"""
    params = {"active_only": active_only}
    if domain:
        params["domain"] = domain
    return await proxy_request("human_centricity", "/statements", params=params)

@router.post("/human-centricity/statements")
async def create_human_centricity_statement(
    statement_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Create new human centricity statement"""
    result = await proxy_request("human_centricity", "/statements", "POST", statement_data)
    logger.info(f"Admin {current_user.username} created human centricity statement: {result.get('id', 'unknown')}")
    return result

@router.put("/human-centricity/statements/{statement_id}")
async def update_human_centricity_statement(
    statement_id: str = Path(...),
    statement_data: Dict[str, Any] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Update human centricity statement"""
    result = await proxy_request("human_centricity", f"/statements/{statement_id}", "PUT", statement_data)
    logger.info(f"Admin {current_user.username} updated human centricity statement: {statement_id}")
    return result

@router.delete("/human-centricity/statements/{statement_id}")
async def delete_human_centricity_statement(
    statement_id: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Delete human centricity statement"""
    await proxy_request("human_centricity", f"/statements/{statement_id}", "DELETE")
    logger.info(f"Admin {current_user.username} deleted human centricity statement: {statement_id}")
    return {"message": "Statement deleted successfully"}


@router.post("/human-centricity/domains/{domain}/reset")
async def reset_human_centricity_domain(
    domain: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Reset domain to defaults"""
    result = await proxy_request("human_centricity", f"/domains/{domain}/reset", "POST")
    logger.warning(f"Admin {current_user.username} reset human centricity domain: {domain}")
    return result

# =============================================================================
# SYSTEM ADMIN ENDPOINTS
# =============================================================================

@router.get("/services/health")
async def get_all_services_health(current_user: TokenData = Depends(require_admin)):
    """Admin: Get health status of all services"""
    health_results = {}
    
    for service_name, config in SERVICE_ENDPOINTS.items():
        try:
            health_data = await proxy_request(service_name, config["health_endpoint"])
            health_results[service_name] = {
                "status": "healthy",
                "data": health_data,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            health_results[service_name] = {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }
    
    return {
        "overall_status": "healthy" if all(r["status"] == "healthy" for r in health_results.values()) else "unhealthy",
        "services": health_results,
        "checked_by": current_user.username,
        "checked_at": datetime.utcnow().isoformat()
    }

@router.get("/services/{service_name}/health")
async def get_service_health(
    service_name: str = Path(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get health status of specific service"""
    if service_name not in SERVICE_ENDPOINTS:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")
    
    config = SERVICE_ENDPOINTS[service_name]
    return await proxy_request(service_name, config["health_endpoint"])

@router.get("/audit/recent-actions")
async def get_recent_admin_actions(
    limit: int = Query(50, le=200),
    service: Optional[str] = Query(None),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get recent admin actions (placeholder for future implementation)"""
    return {
        "message": "Audit logging not implemented yet",
        "recommendation": "Implement audit logging in database or external service",
        "requested_by": current_user.username
    }

@router.get("/config/services")
async def get_services_configuration(current_user: TokenData = Depends(require_admin)):
    """Admin: Get current services configuration"""
    return {
        "services": SERVICE_ENDPOINTS,
        "gateway_info": {
            "version": "0.1.0",
            "admin_routes_enabled": True,
            "authentication_required": True
        },
        "retrieved_by": current_user.username
    }

@router.post("/config/validate")
async def validate_configuration(current_user: TokenData = Depends(require_admin)):
    """Admin: Validate configuration across all services"""
    validation_results = {}
    
    for service_name in SERVICE_ENDPOINTS.keys():
        try:
            if service_name == "sustainability":
                result = await proxy_request(service_name, "/criteria/validate", "POST", {})
            elif service_name == "resilience":
                result = await proxy_request(service_name, "/scenarios/validate", "POST", {})
            elif service_name == "human_centricity":
                result = await proxy_request(service_name, "/validation")
            else:
                result = {"valid": True, "message": "No validation endpoint available"}
            
            validation_results[service_name] = result
        except Exception as e:
            validation_results[service_name] = {
                "valid": False,
                "error": str(e)
            }
    
    overall_valid = all(result.get("valid", False) for result in validation_results.values())
    
    return {
        "overall_valid": overall_valid,
        "services": validation_results,
        "validated_by": current_user.username,
        "validated_at": datetime.utcnow().isoformat()
    }

# =============================================================================
# ADMIN DASHBOARD INFO
# =============================================================================

@router.get("/dashboard")
async def get_admin_dashboard(current_user: TokenData = Depends(require_admin)):
    """Admin: Get admin dashboard overview"""
    try:
        # Get health status of all services
        health_status = {}
        for service_name, config in SERVICE_ENDPOINTS.items():
            try:
                health_data = await proxy_request(service_name, config["health_endpoint"])
                health_status[service_name] = "healthy"
            except Exception:
                health_status[service_name] = "unhealthy"
        
        # Get configuration counts (this would need actual implementation)
        config_summary = {
            "sustainability_criteria": "Available via /admin/sustainability/criteria/all",
            "resilience_scenarios": "Available via /admin/resilience/scenarios/all", 
            "human_centricity_statements": "Available via /admin/human-centricity/statements"
        }
        
        return {
            "admin_user": current_user.username,
            "services_health": health_status,
            "overall_health": "healthy" if all(status == "healthy" for status in health_status.values()) else "degraded",
            "configuration_summary": config_summary,
            "available_actions": {
                "sustainability": [
                    "View/create/update/delete criteria",
                    "Reset domains to defaults",
                    "Validate configuration"
                ],
                "resilience": [
                    "View/create/update/delete scenarios", 
                    "Reset domains to defaults",
                    "Validate configuration"
                ],
                "human_centricity": [
                    "View/create/update/delete statements",
                    "Reset domains to defaults"
                ],
                "system": [
                    "Monitor service health",
                    "View audit logs (planned)",
                    "Validate system configuration"
                ]
            },
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating admin dashboard: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate dashboard")
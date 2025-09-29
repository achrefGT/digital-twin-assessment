from fastapi import APIRouter, HTTPException, Depends, Path, Body, Query
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any, List
import httpx
import logging
from datetime import datetime, timedelta

from ..dependencies import get_current_user_required
from ..auth.models import TokenData, UserRole
from ..config import settings

logger = logging.getLogger(__name__)


async def require_admin(current_user: TokenData = Depends(get_current_user_required)) -> TokenData:
    """Require admin role"""
    adminRoles = [UserRole.ADMIN.value, UserRole.SUPER_ADMIN.value]
    if current_user.role not in adminRoles :
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
    
# =============================================================================
# Users Management ENDPOINTS
# =============================================================================

@router.get("/users")
async def get_all_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Get all users with pagination and filtering"""
    from ..auth.service import AuthService
    from ..database import DatabaseManager
    from sqlalchemy import or_, and_
    from ..auth.models import User
    
    db_manager = DatabaseManager()
    
    with db_manager.get_session() as session:
        query = session.query(User)
        
        # Apply role filter
        if role:
            query = query.filter(User.role == role)
        
        # Apply search filter
        if search:
            search_term = f"%{search.lower()}%"
            query = query.filter(or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
                User.first_name.ilike(search_term),
                User.last_name.ilike(search_term)
            ))
        
        # Get total count
        total = query.count()
        
        # Apply pagination
        offset = (page - 1) * limit
        users = query.offset(offset).limit(limit).all()
        
        # Convert to response format
        user_data = []
        for user in users:
            user_data.append({
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "role": user.role,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "created_at": user.created_at.isoformat() if user.created_at else None,
                "last_login": user.last_login.isoformat() if user.last_login else None
            })
        
        return {
            "users": user_data,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": (total + limit - 1) // limit
            },
            "filters": {
                "role": role,
                "search": search
            }
        }

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str = Path(...),
    role_data: Dict[str, str] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Update user role (promote/demote)"""
    from ..auth.service import AuthService
    from ..database import DatabaseManager
    from ..auth.models import User, UserRole
    
    # Validate role
    new_role = role_data.get("role")
    if new_role not in [role.value for role in UserRole]:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role. Must be one of: {[role.value for role in UserRole]}"
        )
    
    # Prevent self-demotion from admin
    if current_user.user_id == user_id and new_role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=400,
            detail="You cannot remove your own admin privileges"
        )
    
    db_manager = DatabaseManager()
    
    with db_manager.get_session() as session:
        user = session.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        old_role = user.role
        user.role = new_role
        user.updated_at = datetime.utcnow()
        
        session.commit()
        
        logger.info(f"Admin {current_user.username} changed user {user.username} role from {old_role} to {new_role}")
        
        return {
            "message": f"User role updated from {old_role} to {new_role}",
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "updated_at": user.updated_at.isoformat()
            }
        }

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: str = Path(...),
    status_data: Dict[str, bool] = Body(...),
    current_user: TokenData = Depends(require_admin)
):
    """Admin: Update user active status (enable/disable)"""
    from ..auth.service import AuthService
    from ..database import DatabaseManager
    from ..auth.models import User
    
    is_active = status_data.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=400, detail="is_active field is required")
    
    # Prevent self-deactivation
    if current_user.user_id == user_id and not is_active:
        raise HTTPException(
            status_code=400,
            detail="You cannot deactivate your own account"
        )
    
    db_manager = DatabaseManager()
    
    with db_manager.get_session() as session:
        user = session.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        old_status = user.is_active
        user.is_active = is_active
        user.updated_at = datetime.utcnow()
        
        session.commit()
        
        # If deactivating, revoke all refresh tokens
        if not is_active:
            auth_service = AuthService(db_manager)
            revoked_count = auth_service.revoke_all_user_tokens(user_id)
            logger.info(f"Revoked {revoked_count} tokens for deactivated user {user.username}")
        
        status_text = "activated" if is_active else "deactivated"
        logger.info(f"Admin {current_user.username} {status_text} user {user.username}")
        
        return {
            "message": f"User {status_text} successfully",
            "user": {
                "user_id": user.user_id,
                "username": user.username,
                "email": user.email,
                "is_active": user.is_active,
                "updated_at": user.updated_at.isoformat()
            }
        }

@router.get("/users/stats")
async def get_user_statistics(current_user: TokenData = Depends(require_admin)):
    """Admin: Get user statistics"""
    from ..auth.models import User, UserRole
    from ..database import DatabaseManager
    from sqlalchemy import func
    
    db_manager = DatabaseManager()
    
    with db_manager.get_session() as session:
        # Total users
        total_users = session.query(User).count()
        
        # Active users
        active_users = session.query(User).filter(User.is_active == True).count()
        
        # Users by role
        role_counts = session.query(User.role, func.count(User.id)).group_by(User.role).all()
        roles_breakdown = {role: count for role, count in role_counts}
        
        # Recently registered (last 30 days)
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        recent_users = session.query(User).filter(
            User.created_at >= thirty_days_ago
        ).count()
        
        # Recently active (last 7 days)
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recently_active = session.query(User).filter(
            User.last_login >= seven_days_ago
        ).count()
        
        return {
            "total_users": total_users,
            "active_users": active_users,
            "inactive_users": total_users - active_users,
            "roles": roles_breakdown,
            "recent_registrations": recent_users,
            "recently_active": recently_active,
            "generated_at": datetime.utcnow().isoformat(),
            "generated_by": current_user.username
        }
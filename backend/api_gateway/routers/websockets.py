# routers/websockets.py
from datetime import datetime
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, HTTPException
from typing import Optional
import logging
import json
import asyncio

# Adjust import based on your actual project structure
from ..websocket_service import connection_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websockets"])

@router.websocket("/ws/{assessment_id}")
async def websocket_endpoint(
    websocket: WebSocket, 
    assessment_id: str,
    user_id: Optional[str] = Query(None)
):
    """WebSocket endpoint for real-time assessment updates"""
    
    # Validate assessment_id format (add your validation logic)
    if not assessment_id or len(assessment_id.strip()) == 0:
        await websocket.close(code=1008, reason="Invalid assessment ID")
        return
    
    try:
        # Connect to WebSocket manager
        await connection_manager.connect(websocket, assessment_id, user_id)
        logger.info(f"WebSocket connected for assessment {assessment_id}, user {user_id}")
        
        # Send welcome message
        welcome_message = {
            "type": "connected",
            "assessment_id": assessment_id,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "message": "Real-time connection established"
        }
        
        await websocket.send_text(json.dumps(welcome_message))
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                # Add timeout to prevent hanging connections
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                
                # Handle different message types
                await handle_websocket_message(websocket, assessment_id, user_id, data)
                
            except asyncio.TimeoutError:
                # Send ping to check if connection is still alive
                await websocket.send_text(json.dumps({
                    "type": "ping",
                    "timestamp": datetime.utcnow().isoformat()
                }))
                continue
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error processing WebSocket message: {e}")
                # Send error message to client
                error_message = {
                    "type": "error",
                    "message": "Error processing message",
                    "timestamp": datetime.utcnow().isoformat()
                }
                try:
                    await websocket.send_text(json.dumps(error_message))
                except:
                    break
            
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for assessment {assessment_id}")
    except Exception as e:
        logger.error(f"WebSocket error for assessment {assessment_id}: {e}")
    finally:
        # Ensure cleanup
        try:
            connection_manager.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error during WebSocket cleanup: {e}")

async def handle_websocket_message(websocket: WebSocket, assessment_id: str, user_id: Optional[str], data: str):
    """Handle incoming WebSocket messages"""
    try:
        # Handle ping/pong for connection health
        if data.strip() == "ping":
            await websocket.send_text(json.dumps({
                "type": "pong",
                "timestamp": datetime.utcnow().isoformat()
            }))
            return
        
        # Try to parse as JSON for structured messages
        try:
            message = json.loads(data)
            message_type = message.get("type", "unknown")
            
            if message_type == "subscribe":
                # Handle subscription to specific events
                await handle_subscription(websocket, assessment_id, user_id, message)
            elif message_type == "unsubscribe":
                # Handle unsubscription
                await handle_unsubscription(websocket, assessment_id, user_id, message)
            else:
                logger.info(f"Received message type '{message_type}' from assessment {assessment_id}")
                
        except json.JSONDecodeError:
            # Handle plain text messages
            logger.info(f"Received text message from assessment {assessment_id}: {data}")
            
    except Exception as e:
        logger.error(f"Error handling WebSocket message: {e}")
        raise

async def handle_subscription(websocket: WebSocket, assessment_id: str, user_id: Optional[str], message: dict):
    """Handle subscription requests"""
    events = message.get("events", [])
    logger.info(f"User {user_id} subscribing to events {events} for assessment {assessment_id}")
    
    # Add logic to track subscriptions
    # This would typically update the connection manager's subscription tracking
    
    response = {
        "type": "subscription_confirmed",
        "events": events,
        "assessment_id": assessment_id,
        "timestamp": datetime.utcnow().isoformat()
    }
    await websocket.send_text(json.dumps(response))

async def handle_unsubscription(websocket: WebSocket, assessment_id: str, user_id: Optional[str], message: dict):
    """Handle unsubscription requests"""
    events = message.get("events", [])
    logger.info(f"User {user_id} unsubscribing from events {events} for assessment {assessment_id}")
    
    response = {
        "type": "unsubscription_confirmed",
        "events": events,
        "assessment_id": assessment_id,
        "timestamp": datetime.utcnow().isoformat()
    }
    await websocket.send_text(json.dumps(response))

# Health check endpoint for WebSocket status
@router.get("/ws/health")
async def websocket_health():
    """Get WebSocket connection status"""
    try:
        active_connections = len(connection_manager.active_connections)
        return {
            "status": "healthy",
            "active_connections": active_connections,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error getting WebSocket health: {e}")
        raise HTTPException(status_code=500, detail="WebSocket service unavailable")
    
@router.get("/ws/debug/websocket/{assessment_id}")
async def debug_websocket_status(assessment_id: str):
    """Debug endpoint to check WebSocket connections"""
    stats = connection_manager.get_stats()
    return {
        "assessment_id": assessment_id,
        "has_connections": assessment_id in connection_manager.assessment_connections,
        "connection_count": len(connection_manager.assessment_connections.get(assessment_id, set())),
        "total_active_connections": len(connection_manager.active_connections),
        "stats": stats
    }
# websocket_service.py
import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store connections by assessment_id for targeted updates
        self.assessment_connections: Dict[str, Set[WebSocket]] = {}
        # Store connections by user_id for user-specific updates
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # Store all active connections
        self.active_connections: Set[WebSocket] = set()
    
    async def connect(self, websocket: WebSocket, assessment_id: str, user_id: Optional[str] = None):
        """Accept WebSocket connection and register it"""
        await websocket.accept()
        
        # Add to active connections
        self.active_connections.add(websocket)
        
        # Register for assessment-specific updates
        if assessment_id not in self.assessment_connections:
            self.assessment_connections[assessment_id] = set()
        self.assessment_connections[assessment_id].add(websocket)
        
        # Register for user-specific updates if user_id provided
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = set()
            self.user_connections[user_id].add(websocket)
        
        logger.info(f"WebSocket connected for assessment {assessment_id}, user {user_id}")
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection from all registrations"""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        # Remove from assessment connections
        for assessment_id, connections in self.assessment_connections.items():
            connections.discard(websocket)
        
        # Remove from user connections
        for user_id, connections in self.user_connections.items():
            connections.discard(websocket)
        
        # Clean up empty connection sets
        self.assessment_connections = {
            k: v for k, v in self.assessment_connections.items() if v
        }
        self.user_connections = {
            k: v for k, v in self.user_connections.items() if v
        }
        
        logger.info("WebSocket disconnected")
    
    async def send_to_assessment(self, assessment_id: str, message: dict):
        """Send message to all connections for a specific assessment"""
        if assessment_id in self.assessment_connections:
            connections = self.assessment_connections[assessment_id].copy()
            disconnected = []
            
            for connection in connections:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending to WebSocket: {e}")
                    disconnected.append(connection)
            
            # Clean up dead connections
            for connection in disconnected:
                self.disconnect(connection)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections for a specific user"""
        if user_id in self.user_connections:
            connections = self.user_connections[user_id].copy()
            disconnected = []
            
            for connection in connections:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Error sending to WebSocket: {e}")
                    disconnected.append(connection)
            
            # Clean up dead connections
            for connection in disconnected:
                self.disconnect(connection)

# Global connection manager instance
connection_manager = ConnectionManager()
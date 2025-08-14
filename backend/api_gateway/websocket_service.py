# Enhanced websocket_service.py with message queuing and better debugging

import asyncio
import json
import logging
from typing import Dict, Set, Optional, List
from fastapi import WebSocket, WebSocketDisconnect
from datetime import datetime
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # Store connections by assessment_id for targeted updates
        self.assessment_connections: Dict[str, Set[WebSocket]] = {}
        # Store connections by user_id for user-specific updates
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        # Store all active connections
        self.active_connections: Set[WebSocket] = set()
        
        # Message queuing for assessments without active connections
        self.message_queue: Dict[str, deque] = defaultdict(lambda: deque(maxlen=50))
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}
    
    async def connect(self, websocket: WebSocket, assessment_id: str, user_id: Optional[str] = None):
        """Accept WebSocket connection and register it"""
        await websocket.accept()
        
        # Add to active connections
        self.active_connections.add(websocket)
        
        # Store metadata
        self.connection_metadata[websocket] = {
            "assessment_id": assessment_id,
            "user_id": user_id,
            "connected_at": datetime.utcnow()
        }
        
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
        logger.info(f"Total active connections: {len(self.active_connections)}")
        
        # Send any queued messages for this assessment
        await self._send_queued_messages(assessment_id, websocket)
    
    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection from all registrations"""
        metadata = self.connection_metadata.pop(websocket, {})
        assessment_id = metadata.get("assessment_id")
        
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        # Remove from assessment connections
        for aid, connections in self.assessment_connections.items():
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
        
        logger.info(f"WebSocket disconnected for assessment {assessment_id}")
        logger.info(f"Total active connections: {len(self.active_connections)}")
    
    async def send_to_assessment(self, assessment_id: str, message: dict):
        """Send message to all connections for a specific assessment with enhanced logging"""
        logger.info(f"Attempting to send message to assessment {assessment_id}")
        logger.info(f"Message type: {message.get('type', 'unknown')}")
        logger.info(f"Available connections for {assessment_id}: {len(self.assessment_connections.get(assessment_id, set()))}")
        
        # Check if there are active connections for this assessment
        if assessment_id not in self.assessment_connections or not self.assessment_connections[assessment_id]:
            logger.warning(f"No active connections for assessment {assessment_id}, queuing message")
            self._queue_message(assessment_id, message)
            return
        
        connections = self.assessment_connections[assessment_id].copy()
        disconnected = []
        sent_count = 0
        
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
                sent_count += 1
                logger.debug(f"Message sent successfully to connection for assessment {assessment_id}")
            except Exception as e:
                logger.error(f"Error sending to WebSocket for assessment {assessment_id}: {e}")
                disconnected.append(connection)
        
        # Clean up dead connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.info(f"Message sent to {sent_count} connections for assessment {assessment_id}")
        
        # If no successful sends, queue the message
        if sent_count == 0:
            logger.warning(f"No successful sends for assessment {assessment_id}, queuing message")
            self._queue_message(assessment_id, message)
    
    def _queue_message(self, assessment_id: str, message: dict):
        """Queue message for later delivery when connection is established"""
        message_with_timestamp = {
            **message,
            "queued_at": datetime.utcnow().isoformat()
        }
        self.message_queue[assessment_id].append(message_with_timestamp)
        logger.info(f"Queued message for assessment {assessment_id}. Queue size: {len(self.message_queue[assessment_id])}")
    
    async def _send_queued_messages(self, assessment_id: str, websocket: WebSocket):
        """Send queued messages when a new connection is established"""
        if assessment_id in self.message_queue and self.message_queue[assessment_id]:
            queued_messages = list(self.message_queue[assessment_id])
            self.message_queue[assessment_id].clear()
            
            logger.info(f"Sending {len(queued_messages)} queued messages to new connection for assessment {assessment_id}")
            
            for message in queued_messages:
                try:
                    await websocket.send_text(json.dumps(message))
                    logger.debug(f"Queued message sent for assessment {assessment_id}")
                except Exception as e:
                    logger.error(f"Error sending queued message: {e}")
                    # Re-queue failed messages
                    self.message_queue[assessment_id].append(message)
                    break
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to all connections for a specific user"""
        logger.info(f"Attempting to send message to user {user_id}")
        
        if user_id not in self.user_connections or not self.user_connections[user_id]:
            logger.warning(f"No active connections for user {user_id}")
            return
        
        connections = self.user_connections[user_id].copy()
        disconnected = []
        sent_count = 0
        
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
                sent_count += 1
            except Exception as e:
                logger.error(f"Error sending to WebSocket for user {user_id}: {e}")
                disconnected.append(connection)
        
        # Clean up dead connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.info(f"Message sent to {sent_count} connections for user {user_id}")
    
    def get_stats(self) -> dict:
        """Get connection statistics for debugging"""
        return {
            "total_active_connections": len(self.active_connections),
            "assessment_connections": {
                aid: len(connections) 
                for aid, connections in self.assessment_connections.items()
            },
            "user_connections": {
                uid: len(connections) 
                for uid, connections in self.user_connections.items()
            },
            "queued_messages": {
                aid: len(queue) 
                for aid, queue in self.message_queue.items() 
                if queue
            }
        }

# Global connection manager instance
connection_manager = ConnectionManager()
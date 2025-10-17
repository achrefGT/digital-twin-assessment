"""
WebSocket Connection Manager with Redis Pub/Sub integration.

This service manages WebSocket connections and integrates with Redis Pub/Sub
for cross-instance message broadcasting in distributed deployments.

Features:
- Local in-memory connection tracking per assessment
- Redis Pub/Sub for cross-instance message broadcasting
- Message queuing for reconnections with TTL
- Graceful connection handling
- Automatic channel subscription/unsubscription with locking
- Message deduplication to prevent double-delivery

"""

import asyncio
import json
import logging
from typing import Dict, Set, Optional
from fastapi import WebSocket
from datetime import datetime, timedelta
from dataclasses import dataclass
from ..config import settings
from collections import defaultdict, deque

logger = logging.getLogger(__name__)


@dataclass
class QueuedMessage:
    """Message queued for later delivery with expiry tracking."""
    message: dict
    queued_at: datetime
    ttl_seconds: int = 300  # 5 minutes default TTL


class ConnectionManager:
    """
    Manages WebSocket connections with Redis Pub/Sub integration.
    
    Architecture:
    - Single-instance mode: Uses only in-memory connections (fast, local)
    - Multi-instance mode: Uses Redis Pub/Sub for cross-instance broadcasting
    
    Connection Flow:
    1. Client connects -> stored in memory + subscribe to Redis channel
    2. Message arrives via Kafka -> sent to local connections + Redis Pub/Sub
    3. Other instances receive via Redis -> deliver to their local connections
    4. Client disconnects -> removed from memory, unsubscribe if last connection
    
    Message Deduplication:
    - When sending locally, also publish to Redis
    - When receiving from Redis, skip if from own instance
    - This prevents double-delivery to local connections
    """
    
    def __init__(self, redis_service=None):
        """Initialize the connection manager."""
        # In-memory connection tracking
        self.assessment_connections: Dict[str, Set[WebSocket]] = {}
        self.user_connections: Dict[str, Set[WebSocket]] = {}
        self.active_connections: Set[WebSocket] = set()
        
        # Connection metadata for tracking and debugging
        self.connection_metadata: Dict[WebSocket, Dict] = {}
        
        # Message queuing for reconnections with expiry
        self.message_queue: Dict[str, deque[QueuedMessage]] = defaultdict(
            lambda: deque(maxlen=50)
        )
        
        # Redis service reference
        self._redis_service = redis_service
        
        # Subscription management with locking
        self._subscription_locks: Dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._subscribed_assessments: Set[str] = set()
        self._subscription_refcount: Dict[str, int] = defaultdict(int)
        
        # Statistics
        self._messages_sent = 0
        self._messages_queued = 0
        self._messages_received_redis = 0
        self._messages_skipped_own = 0
        self._connections_total = 0
        self._disconnections_total = 0
        
        # Cleanup task reference
        self._cleanup_task: Optional[asyncio.Task] = None
        
        logger.info("ConnectionManager initialized")
    
    @property
    def redis_service(self):
        """Lazy-load Redis service to avoid circular imports."""
        if self._redis_service is None:
            from .redis_base_service import get_redis_service
            self._redis_service = get_redis_service()
        return self._redis_service
    
    async def connect(
        self,
        websocket: WebSocket,
        assessment_id: str,
        user_id: Optional[str] = None
    ):
        """
        Accept WebSocket connection and register it.
        
        Args:
            websocket: FastAPI WebSocket connection
            assessment_id: Assessment identifier for this connection
            user_id: Optional user identifier for tracking
        """
        try:
            # Accept the WebSocket connection
            await websocket.accept()
            
            # Add to active connections set
            self.active_connections.add(websocket)
            self._connections_total += 1
            
            # Store metadata for debugging and tracking
            self.connection_metadata[websocket] = {
                "assessment_id": assessment_id,
                "user_id": user_id,
                "connected_at": datetime.utcnow(),
                "gateway_instance": getattr(settings, 'gateway_instance_id', 'unknown')
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
            
            logger.info(
                f"WebSocket connected: assessment={assessment_id}, "
                f"user={user_id}, total_connections={len(self.active_connections)}"
            )
            
            # Subscribe to Redis channel with proper locking
            await self._subscribe_to_assessment_channel(assessment_id)
            
            # Send any queued messages that arrived while offline
            await self._send_queued_messages(assessment_id, websocket)
            
        except Exception as e:
            logger.error(f"Error accepting WebSocket connection: {e}", exc_info=True)
            raise
    
    def disconnect(self, websocket: WebSocket):
        """
        Remove WebSocket connection from all registrations.
        
        Cleanup happens in order:
        1. Remove from in-memory tracking
        2. Decrement refcount and unsubscribe if last connection
        3. Clean up empty data structures
        
        Args:
            websocket: WebSocket connection to disconnect
        """
        try:
            # Get metadata before removing
            metadata = self.connection_metadata.pop(websocket, {})
            assessment_id = metadata.get("assessment_id")
            user_id = metadata.get("user_id")
            
            # Remove from active connections
            if websocket in self.active_connections:
                self.active_connections.remove(websocket)
                self._disconnections_total += 1
            
            # Remove from assessment connections
            if assessment_id and assessment_id in self.assessment_connections:
                self.assessment_connections[assessment_id].discard(websocket)
                
                # If no more connections for this assessment, schedule unsubscribe
                if not self.assessment_connections[assessment_id]:
                    self.assessment_connections.pop(assessment_id, None)
                    
                    # Use reference counting to prevent race conditions
                    asyncio.create_task(
                        self._unsubscribe_from_assessment_channel(assessment_id)
                    )
            
            # Remove from user connections
            if user_id and user_id in self.user_connections:
                self.user_connections[user_id].discard(websocket)
                if not self.user_connections[user_id]:
                    self.user_connections.pop(user_id, None)
            
            logger.info(
                f"WebSocket disconnected: assessment={assessment_id}, "
                f"total_connections={len(self.active_connections)}"
            )
            
        except Exception as e:
            logger.error(f"Error disconnecting WebSocket: {e}", exc_info=True)
    
    async def send_to_assessment(
        self,
        assessment_id: str,
        message: dict
    ):
        """
        Send message to all clients for an assessment.
        
        Flow:
        1. Send to local WebSocket connections (this instance)
        2. Publish to Redis Pub/Sub (other instances will receive and deliver locally)
        
        This ensures message delivery regardless of which instance
        the client is connected to.
        
        Args:
            assessment_id: Assessment identifier
            message: Message dict to send
        """
        logger.debug(
            f"send_to_assessment: assessment={assessment_id}, "
            f"message_type={message.get('type', 'unknown')}"
        )
        
        # Step 1: Send to local connections on this instance
        await self._send_to_local_connections(assessment_id, message)
        
        # Step 2: Publish to Redis for other instances (if enabled)
        if self.redis_service.enable_pubsub and self.redis_service.pubsub:
            try:
                channel = f"ws:assessment:{assessment_id}"
                
                # Add metadata
                message_with_meta = {
                    **message,
                    "redis_published_at": datetime.utcnow().isoformat(),
                    "gateway_instance": getattr(settings, 'gateway_instance_id', 'unknown')
                }
                
                success = await self.redis_service.pubsub.publish(channel, message_with_meta)
                
                if not success:
                    logger.warning(
                        f"Failed to publish to Redis for assessment {assessment_id}. "
                        f"Remote instances may not receive this message."
                    )
            except Exception as e:
                logger.error(f"Error publishing to Redis: {e}")
    
    async def _send_to_local_connections(
        self,
        assessment_id: str,
        message: dict
    ):
        """
        Send message to local WebSocket connections only.
        
        This is called for both:
        1. Local delivery when message originates on this instance
        2. Delivery after receiving from Redis Pub/Sub
        
        Args:
            assessment_id: Assessment identifier
            message: Message to send
        """
        if assessment_id not in self.assessment_connections:
            logger.debug(f"No local connections for assessment {assessment_id}, queuing")
            self._queue_message(assessment_id, message)
            return
        
        connections = self.assessment_connections[assessment_id].copy()
        if not connections:
            logger.debug(f"No active connections for assessment {assessment_id}, queuing")
            self._queue_message(assessment_id, message)
            return
        
        disconnected = []
        sent_count = 0
        
        # Send to each connected client
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
                sent_count += 1
                self._messages_sent += 1
                logger.debug(f"Message sent to local connection: {assessment_id}")
            except Exception as e:
                logger.error(
                    f"Error sending to WebSocket for assessment {assessment_id}: {e}"
                )
                disconnected.append(connection)
        
        # Clean up dead connections
        for connection in disconnected:
            self.disconnect(connection)
        
        if sent_count > 0:
            logger.debug(
                f"Message delivered to {sent_count} local connections: {assessment_id}"
            )
        else:
            logger.warning(
                f"No successful sends to local connections, queuing message: {assessment_id}"
            )
            self._queue_message(assessment_id, message)
    
    async def _subscribe_to_assessment_channel(self, assessment_id: str):
        """
        Subscribe to Redis channel for an assessment with proper locking.
        
        Uses reference counting to prevent race conditions where multiple
        connections arrive/depart simultaneously.
        
        Args:
            assessment_id: Assessment identifier
        """
        if not self.redis_service.enable_pubsub or not self.redis_service.pubsub:
            logger.debug("Pub/Sub not enabled, skipping subscription")
            return
        
        try:
            # Only one coroutine can modify subscription state at a time
            async with self._subscription_locks[assessment_id]:
                # Increment reference count
                self._subscription_refcount[assessment_id] += 1
                
                # Subscribe only on first connection
                if self._subscription_refcount[assessment_id] == 1:
                    channel = f"ws:assessment:{assessment_id}"
                    success = await self.redis_service.pubsub.subscribe(
                        channel,
                        self._handle_redis_message
                    )
                    
                    if success:
                        self._subscribed_assessments.add(assessment_id)
                        logger.info(
                            f"📡 Subscribed to Redis channel for assessment {assessment_id} "
                            f"(refcount: {self._subscription_refcount[assessment_id]})"
                        )
                    else:
                        # Subscription failed, decrement refcount
                        self._subscription_refcount[assessment_id] -= 1
                        logger.error(f"Failed to subscribe to assessment {assessment_id}")
                else:
                    logger.debug(
                        f"Already subscribed to {assessment_id} "
                        f"(refcount: {self._subscription_refcount[assessment_id]})"
                    )
        except Exception as e:
            logger.error(f"Error subscribing to assessment {assessment_id}: {e}", exc_info=True)


    async def _unsubscribe_from_assessment_channel(self, assessment_id: str):
        """
        Unsubscribe from Redis channel for an assessment with proper locking.
        
        Uses reference counting to ensure we only unsubscribe when the last
        connection for this assessment disconnects.
        
        Args:
            assessment_id: Assessment identifier
        """
        if not self.redis_service.enable_pubsub or not self.redis_service.pubsub:
            return
        
        try:
            # Only one coroutine can modify subscription state at a time
            async with self._subscription_locks[assessment_id]:
                # Decrement reference count
                self._subscription_refcount[assessment_id] -= 1
                
                # Unsubscribe only when count reaches 0
                if self._subscription_refcount[assessment_id] <= 0:
                    channel = f"ws:assessment:{assessment_id}"
                    
                    # Remove handlers for this channel
                    if channel in self.redis_service.pubsub._message_handlers:
                        del self.redis_service.pubsub._message_handlers[channel]
                    
                    # Unsubscribe from Redis
                    try:
                        await self.redis_service.pubsub.pubsub.unsubscribe(channel)
                        self._subscribed_assessments.discard(assessment_id)
                        logger.info(f"🔕 Unsubscribed from Redis channel for assessment {assessment_id}")
                    except Exception as e:
                        logger.error(f"Failed to unsubscribe from {channel}: {e}")
                    
                    # Clean up refcount tracking
                    if assessment_id in self._subscription_refcount:
                        del self._subscription_refcount[assessment_id]
                    if assessment_id in self._subscription_locks:
                        del self._subscription_locks[assessment_id]
                else:
                    logger.debug(
                        f"Still have connections for {assessment_id} "
                        f"(refcount: {self._subscription_refcount[assessment_id]}), "
                        f"not unsubscribing"
                    )
        except Exception as e:
            logger.error(
                f"Error unsubscribing from assessment {assessment_id}: {e}",
                exc_info=True
            )
    
    async def _handle_redis_message(self, message: Dict):
        """
        Handle messages received from Redis Pub/Sub.
        
        CRITICAL: This prevents duplicate delivery by skipping messages
        that originated from this gateway instance.
        
        Called when another gateway instance publishes a message to this
        assessment's channel. Routes the message to local connections.
        
        Args:
            message: Message dict from Redis
        """
        try:
            assessment_id = message.get("assessment_id")
            
            if not assessment_id:
                logger.warning("Received Redis message without assessment_id")
                return
            
            # CRITICAL FIX: Skip messages from our own instance to prevent duplicate delivery
            source_instance = message.get("gateway_instance")
            our_instance = getattr(settings, 'gateway_instance_id', 'unknown')
            
            if source_instance == our_instance:
                logger.debug(
                    f"⏭️ Skipping own message from Redis: {assessment_id} "
                    f"(source: {source_instance})"
                )
                self._messages_skipped_own += 1
                return
            
            self._messages_received_redis += 1
            
            logger.debug(
                f"📩 Received Redis message from {source_instance}: "
                f"assessment={assessment_id}, type={message.get('type', 'unknown')}"
            )
            
            # Only deliver messages from OTHER instances
            await self._send_to_local_connections(assessment_id, message)
            
        except Exception as e:
            logger.error(f"Error handling Redis message: {e}", exc_info=True)
    
    def _queue_message(self, assessment_id: str, message: dict):
        """
        Queue message for later delivery with expiry tracking.
        
        Messages are queued when:
        1. No local connections exist for the assessment
        2. All delivery attempts failed
        3. Client reconnects and replays queued messages
        
        Queue size is limited to prevent memory overflow.
        
        Args:
            assessment_id: Assessment identifier
            message: Message to queue
        """
        queued = QueuedMessage(
            message=message,
            queued_at=datetime.utcnow(),
            ttl_seconds=300  # 5 minutes
        )
        
        self.message_queue[assessment_id].append(queued)
        self._messages_queued += 1
        
        logger.debug(
            f"📬 Queued message for {assessment_id}. "
            f"Queue size: {len(self.message_queue[assessment_id])}"
        )
    
    async def _send_queued_messages(
        self,
        assessment_id: str,
        websocket: WebSocket
    ):
        """
        Send queued messages to newly connected client with expiry check.
        
        When a client reconnects, replay any messages that were queued
        while they were disconnected, but only if not expired.
        
        Args:
            assessment_id: Assessment identifier
            websocket: WebSocket connection to send to
        """
        if assessment_id not in self.message_queue:
            return
        
        if not self.message_queue[assessment_id]:
            return
        
        now = datetime.utcnow()
        queued_messages = list(self.message_queue[assessment_id])
        self.message_queue[assessment_id].clear()
        
        # Filter out expired messages
        valid_messages = []
        expired_count = 0
        
        for queued in queued_messages:
            age = (now - queued.queued_at).total_seconds()
            
            if age > queued.ttl_seconds:
                logger.debug(
                    f"🗑️ Dropping expired queued message "
                    f"(age: {age:.1f}s, TTL: {queued.ttl_seconds}s)"
                )
                expired_count += 1
            else:
                valid_messages.append(queued)
        
        if not valid_messages:
            logger.info(
                f"No valid queued messages for {assessment_id} "
                f"({expired_count} expired)"
            )
            return
        
        logger.info(
            f"📤 Sending {len(valid_messages)} queued messages to new connection: "
            f"{assessment_id} ({expired_count} expired, {len(valid_messages)} valid)"
        )
        
        # Send valid messages
        failed_messages = []
        sent_count = 0
        
        for queued in valid_messages:
            try:
                await websocket.send_text(json.dumps(queued.message))
                sent_count += 1
                logger.debug(f"Queued message sent for {assessment_id}")
            except Exception as e:
                logger.error(f"Error sending queued message: {e}")
                # Re-queue failed messages
                failed_messages.append(queued)
                break  # Stop on first failure
        
        # Re-queue messages that failed to send
        if failed_messages:
            logger.warning(
                f"⚠️ Re-queuing {len(failed_messages)} failed messages for {assessment_id}"
            )
            for msg in failed_messages:
                self.message_queue[assessment_id].append(msg)
        
        logger.info(
            f"✅ Sent {sent_count}/{len(valid_messages)} queued messages for {assessment_id}"
        )
    
    async def send_to_user(
        self,
        user_id: str,
        message: dict
    ):
        """
        Send message to all connections for a specific user.
        
        Used for user-specific notifications (e.g., system messages,
        profile updates) that aren't assessment-specific.
        
        Args:
            user_id: User identifier
            message: Message to send
        """
        logger.debug(
            f"send_to_user: user={user_id}, "
            f"message_type={message.get('type', 'unknown')}"
        )
        
        if user_id not in self.user_connections:
            logger.debug(f"No connections for user {user_id}")
            return
        
        connections = self.user_connections[user_id].copy()
        if not connections:
            logger.debug(f"No active connections for user {user_id}")
            return
        
        disconnected = []
        sent_count = 0
        
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
                sent_count += 1
                self._messages_sent += 1
            except Exception as e:
                logger.error(f"Error sending to user {user_id}: {e}")
                disconnected.append(connection)
        
        # Clean up dead connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.debug(f"Sent message to {sent_count} user connections: {user_id}")
    
    async def broadcast_to_all(self, message: dict):
        """
        Broadcast message to all connected clients.
        
        Used for system-wide announcements.
        
        Args:
            message: Message to broadcast
        """
        logger.info(f"Broadcasting to all connections: {len(self.active_connections)}")
        
        connections = self.active_connections.copy()
        disconnected = []
        sent_count = 0
        
        for connection in connections:
            try:
                await connection.send_text(json.dumps(message))
                sent_count += 1
                self._messages_sent += 1
            except Exception as e:
                logger.error(f"Error broadcasting: {e}")
                disconnected.append(connection)
        
        # Clean up dead connections
        for connection in disconnected:
            self.disconnect(connection)
        
        logger.info(f"Broadcast complete: {sent_count}/{len(connections)} successful")
    
    async def cleanup_expired_queued_messages(self):
        """
        Background task to periodically clean up expired queued messages.
        
        This prevents memory buildup from messages queued for assessments
        that never reconnect.
        """
        logger.info("🧹 Starting queued message cleanup task")
        
        try:
            while True:
                try:
                    await asyncio.sleep(60)  # Run every minute
                    
                    now = datetime.utcnow()
                    assessments_to_clean = list(self.message_queue.keys())
                    total_removed = 0
                    
                    for assessment_id in assessments_to_clean:
                        if assessment_id not in self.message_queue:
                            continue
                        
                        queue = self.message_queue[assessment_id]
                        original_size = len(queue)
                        
                        # Filter out expired messages
                        valid_messages = deque(
                            (msg for msg in queue 
                             if (now - msg.queued_at).total_seconds() <= msg.ttl_seconds),
                            maxlen=50
                        )
                        
                        removed = original_size - len(valid_messages)
                        total_removed += removed
                        
                        if removed > 0:
                            self.message_queue[assessment_id] = valid_messages
                            logger.debug(
                                f"Cleaned {removed} expired messages for {assessment_id}"
                            )
                        
                        # Remove empty queues
                        if not valid_messages:
                            del self.message_queue[assessment_id]
                    
                    if total_removed > 0:
                        logger.info(f"🗑️ Cleaned up {total_removed} expired queued messages")
                    
                except Exception as e:
                    logger.error(f"Error in cleanup iteration: {e}", exc_info=True)
                    await asyncio.sleep(5)  # Back off on errors
                    
        except asyncio.CancelledError:
            logger.info("Queued message cleanup task cancelled")
        except Exception as e:
            logger.error(f"Fatal error in cleanup task: {e}", exc_info=True)
    
    def start_cleanup_task(self):
        """Start the background cleanup task."""
        if self._cleanup_task is None or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(
                self.cleanup_expired_queued_messages()
            )
            logger.info("Started cleanup task")
    
    async def stop_cleanup_task(self):
        """Stop the background cleanup task."""
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            try:
                await asyncio.wait_for(self._cleanup_task, timeout=2.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                pass
            logger.info("Stopped cleanup task")
    
    def get_stats(self) -> dict:
        """
        Get connection statistics for monitoring and debugging.
        
        Returns statistics about active connections, assessment tracking,
        and message queues for observability.
        
        Returns:
            Dict with connection statistics
        """
        # Calculate queue statistics
        total_queued = sum(len(queue) for queue in self.message_queue.values())
        max_queue_size = max(
            (len(queue) for queue in self.message_queue.values()),
            default=0
        )
        
        stats = {
            "total_active_connections": len(self.active_connections),
            "total_assessments": len(self.assessment_connections),
            "total_users": len(self.user_connections),
            "total_subscribed_assessments": len(self._subscribed_assessments),
            "assessment_connections": {
                aid: len(connections)
                for aid, connections in self.assessment_connections.items()
            },
            "user_connections": {
                uid: len(connections)
                for uid, connections in self.user_connections.items()
            },
            "queued_messages": {
                "total_messages": total_queued,
                "max_queue_size": max_queue_size,
                "assessments_with_queue": len(self.message_queue),
                "by_assessment": {
                    aid: len(queue)
                    for aid, queue in self.message_queue.items()
                    if queue
                }
            },
            "subscription_refcounts": dict(self._subscription_refcount),
            "lifetime_stats": {
                "total_connections": self._connections_total,
                "total_disconnections": self._disconnections_total,
                "messages_sent": self._messages_sent,
                "messages_queued": self._messages_queued,
                "messages_received_redis": self._messages_received_redis,
                "messages_skipped_own": self._messages_skipped_own
            },
            "redis_pubsub_enabled": self.redis_service.enable_pubsub,
            "cleanup_task_running": self._cleanup_task is not None and not self._cleanup_task.done()
        }
        
        return stats
    
    async def get_stats_async(self) -> dict:
        """
        Get connection statistics asynchronously (includes Redis stats).
        
        Returns:
            Dict with connection statistics including Redis Pub/Sub stats
        """
        stats = self.get_stats()
        
        # Add Redis Pub/Sub stats if enabled
        if self.redis_service.enable_pubsub:
            try:
                stats["redis_pubsub_stats"] = await self.redis_service.get_pubsub_stats()
            except Exception as e:
                logger.warning(f"Failed to get Redis Pub/Sub stats: {e}")
                stats["redis_pubsub_stats"] = {"error": str(e)}
        
        return stats


# Global connection manager instance
# This is the singleton used throughout the application
connection_manager = ConnectionManager()
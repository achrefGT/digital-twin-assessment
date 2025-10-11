"""
Redis Service for session management, WebSocket registry, and caching.

This service provides:
- Session persistence with configurable TTL
- WebSocket connection registry
- Message deduplication
- Assessment state caching
- Cache stampede protection (Phase 2)
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Set, Dict, Any, List
from redis.asyncio import Redis, from_url
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError, LockError
import backoff
import uuid

from .config import settings
from shared.models.assessment import AssessmentProgress

logger = logging.getLogger(__name__)


class RedisService:
    """Centralized Redis service for session, caching, and WebSocket management."""
    
    def __init__(self, redis_url: Optional[str] = None):
        """
        Initialize Redis service.
        
        Args:
            redis_url: Redis connection URL. Falls back to settings if not provided.
        """
        self.redis_url = redis_url or getattr(
            settings, 
            'redis_url', 
            'redis://localhost:6379/0'
        )
        self.redis: Optional[Redis] = None
        self.connected = False
        
        # Configuration from settings with sensible defaults
        self.session_ttl = getattr(settings, 'session_ttl_seconds', 1800)  # 30 min
        self.message_dedup_ttl = getattr(settings, 'message_dedup_ttl_seconds', 300)  # 5 min
        self.cache_ttl = getattr(settings, 'cache_ttl_seconds', 300)  # 5 min
        
        # Phase 2: Stampede protection settings
        self.lock_timeout = getattr(settings, 'cache_lock_timeout_seconds', 10)  # 10s max lock
        self.lock_retry_delay = getattr(settings, 'cache_lock_retry_delay_ms', 50)  # 50ms between retries
        self.lock_max_retries = getattr(settings, 'cache_lock_max_retries', 100)  # Max 5 seconds of retries
        
        logger.info(f"RedisService initialized with URL: {self.redis_url}")
        logger.info(f"Session TTL: {self.session_ttl}s, Dedup TTL: {self.message_dedup_ttl}s")
        logger.info(f"Lock timeout: {self.lock_timeout}s, Lock retry: {self.lock_retry_delay}ms")
    
    @backoff.on_exception(
        backoff.expo,
        (RedisConnectionError, ConnectionError),
        max_tries=5,
        max_time=30
    )
    async def connect(self):
        """Connect to Redis with automatic retry."""
        try:
            self.redis = from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30
            )
            
            # Test connection
            await self.redis.ping()
            self.connected = True
            logger.info("✅ Redis connection established")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.connected = False
            raise
    
    async def disconnect(self):
        """Close Redis connection gracefully."""
        if self.redis:
            try:
                await self.redis.close()
                self.connected = False
                logger.info("Redis connection closed")
            except Exception as e:
                logger.error(f"Error closing Redis connection: {e}")
    
    async def health_check(self) -> bool:
        """Check if Redis is healthy."""
        try:
            if not self.redis:
                return False
            await self.redis.ping()
            return True
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return False
    
    # ==================== SESSION MANAGEMENT ====================
    
    async def store_user_session(
        self, 
        user_id: str, 
        assessment_id: str,
        ttl: Optional[int] = None
    ) -> bool:
        """
        Store user's active assessment session.
        
        Args:
            user_id: User identifier
            assessment_id: Active assessment ID
            ttl: Time-to-live in seconds (uses default if not provided)
            
        Returns:
            True if successful
        """
        try:
            ttl = ttl or self.session_ttl
            key = f"session:user:{user_id}:assessment"
            
            await self.redis.setex(key, ttl, assessment_id)
            logger.debug(f"Stored session for user {user_id}: {assessment_id} (TTL: {ttl}s)")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to store user session: {e}")
            return False
    
    async def get_user_session(self, user_id: str) -> Optional[str]:
        """
        Get user's active assessment ID.
        
        Args:
            user_id: User identifier
            
        Returns:
            Assessment ID if found, None otherwise
        """
        try:
            key = f"session:user:{user_id}:assessment"
            assessment_id = await self.redis.get(key)
            
            if assessment_id:
                logger.debug(f"Retrieved session for user {user_id}: {assessment_id}")
            
            return assessment_id
            
        except RedisError as e:
            logger.error(f"Failed to get user session: {e}")
            return None
    
    async def extend_user_session(self, user_id: str, ttl: Optional[int] = None) -> bool:
        """
        Extend user session TTL (keep-alive).
        
        Args:
            user_id: User identifier
            ttl: New TTL in seconds
            
        Returns:
            True if successful
        """
        try:
            ttl = ttl or self.session_ttl
            key = f"session:user:{user_id}:assessment"
            
            result = await self.redis.expire(key, ttl)
            if result:
                logger.debug(f"Extended session for user {user_id} by {ttl}s")
            
            return bool(result)
            
        except RedisError as e:
            logger.error(f"Failed to extend user session: {e}")
            return False
    
    async def clear_user_session(self, user_id: str) -> bool:
        """Clear user's session."""
        try:
            key = f"session:user:{user_id}:assessment"
            await self.redis.delete(key)
            logger.debug(f"Cleared session for user {user_id}")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to clear user session: {e}")
            return False
    
    # ==================== WEBSOCKET REGISTRY ====================
    
    async def register_websocket(
        self, 
        assessment_id: str, 
        connection_id: str,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Register a WebSocket connection for an assessment.
        
        Args:
            assessment_id: Assessment identifier
            connection_id: Unique connection identifier
            user_id: Optional user identifier for tracking
            
        Returns:
            True if successful
        """
        try:
            key = f"ws:assessment:{assessment_id}:connections"
            
            # Store connection with metadata
            connection_data = {
                "connection_id": connection_id,
                "user_id": user_id or "anonymous",
                "connected_at": datetime.utcnow().isoformat()
            }
            
            await self.redis.sadd(key, json.dumps(connection_data))
            await self.redis.expire(key, 7200)  # 2 hour max
            
            logger.info(f"Registered WebSocket {connection_id} for assessment {assessment_id}")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to register WebSocket: {e}")
            return False
    
    async def unregister_websocket(
        self, 
        assessment_id: str, 
        connection_id: str
    ) -> bool:
        """Unregister a WebSocket connection."""
        try:
            key = f"ws:assessment:{assessment_id}:connections"
            
            # Find and remove the connection
            members = await self.redis.smembers(key)
            for member in members:
                data = json.loads(member)
                if data["connection_id"] == connection_id:
                    await self.redis.srem(key, member)
                    logger.info(f"Unregistered WebSocket {connection_id} from assessment {assessment_id}")
                    break
            
            return True
            
        except RedisError as e:
            logger.error(f"Failed to unregister WebSocket: {e}")
            return False
    
    async def get_assessment_connections(self, assessment_id: str) -> List[Dict[str, Any]]:
        """Get all active WebSocket connections for an assessment."""
        try:
            key = f"ws:assessment:{assessment_id}:connections"
            members = await self.redis.smembers(key)
            
            connections = []
            for member in members:
                try:
                    data = json.loads(member)
                    connections.append(data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid connection data in registry: {member}")
            
            return connections
            
        except RedisError as e:
            logger.error(f"Failed to get assessment connections: {e}")
            return []
    
    async def get_connection_count(self, assessment_id: str) -> int:
        """Get number of active connections for an assessment."""
        try:
            key = f"ws:assessment:{assessment_id}:connections"
            count = await self.redis.scard(key)
            return count
            
        except RedisError as e:
            logger.error(f"Failed to get connection count: {e}")
            return 0
    
    # ==================== MESSAGE DEDUPLICATION ====================
    
    async def is_duplicate_message(self, message_key: str) -> bool:
        """
        Check if a message has been processed recently.
        
        Args:
            message_key: Unique message identifier
            
        Returns:
            True if duplicate, False if new
        """
        try:
            key = f"dedup:message:{message_key}"
            
            # SETNX: Set if Not eXists (atomic operation)
            is_new = await self.redis.set(
                key, 
                "1", 
                ex=self.message_dedup_ttl,
                nx=True  # Only set if doesn't exist
            )
            
            if not is_new:
                logger.debug(f"Duplicate message detected: {message_key}")
            
            return not is_new
            
        except RedisError as e:
            logger.error(f"Failed to check message duplication: {e}")
            # On error, assume not duplicate to avoid losing messages
            return False
    
    async def mark_message_processed(
        self, 
        message_key: str,
        ttl: Optional[int] = None
    ) -> bool:
        """Explicitly mark a message as processed."""
        try:
            ttl = ttl or self.message_dedup_ttl
            key = f"dedup:message:{message_key}"
            
            await self.redis.setex(key, ttl, "1")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to mark message as processed: {e}")
            return False
    
    # ==================== PHASE 2: STAMPEDE PROTECTION ====================
    
    async def acquire_cache_lock(
        self, 
        resource_key: str,
        timeout: Optional[int] = None
    ) -> Optional[str]:
        """
        Acquire a distributed lock for cache population.
        
        This prevents cache stampede by ensuring only ONE request fetches from DB
        while others wait for the result.
        
        Args:
            resource_key: Key to lock (e.g., assessment_id)
            timeout: Lock timeout in seconds
            
        Returns:
            Lock token if acquired, None if lock already held
        """
        try:
            timeout = timeout or self.lock_timeout
            lock_key = f"lock:cache:{resource_key}"
            lock_token = str(uuid.uuid4())
            
            # SET with NX (not exists) and EX (expiration)
            acquired = await self.redis.set(
                lock_key,
                lock_token,
                ex=timeout,
                nx=True
            )
            
            if acquired:
                logger.debug(f"🔒 Acquired cache lock for {resource_key}")
                return lock_token
            else:
                logger.debug(f"⏳ Cache lock already held for {resource_key}")
                return None
                
        except RedisError as e:
            logger.error(f"Failed to acquire cache lock: {e}")
            return None
        
    
    async def release_cache_lock(
        self, 
        resource_key: str, 
        lock_token: str
    ) -> bool:
        """
        Release a distributed lock.
        
        Args:
            resource_key: Key that was locked
            lock_token: Token returned by acquire_cache_lock
            
        Returns:
            True if released successfully
        """
        try:
            lock_key = f"lock:cache:{resource_key}"
            
            # Lua script for atomic check-and-delete
            # Only delete if the token matches (prevents releasing someone else's lock)
            lua_script = """
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
            """
            
            result = await self.redis.eval(lua_script, 1, lock_key, lock_token)
            
            if result:
                logger.debug(f"🔓 Released cache lock for {resource_key}")
                return True
            else:
                logger.warning(f"⚠️ Lock token mismatch for {resource_key}")
                return False
                
        except RedisError as e:
            logger.error(f"Failed to release cache lock: {e}")
            return False
    
    async def wait_for_cache_lock(
        self, 
        resource_key: str,
        max_wait_seconds: Optional[float] = None
    ) -> bool:
        """
        Wait for a cache lock to be released.
        
        This is used by requests that didn't get the lock - they wait for
        the lock holder to populate the cache, then read from cache.
        
        Args:
            resource_key: Key being locked
            max_wait_seconds: Maximum time to wait
            
        Returns:
            True if lock was released, False if timeout
        """
        try:
            lock_key = f"lock:cache:{resource_key}"
            max_wait = max_wait_seconds or (self.lock_timeout - 1)
            
            start_time = asyncio.get_event_loop().time()
            retry_delay = self.lock_retry_delay / 1000.0  # Convert to seconds
            
            while True:
                # Check if lock still exists
                exists = await self.redis.exists(lock_key)
                
                if not exists:
                    logger.debug(f"✅ Cache lock released for {resource_key}")
                    return True
                
                # Check timeout
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= max_wait:
                    logger.warning(f"⏱️ Timeout waiting for cache lock: {resource_key}")
                    return False
                
                # Wait before retry
                await asyncio.sleep(retry_delay)
                
        except RedisError as e:
            logger.error(f"Error waiting for cache lock: {e}")
            return False
    
    async def is_cache_lock_held(self, resource_key: str) -> bool:
        """Check if a cache lock is currently held."""
        try:
            lock_key = f"lock:cache:{resource_key}"
            exists = await self.redis.exists(lock_key)
            return bool(exists)
            
        except RedisError as e:
            logger.error(f"Failed to check cache lock: {e}")
            return False
    
    # ==================== END PHASE 2: STAMPEDE PROTECTION ====================
    
    # ==================== ASSESSMENT CACHING ====================
    
    async def cache_assessment(
        self, 
        assessment_id: str, 
        assessment_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """
        Cache assessment data.
        
        Args:
            assessment_id: Assessment identifier
            assessment_data: Assessment data to cache
            ttl: Cache TTL in seconds
            
        Returns:
            True if successful
        """
        try:
            ttl = ttl or self.cache_ttl
            key = f"cache:assessment:{assessment_id}"
            
            # Include updated_at for staleness checks
            cache_entry = {
                "data": assessment_data,
                "cached_at": datetime.utcnow().isoformat()
            }
            
            await self.redis.setex(key, ttl, json.dumps(cache_entry))
            logger.debug(f"Cached assessment {assessment_id} (TTL: {ttl}s)")
            return True
            
        except (RedisError, TypeError) as e:
            logger.error(f"Failed to cache assessment: {e}")
            return False
    
    async def get_cached_assessment(
        self, 
        assessment_id: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached assessment data."""
        try:
            key = f"cache:assessment:{assessment_id}"
            cached = await self.redis.get(key)
            
            if cached:
                cache_entry = json.loads(cached)
                logger.debug(f"Cache hit for assessment {assessment_id}")
                return cache_entry.get("data")
            
            logger.debug(f"Cache miss for assessment {assessment_id}")
            return None
            
        except (RedisError, json.JSONDecodeError) as e:
            logger.error(f"Failed to get cached assessment: {e}")
            return None
    
    async def invalidate_assessment_cache(self, assessment_id: str) -> bool:
        """Invalidate cached assessment data."""
        try:
            key = f"cache:assessment:{assessment_id}"
            await self.redis.delete(key)
            logger.debug(f"Invalidated cache for assessment {assessment_id}")
            return True
            
        except RedisError as e:
            logger.error(f"Failed to invalidate cache: {e}")
            return False
    
    # ==================== QUEUED MESSAGES (for reconnection) ====================
    
    async def queue_message_for_assessment(
        self,
        assessment_id: str,
        message: Dict[str, Any],
        max_queue_size: int = 100
    ) -> bool:
        """
        Queue a message for an assessment (for delivery on reconnect).
        
        Args:
            assessment_id: Assessment identifier
            message: Message to queue
            max_queue_size: Maximum queue size
            
        Returns:
            True if successful
        """
        try:
            key = f"queue:assessment:{assessment_id}:messages"
            
            # Add timestamp
            message["queued_at"] = datetime.utcnow().isoformat()
            
            # Add to list (FIFO)
            await self.redis.lpush(key, json.dumps(message))
            
            # Trim to max size
            await self.redis.ltrim(key, 0, max_queue_size - 1)
            
            # Set expiration (messages older than 1 hour are dropped)
            await self.redis.expire(key, 3600)
            
            logger.debug(f"Queued message for assessment {assessment_id}")
            return True
            
        except (RedisError, TypeError) as e:
            logger.error(f"Failed to queue message: {e}")
            return False
    
    async def get_queued_messages(
        self,
        assessment_id: str,
        clear_after_read: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Get all queued messages for an assessment.
        
        Args:
            assessment_id: Assessment identifier
            clear_after_read: Whether to clear queue after reading
            
        Returns:
            List of queued messages
        """
        try:
            key = f"queue:assessment:{assessment_id}:messages"
            
            # Get all messages
            raw_messages = await self.redis.lrange(key, 0, -1)
            
            messages = []
            for raw_msg in reversed(raw_messages):  # Reverse to get FIFO order
                try:
                    messages.append(json.loads(raw_msg))
                except json.JSONDecodeError:
                    logger.warning(f"Invalid queued message: {raw_msg}")
            
            # Clear queue if requested
            if clear_after_read and messages:
                await self.redis.delete(key)
                logger.debug(f"Cleared {len(messages)} queued messages for assessment {assessment_id}")
            
            return messages
            
        except RedisError as e:
            logger.error(f"Failed to get queued messages: {e}")
            return []
    
    # ==================== STATISTICS ====================
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis service statistics."""
        try:
            info = await self.redis.info()
            
            return {
                "connected": self.connected,
                "redis_version": info.get("redis_version"),
                "used_memory_human": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "uptime_in_seconds": info.get("uptime_in_seconds"),
                "total_commands_processed": info.get("total_commands_processed"),
                "keyspace": info.get("db0", {}),
            }
            
        except RedisError as e:
            logger.error(f"Failed to get Redis stats: {e}")
            return {"connected": False, "error": str(e)}


# Singleton instance
_redis_service: Optional[RedisService] = None


def get_redis_service() -> RedisService:
    """Get or create Redis service singleton."""
    global _redis_service
    if _redis_service is None:
        _redis_service = RedisService()
    return _redis_service


async def init_redis_service() -> RedisService:
    """Initialize and connect Redis service."""
    service = get_redis_service()
    await service.connect()
    return service
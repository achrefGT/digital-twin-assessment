"""
Redis Service: Caching + Pub/Sub for distributed WebSocket messaging.

This service provides:
- Assessment state caching with stampede protection
- Redis Pub/Sub for cross-instance WebSocket broadcasts
- Single-instance optimizations (bypasses Pub/Sub when not needed)
- Graceful startup/shutdown

"""

import asyncio
from collections import defaultdict
import json
import logging
import zlib
import base64
from datetime import datetime
from typing import Optional, Dict, Any, Callable, List
from redis.asyncio import Redis, from_url
from redis.asyncio.client import PubSub
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError
import backoff
import uuid

from .config import settings

logger = logging.getLogger(__name__)


class RedisService:
    """Redis service for caching and distributed Pub/Sub messaging."""
    
    def __init__(self, redis_url: Optional[str] = None):
        """Initialize Redis service."""
        self.redis_url = redis_url or getattr(
            settings, 
            'redis_url', 
            'redis://localhost:6379/0'
        )
        self.redis: Optional[Redis] = None
        self.pubsub: Optional[PubSub] = None
        self.connected = False
        
        # Configuration
        self.cache_ttl = getattr(settings, 'cache_ttl_seconds', 300)
        self.lock_timeout = getattr(settings, 'cache_lock_timeout_seconds', 10)
        self.lock_retry_delay = getattr(settings, 'cache_lock_retry_delay_ms', 50)
        self.lock_max_retries = getattr(settings, 'cache_lock_max_retries', 100)
        
        # Pub/Sub configuration
        self.enable_pubsub = getattr(settings, 'enable_redis_pubsub', True)
        self.pubsub_message_queue_size = getattr(settings, 'pubsub_message_queue_size', 1000)
        self.compression_threshold = 1024  # Compress messages > 1KB
        
        # Message handlers - using list for multiple handlers per channel
        self._message_handlers: Dict[str, List[Callable]] = defaultdict(list)
        
        # Subscription tracking
        self._pubsub_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        
        # Statistics
        self._publish_count = 0
        self._publish_failures = 0
        self._messages_received = 0
        
        logger.info(f"RedisService initialized with URL: {self.redis_url}")
        logger.info(f"Pub/Sub enabled: {self.enable_pubsub}")
    
    @backoff.on_exception(
        backoff.expo,
        (RedisConnectionError, ConnectionError),
        max_tries=5,
        max_time=30
    )
    async def connect(self):
        """Connect to Redis with automatic retry and connection pooling."""
        try:
            self.redis = from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30,
                max_connections=50,  # FIX: Add connection pool
                retry_on_timeout=True
            )
            
            # Test connection
            await self.redis.ping()
            self.connected = True
            logger.info("✅ Redis connection established")
            
            # Initialize Pub/Sub if enabled
            if self.enable_pubsub:
                await self._init_pubsub()
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.connected = False
            raise
    
    async def _init_pubsub(self):
        """Initialize Pub/Sub and start listening."""
        try:
            self.pubsub = self.redis.pubsub()
            logger.info("Redis Pub/Sub initialized")
            
            # Start background listener task
            self._pubsub_task = asyncio.create_task(self._pubsub_listener())
            logger.info("Pub/Sub listener task started")
            
        except Exception as e:
            logger.error(f"Failed to initialize Pub/Sub: {e}")
            self.enable_pubsub = False
    
    async def disconnect(self):
        """Close Redis connection gracefully."""
        logger.info("Disconnecting Redis service...")
        
        # Signal shutdown
        self._shutdown_event.set()
        
        # Stop Pub/Sub listener
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await asyncio.wait_for(self._pubsub_task, timeout=5.0)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                logger.warning("Pub/Sub listener cancellation timed out")
            logger.info("Pub/Sub listener stopped")
        
        # Unsubscribe from all channels
        if self.pubsub:
            try:
                await self.pubsub.unsubscribe()
                await self.pubsub.close()
                logger.info("Pub/Sub connections closed")
            except Exception as e:
                logger.warning(f"Error closing Pub/Sub: {e}")
        
        # Close main connection
        if self.redis:
            try:
                await self.redis.close()
                await self.redis.connection_pool.disconnect()
                self.connected = False
                logger.info("✅ Redis connection closed")
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
    
    # ==================== CACHE MANAGEMENT ====================
    
    async def cache_assessment(
        self, 
        assessment_id: str, 
        assessment_data: Dict[str, Any],
        ttl: Optional[int] = None
    ) -> bool:
        """Cache assessment data."""
        try:
            ttl = ttl or self.cache_ttl
            key = f"cache:assessment:{assessment_id}"
            
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
    
    # ==================== DISTRIBUTED LOCKING (CACHE STAMPEDE PROTECTION) ====================
    
    async def acquire_cache_lock(
        self, 
        resource_key: str,
        timeout: Optional[int] = None
    ) -> Optional[str]:
        """Acquire a distributed lock for cache population."""
        try:
            timeout = timeout or self.lock_timeout
            lock_key = f"lock:cache:{resource_key}"
            lock_token = str(uuid.uuid4())
            
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
        """Release a distributed lock."""
        try:
            lock_key = f"lock:cache:{resource_key}"
            
            # Lua script ensures atomic check-and-delete
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
        """Wait for a cache lock to be released."""
        try:
            lock_key = f"lock:cache:{resource_key}"
            max_wait = max_wait_seconds or (self.lock_timeout - 1)
            
            start_time = asyncio.get_event_loop().time()
            retry_delay = self.lock_retry_delay / 1000.0
            
            while True:
                exists = await self.redis.exists(lock_key)
                
                if not exists:
                    logger.debug(f"✅ Cache lock released for {resource_key}")
                    return True
                
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= max_wait:
                    logger.warning(f"⏱️ Timeout waiting for cache lock: {resource_key}")
                    return False
                
                await asyncio.sleep(retry_delay)
                
        except RedisError as e:
            logger.error(f"Error waiting for cache lock: {e}")
            return False
    
    # ==================== PUB/SUB FOR DISTRIBUTED WEBSOCKET MESSAGING ====================
    
    def _get_assessment_channel(self, assessment_id: str) -> str:
        """Get Redis channel name for an assessment."""
        return f"ws:assessment:{assessment_id}"
    
    def _compress_message(self, message_json: str) -> Dict[str, Any]:
        """Compress message if it exceeds threshold."""
        if len(message_json) > self.compression_threshold:
            compressed = zlib.compress(message_json.encode())
            encoded = base64.b64encode(compressed).decode()
            
            logger.debug(
                f"Compressed message: {len(message_json)} -> {len(encoded)} bytes "
                f"({100 * len(encoded) / len(message_json):.1f}%)"
            )
            
            return {
                "compressed": True,
                "data": encoded
            }
        else:
            return json.loads(message_json)
    
    def _decompress_message(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Decompress message if it was compressed."""
        if data.get('compressed'):
            decoded = base64.b64decode(data['data'])
            decompressed = zlib.decompress(decoded)
            return json.loads(decompressed)
        return data
    
    async def subscribe_to_assessment(
        self,
        assessment_id: str,
        callback: Callable
    ) -> bool:
        """
        Subscribe to messages for a specific assessment.
        
        Args:
            assessment_id: Assessment to subscribe to
            callback: Async callback(message_dict) to handle messages
            
        Returns:
            True if subscription successful
        """
        if not self.enable_pubsub or not self.pubsub:
            logger.warning("Pub/Sub not enabled or not initialized")
            return False
        
        try:
            channel = self._get_assessment_channel(assessment_id)
            
            # Add callback to handlers list
            self._message_handlers[channel].append(callback)
            
            # Subscribe to Redis channel
            await self.pubsub.subscribe(channel)
            
            logger.info(f"📡 Subscribed to assessment channel: {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to subscribe to assessment {assessment_id}: {e}")
            return False
    
    async def unsubscribe_from_assessment(self, assessment_id: str) -> bool:
        """Unsubscribe from an assessment channel."""
        if not self.enable_pubsub or not self.pubsub:
            return False
        
        try:
            channel = self._get_assessment_channel(assessment_id)
            
            # Remove all handlers for this channel
            if channel in self._message_handlers:
                del self._message_handlers[channel]
            
            # Unsubscribe from Redis
            await self.pubsub.unsubscribe(channel)
            
            logger.info(f"🔕 Unsubscribed from assessment channel: {channel}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to unsubscribe from assessment {assessment_id}: {e}")
            return False
    
    async def publish_to_assessment(
        self,
        assessment_id: str,
        message: Dict[str, Any],
        retries: int = 3
    ) -> bool:
        """
        Publish a message to an assessment channel with retry logic.
        All API Gateway instances subscribed to this assessment will receive it.
        
        Args:
            assessment_id: Assessment to publish to
            message: Message dictionary to broadcast
            retries: Number of retry attempts on failure
            
        Returns:
            True if publish successful
        """
        if not self.enable_pubsub:
            # Single-instance mode: no Pub/Sub needed
            logger.debug("Pub/Sub disabled, message not published to Redis")
            return True
        
        if not self.redis:
            logger.warning("Redis not initialized")
            self._publish_failures += 1
            return False
        
        # Add retry logic
        for attempt in range(retries):
            try:
                channel = self._get_assessment_channel(assessment_id)
                
                # Add timestamp and source metadata
                message_with_meta = {
                    **message,
                    "redis_published_at": datetime.utcnow().isoformat(),
                    "gateway_instance": getattr(settings, 'gateway_instance_id', 'unknown'),
                    "attempt": attempt + 1
                }
                
                # Serialize and optionally compress
                message_json = json.dumps(message_with_meta)
                payload = self._compress_message(message_json)
                
                # Publish to Redis
                num_subscribers = await self.redis.publish(
                    channel,
                    json.dumps(payload)
                )
                
                self._publish_count += 1
                
                logger.debug(
                    f"📤 Published to {channel}: {num_subscribers} subscribers, "
                    f"attempt {attempt + 1}/{retries}"
                )
                
                return True
                
            except RedisError as e:
                logger.error(
                    f"Publish failed (attempt {attempt + 1}/{retries}): {e}"
                )
                
                if attempt < retries - 1:
                    # Exponential backoff
                    await asyncio.sleep(0.1 * (2 ** attempt))
                else:
                    # Final attempt failed
                    self._publish_failures += 1
                    logger.error(
                        f"❌ Failed to publish to {assessment_id} after {retries} attempts"
                    )
                    return False
        
        return False
    
    async def _pubsub_listener(self):
        """Background task that listens for Pub/Sub messages."""
        if not self.pubsub:
            return
        
        logger.info("🎧 Pub/Sub listener started")
        
        try:
            while not self._shutdown_event.is_set():
                try:
                    # Only try to get messages if we have active subscriptions
                    if not self._message_handlers:
                        await asyncio.sleep(1)
                        continue
                    
                    # Get message with timeout
                    message = await asyncio.wait_for(
                        self.pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0),
                        timeout=2.0
                    )
                    
                    if not message:
                        continue
                    
                    # Log subscription confirmations
                    if message['type'] == 'subscribe':
                        logger.info(f"✅ Subscription confirmed: {message['channel']}")
                    elif message['type'] == 'unsubscribe':
                        logger.info(f"📕 Unsubscription confirmed: {message['channel']}")
                    elif message['type'] == 'message':
                        self._messages_received += 1
                        await self._handle_pubsub_message(message)
                    
                except asyncio.TimeoutError:
                    continue
                except RuntimeError as e:
                    # Handle "pubsub connection not set" gracefully
                    if "pubsub connection not set" in str(e):
                        logger.debug("Waiting for channel subscriptions...")
                        await asyncio.sleep(1)
                    else:
                        logger.error(f"Runtime error in Pub/Sub message loop: {e}")
                        await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error in Pub/Sub message loop: {e}")
                    await asyncio.sleep(1)
                    
        except asyncio.CancelledError:
            logger.info("Pub/Sub listener cancelled")
        except Exception as e:
            logger.error(f"Fatal error in Pub/Sub listener: {e}", exc_info=True)
        finally:
            logger.info("Pub/Sub listener stopped")
    
    async def _handle_pubsub_message(self, message: Dict[str, Any]):
        """Handle an incoming Pub/Sub message."""
        try:
            channel = message['channel']
            
            # Parse and decompress if needed
            raw_data = json.loads(message['data'])
            data = self._decompress_message(raw_data)
            
            # Call ALL registered handlers for this channel
            if channel in self._message_handlers:
                handlers = self._message_handlers[channel].copy()  # Avoid mutation during iteration
                
                for handler in handlers:
                    try:
                        await handler(data)
                    except Exception as e:
                        logger.error(f"Handler error for channel {channel}: {e}")
                        # Don't remove handler - let connection manager handle it
            else:
                logger.debug(f"No handlers registered for channel: {channel}")
                
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Pub/Sub message: {e}")
        except Exception as e:
            logger.error(f"Error handling Pub/Sub message: {e}", exc_info=True)
    
    async def get_pubsub_stats(self) -> Dict[str, Any]:
        """Get Pub/Sub statistics."""
        return {
            "pubsub_enabled": self.enable_pubsub,
            "active_channels": len(self._message_handlers),
            "subscribed_channels": list(self._message_handlers.keys()),
            "total_handlers": sum(len(handlers) for handlers in self._message_handlers.values()),
            "listener_running": self._pubsub_task is not None and not self._pubsub_task.done(),
            "publish_count": self._publish_count,
            "publish_failures": self._publish_failures,
            "messages_received": self._messages_received
        }
    
    # ==================== STATISTICS ====================
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get Redis service statistics."""
        try:
            info = await self.redis.info() if self.redis else {}
            
            return {
                "connected": self.connected,
                "redis_version": info.get("redis_version"),
                "used_memory_human": info.get("used_memory_human"),
                "connected_clients": info.get("connected_clients"),
                "uptime_in_seconds": info.get("uptime_in_seconds"),
                "total_commands_processed": info.get("total_commands_processed"),
                "pubsub": await self.get_pubsub_stats() if self.enable_pubsub else None
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
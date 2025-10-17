"""
Redis Base Service: Core Redis infrastructure (Foundation)

Classes are organized by concern:
1. RedisConnection - Connection management
2. DistributedLock - Stampede protection
3. PubSubMessaging - Cross-instance messaging
4. CompressionUtil - Data compression (DRY)
5. RedisBaseService - Orchestrates above components
"""

import asyncio
from abc import ABC, abstractmethod
from collections import defaultdict
import json
import logging
import zlib
import base64
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Callable, List, Protocol
from dataclasses import dataclass
from enum import Enum

from redis.asyncio import Redis, from_url
from redis.asyncio.client import PubSub
from redis.exceptions import RedisError, ConnectionError as RedisConnectionError
import backoff
import uuid

from ..config import settings

logger = logging.getLogger(__name__)


# ============================================================================
# ABSTRACTIONS (Interface Segregation Principle)
# ============================================================================

class CacheConfig(Protocol):
    """Protocol for cache configuration - allows dependency inversion."""
    ttl_seconds: int
    compression_threshold: int
    lock_timeout: int


class RedisConnectionStrategy(ABC):
    """Abstract strategy for Redis connection - allows different implementations."""
    
    @abstractmethod
    async def connect(self) -> Redis:
        """Establish Redis connection."""
        pass
    
    @abstractmethod
    async def disconnect(self, redis: Redis) -> None:
        """Close Redis connection."""
        pass


# ============================================================================
# ENUMS & DATA CLASSES (Single Responsibility)
# ============================================================================

class LockStatus(Enum):
    """Lock acquisition status."""
    ACQUIRED = "acquired"
    WAITING = "waiting"
    TIMEOUT = "timeout"
    ERROR = "error"


@dataclass
class CompressionResult:
    """Result of compression operation."""
    compressed: bool
    data: str
    original_size: int
    compressed_size: int
    ratio: float
    
    def __post_init__(self):
        """Validate compression result."""
        if self.compressed and self.ratio > 1.0:
            logger.debug(f"Warning: Compression increased size (ratio: {self.ratio:.2f})")


@dataclass
class LockAcquisitionResult:
    """Result of lock acquisition attempt."""
    status: LockStatus
    token: Optional[str]
    waited_ms: float
    

# ============================================================================
# COMPRESSION UTILITY (DRY Principle)
# ============================================================================

class CompressionUtil:
    """Handles compression/decompression - reusable across cache services."""
    
    def __init__(self, threshold: int = 1024):
        """
        Initialize compression utility.
        
        Args:
            threshold: Compress if data exceeds this size (bytes)
        """
        self.threshold = threshold
    
    def compress(self, data: str) -> CompressionResult:
        """
        Compress string data if it exceeds threshold.
        
        Args:
            data: String to compress
            
        Returns:
            CompressionResult with compression details
        """
        original_size = len(data)
        
        if original_size <= self.threshold:
            return CompressionResult(
                compressed=False,
                data=data,
                original_size=original_size,
                compressed_size=original_size,
                ratio=1.0
            )
        
        try:
            compressed = zlib.compress(data.encode())
            encoded = base64.b64encode(compressed).decode()
            
            ratio = len(encoded) / original_size
            
            return CompressionResult(
                compressed=True,
                data=encoded,
                original_size=original_size,
                compressed_size=len(encoded),
                ratio=ratio
            )
        except Exception as e:
            logger.error(f"Compression failed: {e}, returning uncompressed")
            return CompressionResult(
                compressed=False,
                data=data,
                original_size=original_size,
                compressed_size=original_size,
                ratio=1.0
            )
    
    def decompress(self, data: str) -> str:
        """
        Decompress string data.
        
        Args:
            data: Compressed (base64) string
            
        Returns:
            Decompressed original string
        """
        try:
            decoded = base64.b64decode(data)
            decompressed = zlib.decompress(decoded)
            return decompressed.decode()
        except Exception as e:
            logger.error(f"Decompression failed: {e}")
            raise ValueError(f"Failed to decompress data: {e}")


# ============================================================================
# REDIS CONNECTION (Single Responsibility)
# ============================================================================

class DefaultRedisConnection(RedisConnectionStrategy):
    """Default Redis connection strategy with pooling."""
    
    def __init__(self, redis_url: str):
        self.redis_url = redis_url
    
    @backoff.on_exception(
        backoff.expo,
        (RedisConnectionError, ConnectionError),
        max_tries=5,
        max_time=30
    )
    async def connect(self) -> Redis:
        """Connect to Redis with retry logic."""
        try:
            redis = from_url(
                self.redis_url,
                encoding="utf-8",
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True,
                health_check_interval=30,
                max_connections=50,
                retry_on_timeout=True
            )
            
            # Test connection
            await redis.ping()
            logger.info("✓ Redis connection established")
            return redis
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def disconnect(self, redis: Redis) -> None:
        """Close Redis connection gracefully."""
        try:
            await redis.close()
            await redis.connection_pool.disconnect()
            logger.info("✓ Redis connection closed")
        except Exception as e:
            logger.error(f"Error closing Redis: {e}")


# ============================================================================
# DISTRIBUTED LOCKING (Single Responsibility)
# ============================================================================

class DistributedLock:
    """Distributed lock for cache stampede protection."""
    
    def __init__(
        self,
        redis: Redis,
        lock_timeout: int = 10,
        retry_delay_ms: int = 50,
        max_retries: int = 100
    ):
        """
        Initialize distributed lock.
        
        Args:
            redis: Redis client
            lock_timeout: Max time lock can be held (seconds)
            retry_delay_ms: Delay between lock checks (milliseconds)
            max_retries: Max retry attempts
        """
        self.redis = redis
        self.lock_timeout = lock_timeout
        self.retry_delay_ms = retry_delay_ms
        self.max_retries = max_retries
    
    async def acquire(self, resource_key: str) -> LockAcquisitionResult:
        """
        Acquire a lock for a resource.
        
        Args:
            resource_key: Resource to lock
            
        Returns:
            LockAcquisitionResult with token if acquired
        """
        try:
            lock_key = f"lock:{resource_key}"
            lock_token = str(uuid.uuid4())
            
            acquired = await self.redis.set(
                lock_key,
                lock_token,
                ex=self.lock_timeout,
                nx=True
            )
            
            if acquired:
                logger.debug(f"🔒 Acquired lock for {resource_key}")
                return LockAcquisitionResult(
                    status=LockStatus.ACQUIRED,
                    token=lock_token,
                    waited_ms=0.0
                )
            else:
                logger.debug(f"⏳ Lock already held for {resource_key}")
                return LockAcquisitionResult(
                    status=LockStatus.WAITING,
                    token=None,
                    waited_ms=0.0
                )
                
        except RedisError as e:
            logger.error(f"Failed to acquire lock: {e}")
            return LockAcquisitionResult(
                status=LockStatus.ERROR,
                token=None,
                waited_ms=0.0
            )
    
    async def release(self, resource_key: str, lock_token: str) -> bool:
        """
        Release a lock (atomic check-and-delete).
        
        Args:
            resource_key: Resource to unlock
            lock_token: Token from acquire()
            
        Returns:
            True if released, False if token mismatch
        """
        try:
            lock_key = f"lock:{resource_key}"
            
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
                logger.debug(f"🔓 Released lock for {resource_key}")
                return True
            else:
                logger.warning(f"⚠️ Lock token mismatch for {resource_key}")
                return False
                
        except RedisError as e:
            logger.error(f"Failed to release lock: {e}")
            return False
    
    async def wait_for_release(
        self,
        resource_key: str,
        max_wait_seconds: Optional[float] = None
    ) -> bool:
        """
        Wait for a lock to be released.
        
        Args:
            resource_key: Resource to wait for
            max_wait_seconds: Maximum wait time
            
        Returns:
            True if lock released, False if timeout
        """
        try:
            lock_key = f"lock:{resource_key}"
            max_wait = max_wait_seconds or (self.lock_timeout - 1)
            
            start_time = asyncio.get_event_loop().time()
            retry_delay = self.retry_delay_ms / 1000.0
            
            while True:
                exists = await self.redis.exists(lock_key)
                
                if not exists:
                    elapsed_ms = (asyncio.get_event_loop().time() - start_time) * 1000
                    logger.debug(f"✓ Lock released for {resource_key} (waited {elapsed_ms:.0f}ms)")
                    return True
                
                elapsed = asyncio.get_event_loop().time() - start_time
                if elapsed >= max_wait:
                    logger.warning(f"⏱️ Lock timeout: {resource_key} (waited {elapsed:.1f}s)")
                    return False
                
                await asyncio.sleep(retry_delay)
                
        except RedisError as e:
            logger.error(f"Error waiting for lock: {e}")
            return False


# ============================================================================
# PUB/SUB MESSAGING (Single Responsibility)
# ============================================================================

class PubSubMessaging:
    """Redis Pub/Sub for distributed WebSocket messaging."""
    
    def __init__(self, redis: Redis, compression_util: CompressionUtil):
        """
        Initialize Pub/Sub messaging.
        
        Args:
            redis: Redis client
            compression_util: Compression utility instance
        """
        self.redis = redis
        self.compression_util = compression_util
        self.pubsub: Optional[PubSub] = None
        self._message_handlers: Dict[str, List[Callable]] = defaultdict(list)
        self._pubsub_task: Optional[asyncio.Task] = None
        self._shutdown_event = asyncio.Event()
        self._publish_count = 0
        self._publish_failures = 0
    
    async def initialize(self) -> bool:
        """Initialize Pub/Sub."""
        try:
            self.pubsub = self.redis.pubsub()
            self._pubsub_task = asyncio.create_task(self._listen())
            logger.info("Redis Pub/Sub initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Pub/Sub: {e}")
            return False
    
    async def shutdown(self) -> None:
        """Shutdown Pub/Sub gracefully."""
        self._shutdown_event.set()
        
        if self._pubsub_task:
            self._pubsub_task.cancel()
            try:
                await asyncio.wait_for(self._pubsub_task, timeout=5.0)
            except asyncio.CancelledError:
                pass
        
        if self.pubsub:
            try:
                await self.pubsub.unsubscribe()
                await self.pubsub.close()
                logger.info("Pub/Sub shutdown complete")
            except Exception as e:
                logger.warning(f"Error during Pub/Sub shutdown: {e}")
    
    async def subscribe(self, channel: str, callback: Callable) -> bool:
        """Subscribe to a channel with callback."""
        try:
            self._message_handlers[channel].append(callback)
            await self.pubsub.subscribe(channel)
            logger.info(f"📢 Subscribed to {channel}")
            return True
        except Exception as e:
            logger.error(f"Failed to subscribe: {e}")
            return False
    
    async def publish(self, channel: str, message: Dict[str, Any]) -> bool:
        """Publish message to channel with compression."""
        try:
            message_json = json.dumps(message)
            compression = self.compression_util.compress(message_json)
            
            payload = {
                "compressed": compression.compressed,
                "data": compression.data
            } if compression.compressed else message
            
            await self.redis.publish(channel, json.dumps(payload))
            self._publish_count += 1
            return True
            
        except Exception as e:
            logger.error(f"Publish failed: {e}")
            self._publish_failures += 1
            return False
    
    async def _listen(self) -> None:
            """Background listener for Pub/Sub messages."""
            logger.info("🎧 Pub/Sub listener started")
            try:
                while not self._shutdown_event.is_set():
                    try:
                        # Only try to get messages if we have active subscriptions
                        if not self._message_handlers:
                            await asyncio.sleep(1)
                            continue
                        
                        message = await asyncio.wait_for(
                            self.pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0),
                            timeout=2.0
                        )
                        
                        if message:
                            if message['type'] in ('subscribe', 'unsubscribe'):
                                logger.info(f"✅ Subscription event: {message['type']} - {message.get('channel', 'unknown')}")
                            elif message['type'] == 'message':
                                await self._handle_message(message)
                            
                    except asyncio.TimeoutError:
                        continue
                    except RuntimeError as e:
                        # Handle "pubsub connection not set" gracefully
                        if "pubsub connection not set" in str(e):
                            logger.debug("Waiting for channel subscriptions...")
                            await asyncio.sleep(1)
                        else:
                            logger.error(f"Runtime error in listener: {e}")
                            await asyncio.sleep(1)
                    except Exception as e:
                        logger.error(f"Listener error: {e}")
                        await asyncio.sleep(1)
                        
            except asyncio.CancelledError:
                logger.info("Pub/Sub listener cancelled")
            finally:
                logger.info("Pub/Sub listener stopped")
    
    async def _handle_message(self, message: Dict[str, Any]) -> None:
        """Handle received Pub/Sub message."""
        try:
            channel = message['channel']
            payload = json.loads(message['data'])
            
            # Decompress if needed
            if isinstance(payload, dict) and payload.get('compressed'):
                data = self.compression_util.decompress(payload['data'])
                message_data = json.loads(data)
            else:
                message_data = payload
            
            # Call handlers
            if channel in self._message_handlers:
                for handler in self._message_handlers[channel]:
                    try:
                        await handler(message_data)
                    except Exception as e:
                        logger.error(f"Handler error: {e}")
                        
        except Exception as e:
            logger.error(f"Message handling error: {e}")


# ============================================================================
# REDIS BASE SERVICE (Orchestrator - Facade Pattern)
# ============================================================================

class RedisBaseService:
    """
    Core Redis service orchestrating connection, locking, and Pub/Sub.
    
    Uses Facade pattern to provide simplified interface to complex subsystems.
    Extendable for specialized cache implementations.
    """
    
    def __init__(
        self,
        redis_url: Optional[str] = None,
        connection_strategy: Optional[RedisConnectionStrategy] = None,
        compression_threshold: int = 1024
    ):
        """Initialize Redis base service."""
        self.redis_url = redis_url or getattr(
            settings, 'redis_url', 'redis://localhost:6379/0'
        )
        
        self.connection_strategy = connection_strategy or DefaultRedisConnection(
            self.redis_url
        )
        
        self.redis: Optional[Redis] = None
        self.connected = False
        
        # ADD THIS LINE:
        self.enable_pubsub = getattr(settings, 'enable_redis_pubsub', True)
        
        # Initialize components
        self.compression = CompressionUtil(compression_threshold)
        self.lock: Optional[DistributedLock] = None
        self.pubsub: Optional[PubSubMessaging] = None
        
        self._stats = {
            "connections": 0,
            "disconnections": 0,
            "errors": 0
        }
    
    async def connect(self) -> bool:
        """Connect to Redis."""
        try:
            self.redis = await self.connection_strategy.connect()
            self.connected = True
            
            # Initialize components
            self.lock = DistributedLock(
                self.redis,
                lock_timeout=getattr(settings, 'cache_lock_timeout_seconds', 10),
                retry_delay_ms=getattr(settings, 'cache_lock_retry_delay_ms', 50),
                max_retries=getattr(settings, 'cache_lock_max_retries', 100)
            )
            
            if getattr(settings, 'enable_redis_pubsub', True):
                self.pubsub = PubSubMessaging(self.redis, self.compression)
                await self.pubsub.initialize()
            
            self._stats["connections"] += 1
            return True
            
        except Exception as e:
            logger.error(f"Connection failed: {e}")
            self.connected = False
            self._stats["errors"] += 1
            return False
    
    async def disconnect(self) -> bool:
        """Disconnect from Redis."""
        try:
            if self.pubsub:
                await self.pubsub.shutdown()
            
            if self.redis:
                await self.connection_strategy.disconnect(self.redis)
            
            self.connected = False
            self._stats["disconnections"] += 1
            return True
            
        except Exception as e:
            logger.error(f"Disconnection error: {e}")
            self._stats["errors"] += 1
            return False
    
    async def health_check(self) -> bool:
        """Check Redis health."""
        try:
            if not self.redis:
                return False
            await self.redis.ping()
            return True
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
            
    
    def get_stats(self) -> Dict[str, Any]:
        """Get service statistics."""
        return {
            **self._stats,
            "connected": self.connected,
            "compression_threshold": self.compression.threshold
        }


# Singleton instance
_redis_base_service: Optional[RedisBaseService] = None


def get_redis_base_service(
    redis_url: Optional[str] = None,
    connection_strategy: Optional[RedisConnectionStrategy] = None
) -> RedisBaseService:
    """Get or create Redis base service singleton."""
    global _redis_base_service
    
    if _redis_base_service is None:
        _redis_base_service = RedisBaseService(
            redis_url=redis_url,
            connection_strategy=connection_strategy
        )
    
    return _redis_base_service


async def init_redis_base_service() -> RedisBaseService:
    """Initialize Redis base service."""
    service = get_redis_base_service()
    await service.connect()
    return service
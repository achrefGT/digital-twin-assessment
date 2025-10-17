"""
Outbox Relayer: Background worker that publishes outbox events to Kafka.

This component reads from the outbox_events table and publishes to Kafka,
ensuring at-least-once delivery with idempotent retries.
"""

import asyncio
import logging
from datetime import datetime
from typing import Optional

from ..database.database_manager import DatabaseManager
from shared.kafka_utils import create_kafka_producer
from ..config import settings

logger = logging.getLogger(__name__)


class OutboxRelayer:
    """
    Background worker that reliably publishes outbox events to Kafka.
    
    Features:
    - Polling-based (simple, reliable)
    - Batch processing for efficiency
    - Automatic retry with exponential backoff
    - Graceful shutdown
    """
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.producer = None
        self.running = False
        self._shutdown_event = asyncio.Event()
        
        # Configuration
        self.poll_interval_seconds = getattr(settings, 'outbox_poll_interval', 1.0)
        self.batch_size = getattr(settings, 'outbox_batch_size', 100)
        self.max_retries = 5
        
    async def start(self):
        """Start the outbox relayer."""
        logger.info("Starting Outbox Relayer...")
        
        # Create Kafka producer
        self.producer = await create_kafka_producer()
        logger.info("Outbox Relayer: Kafka producer created")
        
        self.running = True
        
        # Start main processing loop
        asyncio.create_task(self._process_loop())
        logger.info("Outbox Relayer started")
    
    async def stop(self):
        """Stop the outbox relayer gracefully."""
        logger.info("Stopping Outbox Relayer...")
        self.running = False
        self._shutdown_event.set()
        
        if self.producer:
            await self.producer.stop()
            logger.info("Outbox Relayer: Kafka producer stopped")
        
        logger.info("âœ… Outbox Relayer stopped")
    
    async def _process_loop(self):
        """Main processing loop."""
        logger.info("Outbox Relayer: Starting processing loop")
        
        while self.running and not self._shutdown_event.is_set():
            try:
                # Process pending events
                await self._process_pending_events()
                
                # Process failed events (retry with backoff)
                await self._process_failed_events()
                
                # Wait before next poll
                try:
                    await asyncio.wait_for(
                        self._shutdown_event.wait(),
                        timeout=self.poll_interval_seconds
                    )
                    break  # Shutdown requested
                except asyncio.TimeoutError:
                    continue  # Normal timeout, continue polling
                    
            except Exception as e:
                logger.error(f"Error in outbox processing loop: {e}", exc_info=True)
                await asyncio.sleep(5)  # Back off on errors
    
    async def _process_pending_events(self):
        """Process pending outbox events."""
        try:
            # Fetch batch of pending events
            events = self.db_manager.get_pending_outbox_events(self.batch_size)
            
            if not events:
                return
            
            logger.info(f"Processing {len(events)} pending outbox events")
            
            # Publish each event
            for event in events:
                try:
                    await self._publish_event(event)
                    self.db_manager.mark_outbox_event_published(event.id)
                    logger.debug(f"Published outbox event {event.id} to {event.kafka_topic}")
                    
                except Exception as e:
                    logger.error(f"Failed to publish outbox event {event.id}: {e}")
                    self.db_manager.mark_outbox_event_failed(event.id, str(e))
                    
        except Exception as e:
            logger.error(f"Error processing pending events: {e}")
    
    async def _process_failed_events(self):
        """Process failed events that are ready for retry."""
        try:
            # Fetch failed events ready for retry
            events = self.db_manager.get_failed_outbox_events_for_retry(
                batch_size=self.batch_size // 2  # Process fewer retries
            )
            
            if not events:
                return
            
            logger.info(f"Retrying {len(events)} failed outbox events")
            
            # Retry each event
            for event in events:
                if event.retry_count >= self.max_retries:
                    logger.error(
                        f"Outbox event {event.id} exceeded max retries ({self.max_retries}). "
                        f"Manual intervention required."
                    )
                    continue
                
                try:
                    await self._publish_event(event)
                    self.db_manager.mark_outbox_event_published(event.id)
                    logger.info(
                        f"Successfully retried outbox event {event.id} "
                        f"(attempt {event.retry_count + 1})"
                    )
                    
                except Exception as e:
                    logger.error(
                        f"Retry failed for outbox event {event.id} "
                        f"(attempt {event.retry_count + 1}): {e}"
                    )
                    self.db_manager.mark_outbox_event_failed(event.id, str(e))
                    
        except Exception as e:
            logger.error(f"Error processing failed events: {e}")
    
    async def _publish_event(self, event):
        """Publish a single outbox event to Kafka."""
        if not self.producer:
            raise Exception("Kafka producer not initialized")
        
        # Publish to Kafka
        await self.producer.send(
            topic=event.kafka_topic,
            value=event.event_payload,
            key=event.kafka_key.encode('utf-8') if event.kafka_key else None
        )
        
        # Flush to ensure delivery
        await self.producer.flush()
    
    async def get_statistics(self):
        """Get outbox statistics for monitoring."""
        return self.db_manager.get_outbox_statistics()
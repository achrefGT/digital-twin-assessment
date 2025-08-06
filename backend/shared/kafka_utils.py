import os
import logging
import json
from typing import Optional
from aiokafka import AIOKafkaProducer, AIOKafkaConsumer

logger = logging.getLogger(__name__)

class KafkaConfig:
    """Shared Kafka configuration"""
    BOOTSTRAP_SERVERS       = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
    RETRY_BACKOFF           = int(os.getenv("KAFKA_RETRY_BACKOFF", "1000"))
    REQUEST_TIMEOUT         = int(os.getenv("KAFKA_REQUEST_TIMEOUT", "30000"))

    # Submission Topics (Services consume from these)
    RESILIENCE_SUBMISSION_TOPIC         = os.getenv("RESILIENCE_RESULTS_TOPIC", "resilience-submissions")
    ELCA_SUBMISSION_TOPIC               = os.getenv("ELCA_SUBMISSION_TOPIC", "elca-submissions")
    LCC_SUBMISSION_TOPIC                = os.getenv("LCC_SUBMISSION_TOPIC", "lcc-submissions")
    SLCA_SUBMISSION_TOPIC               = os.getenv("SLCA_SUBMISSION_TOPIC", "slca-submissions")
    HUMAN_CENTRICITY_SUBMISSION_TOPIC   = os.getenv("HUMAN_CENTRICITY_SUBMISSION_TOPIC", "human-centricity-submissions")

    # Score Topics (Services produce to these)
    RESILIENCE_SCORES_TOPIC             = os.getenv("RESILIENCE_SCORES_TOPIC", "resilience-scores")
    ELCA_SCORES_TOPIC                   = os.getenv("ELCA_SCORES_TOPIC", "elca-scores")
    LCC_SCORES_TOPIC                    = os.getenv("LCC_SCORES_TOPIC", "lcc-scores")
    SLCA_SCORES_TOPIC                   = os.getenv("SLCA_SCORES_TOPIC", "slca-scores")
    HUMAN_CENTRICITY_SCORES_TOPIC       = os.getenv("HUMAN_CENTRICITY_SCORES_TOPIC", "human-centricity-scores")
    FINAL_RESULT_TOPIC                  = os.getenv("FINAL_RESULT_TOPIC", "final-assessment-results")

    ERROR_EVENTS_TOPIC                  = os.getenv("ERROR_EVENTS_TOPIC", "error-events-topic")
    ASSESSEMENT_STATUS_TOPIC            = os.getenv("ASSESSEMENT_STATUS_TOPIC", "assessment-status")
    



async def create_kafka_producer() -> AIOKafkaProducer:
    """Create standardized Kafka producer"""
    producer = AIOKafkaProducer(
        bootstrap_servers=KafkaConfig.BOOTSTRAP_SERVERS,
        retry_backoff_ms=KafkaConfig.RETRY_BACKOFF,
        request_timeout_ms=KafkaConfig.REQUEST_TIMEOUT,
        compression_type="gzip",
        acks='all',
        enable_idempotence=True,
        value_serializer=lambda x: json.dumps(x, default=str).encode('utf-8')
    )
    await producer.start()
    return producer

async def create_kafka_consumer(topics: list, group_id: str, auto_offset_reset: str = 'latest') -> AIOKafkaConsumer:
    """Create standardized Kafka consumer"""
    consumer = AIOKafkaConsumer(
        *topics,
        bootstrap_servers=KafkaConfig.BOOTSTRAP_SERVERS,
        group_id=group_id,
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        auto_offset_reset=auto_offset_reset,
    )
    await consumer.start()
    return consumer

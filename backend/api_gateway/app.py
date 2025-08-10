import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
import json
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import DatabaseManager
from .kafka_service import KafkaService
from .routers import assessments, health, websockets
from .exceptions import create_http_exception
from shared.models.exceptions import DigitalTwinAssessmentException
from .dependencies import get_db_manager, get_kafka_service
from .websocket_service import connection_manager
from .weighting_service import WeightingService



# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with WebSocket support"""
    # Startup
    logger.info("Starting API Gateway with real-time capabilities...")
    
    try:
        # Get instances
        db_manager = get_db_manager()
        kafka_service = get_kafka_service()
        
        # Create database tables
        db_manager.create_tables()
        logger.info("Database tables initialized")

        # Initialize weighting service
        weighting_service = WeightingService()
        app.state.weighting_service = weighting_service
        
        # Start Kafka service
        await kafka_service.start()
        logger.info("Kafka service started")
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_service.consume_score_updates())
        logger.info("Kafka consumer started")

        # Initialize WebSocket connection manager
        app.state.connection_manager = connection_manager
        
        logger.info("API Gateway started successfully with real-time features")
        
        # Store task for cleanup
        app.state.consumer_task = consumer_task
        
        yield
        
    except Exception as e:
        logger.error(f"Failed to start API Gateway: {e}")
        raise
    
    finally:
        # Shutdown
        logger.info("Shutting down API Gateway...")
        try:
            # Cancel consumer task with timeout
            if hasattr(app.state, 'consumer_task'):
                app.state.consumer_task.cancel()
                try:
                    await asyncio.wait_for(app.state.consumer_task, timeout=5.0)
                except (asyncio.CancelledError, asyncio.TimeoutError):
                    logger.warning("Consumer task cancelled/timed out during shutdown")
            
            # Close WebSocket connections gracefully
            if hasattr(app.state, 'connection_manager'):
                await close_websocket_connections(app.state.connection_manager)
            
            # Stop Kafka service
            kafka_service = get_kafka_service()
            await kafka_service.stop()
            
            logger.info("API Gateway shutdown complete")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")

async def close_websocket_connections(connection_manager):
    """Gracefully close all WebSocket connections"""
    if not hasattr(connection_manager, 'active_connections'):
        return
        
    connections = list(connection_manager.active_connections)
    if not connections:
        return
        
    logger.info(f"Closing {len(connections)} WebSocket connections...")
    
    # Send shutdown message to all connections
    shutdown_message = {
        "type": "shutdown",
        "message": "Server is shutting down",
        "timestamp": datetime.utcnow().isoformat()
    }
    
    close_tasks = []
    for connection in connections:
        close_tasks.append(close_single_connection(connection, shutdown_message))
    
    # Wait for all connections to close with timeout
    try:
        await asyncio.wait_for(asyncio.gather(*close_tasks, return_exceptions=True), timeout=10.0)
    except asyncio.TimeoutError:
        logger.warning("Some WebSocket connections did not close gracefully")

async def close_single_connection(websocket, shutdown_message):
    """Close a single WebSocket connection gracefully"""
    try:
        # Try to send shutdown message
        await websocket.send_text(json.dumps(shutdown_message))
        await asyncio.sleep(0.1)  # Give client time to process
        await websocket.close()
    except Exception as e:
        logger.debug(f"Error closing WebSocket connection: {e}")
        # Force close if graceful close fails
        try:
            await websocket.close()
        except:
            pass


# Create FastAPI app
app = FastAPI(
    title="Digital Twin Assessment API Gateway",
    description="API Gateway for digital twin assessment system",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=settings.cors_allow_credentials,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count", "X-Process-Time"]
)


# Global exception handler
@app.exception_handler(DigitalTwinAssessmentException)
async def api_gateway_exception_handler(request: Request, exc: DigitalTwinAssessmentException):
    """Handle custom API Gateway exceptions"""
    http_exc = create_http_exception(exc)
    return JSONResponse(
        status_code=http_exc.status_code,
        content={"detail": http_exc.detail, "type": type(exc).__name__}
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle unexpected exceptions"""
    logger.error(f"Unexpected error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "type": "InternalError"}
    )


# Middleware for request logging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests"""
    start_time = datetime.utcnow()
    
    # Process request
    response = await call_next(request)
    
    # Log request details
    process_time = (datetime.utcnow() - start_time).total_seconds()
    logger.info(
        f"{request.method} {request.url} - "
        f"{response.status_code} - {process_time:.3f}s"
    )
    
    # Add process time header
    response.headers["X-Process-Time"] = str(process_time)
    return response


# Include routers
app.include_router(assessments.router)
app.include_router(health.router)
app.include_router(websockets.router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "api-gateway",
        "version": "0.1.0",
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "health": "/health",
            "readiness": "/ready",
            "liveness": "/live",
            "assessments": "/assessments",
            "docs": "/docs"
        }
    }
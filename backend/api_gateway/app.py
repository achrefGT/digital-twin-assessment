import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import DatabaseManager
from .kafka_service import KafkaService
from .routers import assessments, health
from .exceptions import create_http_exception
from shared.models.exceptions import DigitalTwinAssessmentException
from .dependencies import get_db_manager, get_kafka_service



# Setup logging
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with proper error handling"""
    # Startup
    logger.info("Starting API Gateway...")
    
    try:
        # Get instances
        db_manager = get_db_manager()
        kafka_service = get_kafka_service()
        
        # Create database tables
        db_manager.create_tables()
        logger.info("Database tables initialized")
        
        # Start Kafka service
        await kafka_service.start()
        logger.info("Kafka service started")
        
        # Start consumer in background
        consumer_task = asyncio.create_task(kafka_service.consume_score_updates())
        logger.info("Kafka consumer started")
        
        logger.info("API Gateway started successfully")
        
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
            # Cancel consumer task
            if hasattr(app.state, 'consumer_task'):
                app.state.consumer_task.cancel()
                try:
                    await app.state.consumer_task
                except asyncio.CancelledError:
                    pass
            
            # Stop Kafka service
            kafka_service = get_kafka_service()
            await kafka_service.stop()
            
            logger.info("API Gateway shutdown complete")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")


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
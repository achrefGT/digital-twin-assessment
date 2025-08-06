#!/usr/bin/env python3
"""
human-centricity Service Entry Point
"""

import sys
import os
import uvicorn
import multiprocessing

# Add the app root to Python path for shared imports
sys.path.insert(0, '/app')

# Import settings using absolute import - MOVED TO TOP LEVEL
from services.human_centricity.config import settings


def main():
    """Main entry point for the resilience service"""
    # Calculate workers based on CPU count in production
    workers = settings.api_workers
    if workers > 1:
        workers = min(workers, multiprocessing.cpu_count())
    
    # Use reload only in development (single worker)
    reload = workers == 1 and os.getenv("ENVIRONMENT", "development") == "development"
    
    # Use STRING REFERENCE - this avoids import issues entirely
    uvicorn.run(
        "services.human_centricity.app:app",  # String reference instead of importing app directly
        host=settings.api_host,
        port=settings.api_port,
        workers=workers,
        log_level=settings.log_level.lower(),
        access_log=True,
        reload=reload
    )


if __name__ == "__main__":
    main()
"""Entry point for the API gateway"""

import uvicorn
import multiprocessing
import os
import sys
from pathlib import Path

# Add the parent directory to Python path to enable imports
current_dir = Path(__file__).parent
sys.path.insert(0, str(current_dir.parent))  # Add /app to path

from api_gateway.config import settings


def main():
    """Main entry point"""
    # Calculate workers based on CPU count in production
    workers = settings.api_workers
    if workers > 1:
        workers = min(workers, multiprocessing.cpu_count())
    
    # Use reload only in development (single worker)
    reload = workers == 1 and os.getenv("ENVIRONMENT", "development") == "development"
    
    uvicorn.run(
        "api_gateway.app:app",
        host=settings.api_host,
        port=settings.api_port,
        workers=workers,
        log_level=settings.log_level.lower(),
        access_log=True,
        reload=reload
    )


if __name__ == "__main__":
    main()
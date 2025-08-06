FROM python:3.13-slim AS production

# System deps (curl for healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Poetry environment
ENV POETRY_VERSION=2.1.3 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

# Install Poetry
RUN curl -sSL https://install.python-poetry.org \
    | python3 - --version $POETRY_VERSION && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /app

# Install production dependencies
COPY backend/services/human_centricity/pyproject.toml \
     backend/services/human_centricity/poetry.lock*  /app/
RUN poetry install --no-root --only=main && \
    poetry cache clear --all pypi && \
    rm -rf /var/lib/apt/lists/*

# Copy application code and shared utilities (preserve folder structure)
COPY backend/services/human_centricity/   /app/services/human_centricity/
COPY backend/shared/                /app/shared/

# Expose port
EXPOSE 8002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8002/health || exit 1

# Run the application with proper module path
CMD ["python", "-m", "services.human_centricity.main"]
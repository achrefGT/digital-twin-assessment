FROM python:3.13-slim

# Install all dependencies (build + runtime)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        python3-dev \
        gfortran \
        pkg-config \
        libopenblas-dev \
        liblapack-dev && \
    rm -rf /var/lib/apt/lists/*

# Poetry setup
ENV POETRY_VERSION=2.1.3 \
    POETRY_HOME="/opt/poetry" \
    POETRY_NO_INTERACTION=1 \
    POETRY_VIRTUALENVS_CREATE=false

RUN curl -sSL https://install.python-poetry.org | python3 - --version $POETRY_VERSION && \
    ln -s /opt/poetry/bin/poetry /usr/local/bin/poetry

WORKDIR /app

# Install dependencies
COPY backend/services/elca/pyproject.toml \
     backend/services/elca/poetry.lock* /app/
RUN poetry install --no-root --only=main

# Copy code
COPY backend/services/elca/ /app/services/elca/
COPY backend/shared/ /app/shared/

# Runtime setup
RUN mkdir -p /tmp/brightway2_data
ENV BRIGHTWAY2_DIR=/tmp/brightway2_data

EXPOSE 8005

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8005/health || exit 1

CMD ["python", "-m", "services.elca.main"]
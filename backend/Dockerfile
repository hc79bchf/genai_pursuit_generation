# Dockerfile for Railway deployment
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc libpq-dev build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt

# Final stage
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1
ENV PYTHONPATH=/app

# Install runtime dependencies (libpq for postgres)
RUN apt-get update && \
    apt-get install -y --no-install-recommends libpq-dev curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy installed python dependencies from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Create directories for data persistence
RUN mkdir -p /app/chroma_data /app/uploads

# Create a non-root user
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Railway uses PORT env variable
ENV PORT=8000
EXPOSE 8000

# Use entrypoint script
CMD ["./entrypoint.sh"]

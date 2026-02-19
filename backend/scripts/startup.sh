#!/bin/bash

echo "============================================"
echo "Starting Kyradi Backend..."
echo "============================================"
echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"
echo "PORT: ${PORT:-8000}"

# Skip Alembic migrations - tables will be created by SQLAlchemy
# Run 'alembic upgrade head' manually via Railway CLI if needed
echo "Skipping Alembic migrations (run manually if needed)"
echo "Starting uvicorn server..."

exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

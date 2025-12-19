#!/bin/bash
set -e

echo "Starting Kyradi Backend..."
echo "DATABASE_URL is set: ${DATABASE_URL:+yes}"

# Run migrations with timeout (max 60 seconds)
echo "Running database migrations..."
timeout 60 alembic upgrade head || {
    echo "WARNING: Migrations timed out or failed. Continuing with app startup..."
    echo "You may need to run migrations manually."
}

echo "Starting uvicorn server..."
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

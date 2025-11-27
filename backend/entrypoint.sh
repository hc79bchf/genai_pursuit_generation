#!/bin/bash
set -e

# Run database seed if SEED_DB is set
if [ "$SEED_DB" = "true" ]; then
    echo "Seeding database..."
    python seed_db.py
    echo "Database seeded successfully!"
fi

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}

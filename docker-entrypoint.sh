#!/bin/sh
set -e

echo "🚀 Starting AI News application..."

# Note: Database is mounted from host via volume
# Migrations should be run on host before starting container
# Or run manually: docker-compose exec ai-news npx prisma migrate deploy

if [ ! -f "prisma/dev.db" ]; then
  echo "⚠️  Warning: Database not found at prisma/dev.db"
  echo "📝 Please ensure database exists and migrations are applied"
  echo "   Run: npx prisma migrate dev && npx prisma db seed (on host)"
  echo "   Or: docker-compose exec ai-news npx prisma db push (in container)"
fi

echo "✨ Starting Next.js server..."
exec "$@"

#!/bin/sh
set -e

echo "🚀 Starting AI News application..."

# Check if database exists
if [ ! -f "prisma/dev.db" ]; then
  echo "📦 Database not found. Running migrations..."
  npm run db:migrate
  
  echo "🌱 Seeding database..."
  npm run db:seed
else
  echo "✅ Database exists. Running migrations to ensure schema is up-to-date..."
  npm run db:migrate
fi

echo "✨ Starting Next.js server..."
exec "$@"

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
else
  # Fix database file permissions if needed (for mounted volumes from host)
  echo "🔧 Checking database file permissions..."
  
  # Check if running as root (UID 0)
  if [ "$(id -u)" = "0" ]; then
    # Running as root - can fix permissions
    echo "🔧 Fixing database permissions for nextjs user..."
    chown -R nextjs:nodejs /app/prisma 2>/dev/null || chown -R 1001:1001 /app/prisma
    chmod 666 prisma/dev.db 2>/dev/null || true
    echo "✅ Database permissions fixed"
  else
    # Not running as root - just check if writable
    if [ ! -w "prisma/dev.db" ]; then
      echo "⚠️  Database file is not writable by current user"
      echo "   This may cause errors when crawling or creating articles"
      echo "   To fix: rebuild with 'docker-compose up -d --build'"
    else
      echo "✅ Database is writable"
    fi
  fi
fi

# If running as root, switch to nextjs user before starting app
if [ "$(id -u)" = "0" ]; then
  echo "🔄 Switching to nextjs user..."
  echo "✨ Starting Next.js server as nextjs user..."
  exec gosu nextjs "$@"
else
  echo "✨ Starting Next.js server..."
  exec "$@"
fi

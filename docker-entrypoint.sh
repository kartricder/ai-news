#!/bin/sh
set -e

echo "🚀 Starting AI News application..."

# Note: Database is mounted from host via volume
# Migrations should be run on host before starting container
# Or run manually: docker-compose exec ai-news npx prisma migrate deploy

DATABASE_FILE="$(node --import tsx -e "const { resolveSqliteUrl } = require('./src/lib/databaseUrl.ts'); process.stdout.write(resolveSqliteUrl(process.env.DATABASE_URL, process.cwd()).slice(5));")"
DATABASE_DIRECTORY="$(dirname "$DATABASE_FILE")"

if [ ! -f "$DATABASE_FILE" ]; then
  echo "⚠️  Warning: configured database file not found"
  echo "📝 Please ensure database exists and migrations are applied"
  echo "   Verify migration/seed on a disposable DB first; migrate deploy requires operator approval."
else
  # Fix database file permissions if needed (for mounted volumes from host)
  echo "🔧 Checking database file permissions..."
  
  # Check if running as root (UID 0)
  if [ "$(id -u)" = "0" ]; then
    # Running as root - can fix permissions
    echo "🔧 Fixing database permissions for nextjs user..."
    chown nextjs:nodejs "$DATABASE_FILE"
    case "$DATABASE_DIRECTORY" in
      /app/prisma|/app/prisma/*) chown nextjs:nodejs "$DATABASE_DIRECTORY" ;;
      *) echo "Custom database directory permissions are managed by the operator." ;;
    esac
    chmod u+rw "$DATABASE_FILE"
    echo "✅ Database permissions fixed"
  else
    # Not running as root - just check if writable
    if [ ! -w "$DATABASE_FILE" ]; then
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

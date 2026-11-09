# ==================================
# Stage 1: Dependencies
# ==================================
FROM node:24-bookworm-slim AS deps
WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update -y && \
    apt-get install -y openssl && \
    rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

RUN npm ci && npm cache clean --force

# ==================================
# Stage 2: Builder
# ==================================
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Set DATABASE_URL for Prisma generation (will be overridden at runtime)
ENV DATABASE_URL="file:/tmp/ai-news-build.db" \
    AI_PROCESSING_ENABLED=false \
    AI_AUTO_PUBLISH_ENABLED=false \
    PENDING_PROCESSING_ENABLED=false

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Rebuild native dependencies for Linux
RUN npm rebuild better-sqlite3

# Khởi tạo database SQLite tạm thời để Next.js prerender không bị lỗi thiếu bảng
RUN npx prisma migrate deploy

# Build Next.js application
RUN npm run build

# ==================================
# Stage 3: Runner (Production)
# ==================================
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# Install OpenSSL for Prisma and gosu for user switching
RUN apt-get update -y && \
    apt-get install -y openssl gosu && \
    rm -rf /var/lib/apt/lists/*

# Set production environment
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL="file:./prisma/dev.db"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for database and logs
RUN mkdir -p /app/prisma /app/logs && \
    chown -R nextjs:nodejs /app

# Start as root to allow entrypoint to fix mounted volume permissions
# Entrypoint will switch to nextjs user after fixing permissions
# USER nextjs
# Note: Running as root for entrypoint, will switch to nextjs in entrypoint script

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/articles?status=published&pageSize=1', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Set entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Start application
CMD ["npm", "run", "start"]

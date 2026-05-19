# ==================================
# Stage 1: Dependencies
# ==================================
FROM node:24-bookworm-slim AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Install dev dependencies (needed for build)
RUN npm ci && \
    npm cache clean --force

# ==================================
# Stage 2: Builder
# ==================================
FROM node:24-bookworm-slim AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Rebuild native dependencies for Linux
RUN npm rebuild better-sqlite3

# Build Next.js application
RUN npm run build

# ==================================
# Stage 3: Runner (Production)
# ==================================
FROM node:24-bookworm-slim AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production \
    PORT=3000

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

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Create directory for database and logs
RUN mkdir -p /app/prisma /app/logs && \
    chown -R nextjs:nodejs /app

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/articles?status=published&pageSize=1', (r) => { process.exit(r.statusCode === 200 ? 0 : 1); })"

# Set entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Start application
CMD ["npm", "run", "start"]

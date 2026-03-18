# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S taskpulse -u 1001

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=builder --chown=taskpulse:nodejs /app/dist ./dist
COPY --from=builder --chown=taskpulse:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=taskpulse:nodejs /app/package.json ./

# Create logs directory
RUN mkdir -p logs && chown taskpulse:nodejs logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER taskpulse

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/healthcheck.js

# Expose port
EXPOSE 3000

# Start the application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/app.js"]

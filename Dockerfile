# Builder stage - Use Bun for building
FROM oven/bun:latest AS builder

WORKDIR /app

# Copy source code
COPY . .

# Install all dependencies (including dev dependencies for building)
RUN bun install --frozen-lockfile

# Build the application (frontend to build/, server to dist/)
RUN bun run build

# Production stage - Use Node Alpine for runtime
FROM node:22-alpine AS production

# Install curl for health checks
RUN apk add --no-cache curl

WORKDIR /app

# Copy package.json for production dependencies
# COPY package.json ./

# # Install only production dependencies with npm
# RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/dist ./dist

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S rabbitmq -u 1001 -G nodejs

# Change ownership of the app directory
RUN chown -R rabbitmq:nodejs /app
USER rabbitmq

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Set default environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672/

# Start the compiled application
CMD ["node", "dist/hono.js"] 

# docker build . -t huakunshen/rabbitmq-firehose-monitor

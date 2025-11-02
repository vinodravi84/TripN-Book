# Stage 1 — install deps (use Debian slim base for compatibility)
FROM node:22-slim AS deps
WORKDIR /app

# Reduce image size: copy only package files first for caching
COPY package*.json ./
# If you have package-lock.json or pnpm-lock.yaml, ensure it is copied as well
RUN npm ci --production --silent

# Stage 2 — build (copy source)
FROM node:22-slim AS runner
WORKDIR /app

# Create non-root user
RUN useradd --user-group --create-home --shell /bin/bash appuser

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy app source
COPY . .

# Set permissions for non-root user
RUN chown -R appuser:appuser /app

# Healthcheck utilities
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

USER appuser
ENV NODE_ENV=production
# Typical backend port (adjust if your app uses a different one)
EXPOSE 5000

# Recommended to set a small health-check endpoint in your app (e.g. GET /health)


# Start the app. If you normally run `node server.js`, keep that; else adjust.
CMD ["node", "server.js"]

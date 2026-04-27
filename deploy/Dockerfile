# Zambdas local API for Cloud Run (Ottehr backend dev/local parity).
# Build from repository root: docker build -f deploy/Dockerfile -t ottehr-zambdas .
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app
COPY . .

RUN npm ci && chmod +x deploy/docker-entrypoint.sh

EXPOSE 8080

ENTRYPOINT ["./deploy/docker-entrypoint.sh"]

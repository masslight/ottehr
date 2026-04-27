# Zambdas local API for Cloud Run (Ottehr backend dev/local parity).
# Build from repository root: docker build -f deploy/Dockerfile -t ottehr-zambdas .
FROM node:22-bookworm-slim

WORKDIR /app
COPY . .

# Do not set NODE_ENV=production before npm ci — it omits devDependencies (tsx, husky, …)
# while prepare still runs and fails on husky. Skip git hooks in the image.
ENV HUSKY=0
RUN npm ci && chmod +x deploy/docker-entrypoint.sh

ENV NODE_ENV=production

EXPOSE 8080

ENTRYPOINT ["./deploy/docker-entrypoint.sh"]

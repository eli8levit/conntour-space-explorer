# syntax=docker/dockerfile:1

# Build stage: Node only compiles the static bundle.
FROM node:22-slim AS builder

WORKDIR /app

# Copy package files first so the npm ci layer stays cached when only source changes.
COPY package*.json ./
RUN npm ci

COPY . .

# Type-checks, then writes the static site to /app/dist.
RUN npm run build

# Production stage: nginx serves dist and proxies /api to the backend.
FROM nginx:alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html
# nginx runs as an unprivileged user: every file must be world-readable, whatever mode it had in git.
RUN chmod -R a+rX /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Empty by default; production mounts the origin guard here (see docker-compose.prod.yml).
RUN mkdir -p /etc/nginx/guard

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

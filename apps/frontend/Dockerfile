# Frontend image: build the Vite app, serve it with nginx (which also reverse-
# proxies /api and /ws to the backend, so the SPA uses relative URLs).
#
# Build context MUST be the repo root (pnpm workspace):
#   docker build -f apps/frontend/Dockerfile -t k2u-frontend .

# ---------- Builder ----------
FROM node:20-alpine AS builder
WORKDIR /workspace
RUN corepack enable
COPY . .
RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @k2u/frontend run build

# ---------- Runner ----------
FROM nginx:alpine AS runner
# Default backend for docker-compose; override per-app in Coolify (BACKEND_UPSTREAM).
ENV BACKEND_UPSTREAM=http://backend:3000
# nginx image auto-runs envsubst on /etc/nginx/templates/*.template at start.
COPY apps/frontend/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]

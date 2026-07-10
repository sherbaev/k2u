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
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /workspace/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null || exit 1
CMD ["nginx", "-g", "daemon off;"]

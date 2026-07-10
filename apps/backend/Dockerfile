# apps/backend/Dockerfile
#
# NOTE ON MONOREPO BUILD CONTEXT:
# This is a pnpm workspace monorepo (see /pnpm-workspace.yaml). The backend
# depends on workspace packages @k2u/shared-contracts and @k2u/core, so the
# Docker build context MUST be the repo root, not apps/backend/, e.g.:
#
#   docker build -f apps/backend/Dockerfile -t k2u-backend .
#
# This Dockerfile keeps things simple: it installs the full workspace and
# lets pnpm resolve @k2u/shared-contracts / @k2u/core as local workspace
# deps, then builds only the backend app. If you need a fully optimized,
# pruned monorepo image (smaller layers, selective workspace install), the
# operator may prefer a `pnpm deploy` / `turbo prune`-based build from the
# repo root instead of this straightforward version.

# ---------- Builder ----------
FROM node:20-alpine AS builder

WORKDIR /workspace

# Enable pnpm via corepack (pinned in root package.json: packageManager pnpm@9.0.0).
RUN corepack enable

# Copy the whole monorepo build context (repo root) so workspace packages
# (@k2u/shared-contracts, @k2u/core) are resolvable.
COPY . .

# No committed lockfile yet — resolve at build time. Commit a pnpm-lock.yaml
# later and switch back to --frozen-lockfile for reproducible builds.
RUN pnpm install --no-frozen-lockfile

# Build the backend app (NestJS: nest build -> apps/backend/dist).
RUN pnpm --filter @k2u/backend run build

# Trim dev dependencies out of node_modules for the runtime stage.
RUN pnpm --filter @k2u/backend deploy --prod /workspace/out

# ---------- Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Production node_modules + package.json produced by `pnpm deploy` above.
COPY --from=builder /workspace/out/node_modules ./node_modules
COPY --from=builder /workspace/out/package.json ./package.json

# Compiled backend output.
COPY --from=builder /workspace/apps/backend/dist ./dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/main.js"]

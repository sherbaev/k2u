#!/usr/bin/env bash
#
# Deploy the K2U platform to a self-hosted Coolify instance via its API.
#
# PREREQUISITES
#   1. Push this repo to a Git host Coolify can clone (GitHub/GitLab/Gitea).
#      Coolify builds from source — it cannot deploy an unpushed local repo.
#   2. Coolify v4 running and reachable, with an API token.
#   3. `curl` and `jq` installed locally.
#
# USAGE
#   export COOLIFY_URL="http://178.105.41.164:8000"     # your Coolify base URL
#   export COOLIFY_TOKEN="xxxxx"                          # API token (NOT stored in the repo)
#   export GIT_REPO="https://github.com/<you>/k2u-platform"
#   export GIT_BRANCH="main"                              # optional (default: main)
#   ./infra/coolify/deploy.sh
#
# The script is idempotent-ish: it verifies auth, picks the first server, creates
# a project, registers a Docker-Compose application pointing at your repo, and
# triggers a deploy. Endpoint names follow the Coolify v4 API; if your Coolify
# version differs, adjust the paths flagged with [API].
set -euo pipefail

: "${COOLIFY_URL:?set COOLIFY_URL (e.g. http://178.105.41.164:8000)}"
: "${COOLIFY_TOKEN:?set COOLIFY_TOKEN (do not hardcode it)}"
: "${GIT_REPO:?set GIT_REPO (the pushed repository URL)}"
GIT_BRANCH="${GIT_BRANCH:-main}"
API="${COOLIFY_URL%/}/api/v1"
AUTH=(-H "Authorization: Bearer ${COOLIFY_TOKEN}" -H "Content-Type: application/json")

command -v jq >/dev/null || { echo "jq is required"; exit 1; }

say() { printf "\n\033[1;34m▶ %s\033[0m\n" "$*"; }

say "1/5  Verify API auth"
curl -fsS "${AUTH[@]}" "${API}/version" | jq . \
  || { echo "Auth/connectivity failed — check COOLIFY_URL and COOLIFY_TOKEN"; exit 1; }

say "2/5  Find a server (uuid)"
SERVER_UUID=$(curl -fsS "${AUTH[@]}" "${API}/servers" | jq -r '.[0].uuid')   # [API] /servers
echo "server_uuid = ${SERVER_UUID}"
[ -n "${SERVER_UUID}" ] && [ "${SERVER_UUID}" != "null" ] || { echo "No server found"; exit 1; }

say "3/5  Create project 'k2u-platform'"
PROJECT_UUID=$(curl -fsS "${AUTH[@]}" -X POST "${API}/projects" \
  -d '{"name":"k2u-platform","description":"K2U voltage-unbalance monitoring & RUL prediction"}' \
  | jq -r '.uuid')                                                            # [API] /projects
echo "project_uuid = ${PROJECT_UUID}"

say "4/5  Register the Docker-Compose application from ${GIT_REPO}"
# [API] /applications/public — Coolify clones the repo and builds docker-compose.yml.
APP_PAYLOAD=$(jq -n \
  --arg pu "${PROJECT_UUID}" --arg su "${SERVER_UUID}" \
  --arg repo "${GIT_REPO}" --arg br "${GIT_BRANCH}" \
  '{
     project_uuid: $pu,
     server_uuid:  $su,
     environment_name: "production",
     git_repository: $repo,
     git_branch: $br,
     build_pack: "dockercompose",
     docker_compose_location: "/docker-compose.yml",
     instant_deploy: false
   }')
APP_UUID=$(curl -fsS "${AUTH[@]}" -X POST "${API}/applications/public" -d "${APP_PAYLOAD}" \
  | jq -r '.uuid')
echo "application_uuid = ${APP_UUID}"

say "5/5  Trigger deploy"
curl -fsS "${AUTH[@]}" -X POST "${API}/deploy" \
  -d "$(jq -n --arg u "${APP_UUID}" '{uuid:$u}')" | jq .                       # [API] /deploy

cat <<EOF

✅ Deploy triggered. Next, in the Coolify UI for this application:
   • set environment variables (MONGO_URI, MQTT_URL, AI_URL, JWT_SECRET,
     AUTH_REQUIRED, SEED_ADMIN_PASSWORD, TELEGRAM_TOKEN, CORS_ORIGIN) — see infra/coolify/README.md
   • attach a domain to the 'frontend' service (Coolify provisions HTTPS)
   • expose 8883 in the firewall for the ESP32 nodes (MQTT/TLS)

Reminder: rotate the API token you used once deployment is confirmed.
EOF

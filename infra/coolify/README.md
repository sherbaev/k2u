# Deploying on Coolify (self-hosted)

One Coolify project, six resources. Only ports **443** (HTTPS/WSS) and **8883**
(MQTT/TLS) are exposed publicly; everything else stays on the internal Docker
network. Matches thesis §3.1 and §3.5.

## Resources

1. **Mosquitto** — New Resource → Docker Image `eclipse-mosquitto:2`.
   Mount `infra/mosquitto/mosquitto.conf` + `aclfile` + `certs/`. Enable the TLS
   listener (8883) in the conf and expose **8883** in the firewall for the ESP32 nodes.

2. **MongoDB** — New Resource → Database → MongoDB 7. Internal network only.
   Enable nightly backups.

3. **AI service** — New Resource → Git repo, Build Pack: **Dockerfile**,
   context `apps/ai-service`. Internal only. Run `python train/generate.py &&
   python train/train.py` once to produce `artifacts/` (bake into the image or
   mount a volume). Env: `MODEL_PATH=/app/artifacts`.

4. **Backend (NestJS)** — New Resource → Git repo, Dockerfile
   `apps/backend/Dockerfile`, **build context = repo root**. Expose via domain (443).
   Env: `MONGO_URI=mongodb://mongo:27017/k2u`, `MQTT_URL=mqtt://mosquitto:1883`
   (or `mqtts://mosquitto:8883` with certs), `AI_URL=http://ai-service:8000`,
   `JWT_SECRET`, `AUTH_REQUIRED=true`, `SEED_ADMIN_USER`, `SEED_ADMIN_PASSWORD`,
   `TELEGRAM_TOKEN`, `TELEGRAM_CHAT_ID`, `CORS_ORIGIN=https://<frontend-domain>`.

5. **Frontend (React)** — New Resource → Git repo, Dockerfile
   `apps/frontend/Dockerfile`, **build context = repo root**. Attach a domain
   (Coolify provisions Let's Encrypt TLS via Traefik). nginx reverse-proxies
   `/api` and `/ws` to the backend service, so no build-time API URL is needed —
   ensure the frontend and backend share the Docker network and the nginx
   `proxy_pass http://backend:3000` name matches the backend service name.

6. **Traefik / Coolify** — provided by Coolify (auto-HTTPS).

## Security checklist (thesis §3.5)

- TLS on Mosquitto (8883) with per-device client certs + `aclfile` (each device
  limited to `site/{siteId}/dev/{devId}/#`).
- `AUTH_REQUIRED=true` in production; set a strong `SEED_ADMIN_PASSWORD` for first
  boot, then rotate. JWT `expiresIn` 12h.
- MongoDB and the AI service stay internal (no public port).
- Nightly `mongodump` to external storage.

## Local full-stack test (mirrors this topology)

```bash
docker compose up -d --build      # from repo root
# dashboard http://localhost:8080, backend http://localhost:3000
node apps/backend/tools/sim-publisher.mjs   # feed synthetic telemetry
```

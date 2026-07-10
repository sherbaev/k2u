# @k2u/backend

NestJS backend for the K2U voltage-unbalance monitoring platform. It:

- **Ingests** telemetry, aggregate, and alert packets published by K2U
  devices over MQTT (topics `site/{siteId}/dev/{devId}/{telemetry,aggregate,alert}`,
  see `@k2u/shared-contracts`).
- **Persists** ingested data as time-series collections in **MongoDB**.
- **Serves** a **REST API** for querying live/historical data and a
  **WebSocket** feed for pushing live updates to the dashboard.

## Running locally

1. Copy the env template and adjust as needed:

   ```bash
   cp .env.example .env
   ```

2. From the **repo root**, start MongoDB and the Mosquitto MQTT broker:

   ```bash
   docker compose up -d
   ```

3. From `apps/backend/`, install dependencies (repo-root workspace install)
   and start the backend in watch mode:

   ```bash
   npm run start:dev
   ```

## Simulating devices (no ESP32 hardware needed)

`tools/sim-publisher.mjs` is a standalone script that publishes realistic,
randomized telemetry over MQTT for a couple of simulated devices, so the
ingestion pipeline, REST API, and WebSocket feed can all be exercised
without real K2U hardware:

```bash
node tools/sim-publisher.mjs
```

Configurable via env vars: `MQTT_URL` (default `mqtt://localhost:1883`),
`SIM_PERIOD_MS` (default `10000`), `SIM_DEVICE_COUNT` (default `2`).

## Main endpoints

REST (prefixed `/api`):

- `GET /api/health` — liveness/readiness check.
- `GET /api/latest` — latest telemetry sample per device.
- `GET /api/history` — historical telemetry samples (time-ranged).
- `GET /api/aggregates` — 10-minute aggregate summaries.
- `GET /api/events` — alert/event log (WARNING/CRITICAL crossings).
- `GET /api/sites` — known sites.
- `GET /api/devices` — known devices.

WebSocket:

- `WS /ws/live` — live push feed of incoming telemetry/alerts.

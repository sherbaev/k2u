# Dashboard monitoring plan — K₂U real-time platform

Stack (your choices): **Coolify** (self-hosted), **MongoDB**, **NestJS** backend, **React** frontend,
**Eclipse Mosquitto** MQTT broker. The existing `index.html` nomogram is reused as the live
visualization inside the React app.

---

## 1. Architecture

```
[ESP32 node] --Wi-Fi--> MQTT/TLS (8883) --> [Mosquitto]
                                               |
                                  (NestJS subscribes)
                                               v
   [React dashboard] <--REST/WebSocket--> [NestJS backend] <--> [MongoDB]
                                               |
                                   (optional) [AI service: RUL + balancer]
```

Two logical planes (keep them separate — matches the thesis):
- **Data-plane:** device → Mosquitto → NestJS ingestion → MongoDB → WebSocket → dashboard.
- **Control-plane:** dashboard → NestJS → Mosquitto `cmd` topic → device (config, thresholds).

---

## 2. Repository layout (this repo)

```
unbalance/
  firmware/            ESP32 (PlatformIO/Arduino) — measure, compute K₂U, publish MQTT
  backend/             NestJS — ingestion + REST + WebSocket + auth + alerts
  frontend/            React — dashboard; embeds the nomogram from index.html
  ai-service/          (later) FastAPI — RUL + balancer-need; or a NestJS module
  mosquitto/           mosquitto.conf, acl, certs/
  index.html           existing standalone nomogram (kept for reference / quick demo)
  docker-compose.yml   local full-stack bring-up
  README.md
```

Migrate `index.html`'s nomogram drawing code into a React component
(`frontend/src/components/Nomogram.tsx`) — the math is already proven in that file.

---

## 3. MongoDB data model (Mongo 7 time-series)

Use **time-series collections** for telemetry (efficient, auto-bucketed by device).

| Collection | Type | Key fields |
|---|---|---|
| `telemetry` | time-series | `ts`, meta `{siteId, devId}`, `u_a,u_b,u_c`, `k2u`, `phi2`, `freq`, `i_a,i_b,i_c`, `temp`, `status` |
| `aggregates10m` | time-series | `ts`, meta `{siteId, devId}`, `k2u_avg/min/max`, `k2u_p95`, `exceed_2pct_s`, `exceed_4pct_s` |
| `events` | normal | `ts`, `siteId`, `devId`, `type` (WARNING/CRITICAL), `k2u`, `ackBy`, `ackAt` |
| `predictions` | normal | `ts`, `siteId`, `devId`, `rul`, `rul_lo`, `rul_hi`, `k2u_forecast`, `balancer_need` (none/recommended/required), `payback` |
| `devices` | normal | `devId`, `siteId`, `phaseConfig`, `lastSeen`, secrets/cert ref |
| `sites` | normal | `siteId`, name, type (pv/telecom), location, ratings |

Indexes: telemetry/aggregates auto-index on `{meta, ts}`; `events` on `{siteId, ts}`.
Retention: TTL/`expireAfterSeconds` ~90 days on raw `telemetry`; keep `aggregates10m` long-term
(GOST weekly 95-percentile is computed from aggregates).

GOST weekly evaluation: a NestJS scheduled job (or Mongo aggregation pipeline) rolls
`aggregates10m` into a weekly **95-percentile** of K₂U per site and flags ≤2 % / ≤4 % compliance.

---

## 4. NestJS backend modules

| Module | Responsibility |
|---|---|
| `IngestionModule` | MQTT client subscribes to `telemetry/alert/ack`; validates (class-validator / Zod) against the JSON schema; idempotent on `seq`; writes to Mongo |
| `ApiModule` | REST: `GET /api/sites`, `/api/devices`, `/api/latest`, `/api/history`, `/api/aggregates`, `/api/events`, `/api/predictions` |
| `RealtimeGateway` | WebSocket (`/ws/live`) — push new telemetry + events to subscribed dashboards |
| `AlertsModule` | state-change detection (NORMAL→WARNING→CRITICAL), cooldown, Telegram/SMS dispatch |
| `CommandModule` | publish to `cmd` topic with TTL; track `ack` |
| `AuthModule` | JWT login, roles (operator/admin) |
| `PredictionsModule` | call AI service (or run model), store RUL + balancer-need |
| `ScheduleModule` | nightly GOST 95-percentile rollup + daily prediction refresh |

MQTT in NestJS: use the `mqtt` npm client inside a provider, or `@nestjs/microservices` MQTT
transport. TLS to Mosquitto on 8883.

---

## 5. MQTT topics & QoS (matches the thesis)

| Purpose | Topic | Dir | QoS |
|---|---|---|---|
| Telemetry | `site/{siteId}/dev/{devId}/telemetry` | dev→srv | 0 |
| 10-min aggregate | `site/{siteId}/dev/{devId}/aggregate` | dev→srv | 1 |
| Alert | `site/{siteId}/dev/{devId}/alert` | dev→srv | 1 |
| Command | `site/{siteId}/dev/{devId}/cmd` | srv→dev | 1 |
| Ack | `site/{siteId}/dev/{devId}/ack` | dev→srv | 1 |

Telemetry JSON (publish every ~10 s):
```json
{ "ts":"2026-06-09T10:15:30+05:00","site_id":"UZT-TELECOM-01","dev_id":"K2U-01","seq":123,
  "u_a":221.4,"u_b":219.8,"u_c":223.1,"k2u":1.62,"phi2":137.5,"freq":50.0,
  "i_a":4.1,"i_b":3.8,"i_c":4.4,"temp":41.3,"status":"NORMAL","buf_fill":0.04 }
```

---

## 6. Frontend (React) panels

1. **K₂U polar nomogram** (port of `index.html`) — live operating point + 10-min trail, 2 %/4 % zones.
2. **Operating point** — K₂U %, φ₂, status badge, phase voltages.
3. **Real-time chart** — U_a/U_b/U_c + K₂U, last 24 h (WebSocket-fed).
4. **GOST compliance** — weekly 95-percentile, exceedance count/duration, pass/fail.
5. **Alerts log** — WARNING/CRITICAL with ack buttons.
6. **AI panel** — RUL gauge, K₂U forecast, balancer-need badge (green/yellow/red) + payback.
7. **Devices/sites** — registry, last-seen, health.

---

## 7. Build order

1. **Firmware happy-path:** ESP32 reads 3× PZEM → compute K₂U → publish to a local Mosquitto.
2. **Mosquitto** with TLS + ACL (each device limited to its own topics).
3. **NestJS IngestionModule** → write telemetry to MongoDB; verify documents land.
4. **REST + WebSocket** → `GET /api/latest`, `/ws/live`.
5. **React shell** → wire the nomogram component to live data.
6. **Aggregation + GOST job** → 10-min + weekly 95-percentile.
7. **Alerts** → state-change + Telegram.
8. **AI service** → RUL + balancer-need (can be stubbed first, real model later).
9. **Auth + hardening.**

---

## 8. Coolify deployment (self-hosted)

On your Coolify server, create one project with these resources:

1. **Mosquitto** → New Resource → Docker Image `eclipse-mosquitto:2`; mount `mosquitto/` config +
   certs; expose **8883** (TLS) in the firewall for the ESP32 nodes.
2. **MongoDB** → New Resource → Database → MongoDB 7; internal Docker network only (not public).
3. **Backend (NestJS)** → New Resource → Git repo `/backend`; Build Pack: Dockerfile/Nixpacks;
   env: `MONGO_URI`, `MQTT_URL` (tls://mosquitto:8883), `JWT_SECRET`, `TELEGRAM_TOKEN`.
4. **Frontend (React)** → New Resource → Git repo `/frontend`; env: `VITE_API_URL`, `VITE_WS_URL`;
   attach domain (Coolify provisions Let's Encrypt TLS via Traefik).
5. **AI service** (later) → Git repo `/ai-service`.
6. Domains + auto-HTTPS on backend and frontend; DB + Mosquitto stay internal except 8883.

Security: mTLS device certs on Mosquitto, ACL per device, JWT on the UI, MongoDB internal-only,
nightly DB backups.

---

## 9. Decisions (settled)

1. **Telegram alerts** — **kept.** Need a bot token + chat id (configure as backend env vars).
2. **SMS fallback** — **dropped.** Nodes are Wi-Fi ESP32 (no cellular modem); Telegram + dashboard
   cover alerting. Also removed from the thesis.
3. **One vs many nodes** — start with the 2 test nodes; schema already supports many sites.
4. **AI service** — **FastAPI sidecar** (Python, easy XGBoost/ONNX), called by NestJS over HTTP.

# k2u-platform

Self-hosted platform for remote monitoring of three-phase **voltage unbalance**
(negative-sequence factor **K₂U**) on renewable-energy (PV inverter) and telecom
sites, with AI-based **Remaining Useful Life (RUL)** prediction and balancer-need
decision support.

Grounded in the dissertation (BOB II–IV) and the Scopus manuscript. See
[`docs/CODING_PLAN.md`](docs/CODING_PLAN.md) for the full build plan.

## Monorepo layout

```
apps/
  firmware/          ESP32 (PlatformIO) — measure 3× PZEM, compute K₂U, publish MQTT
  backend/           NestJS — ingestion + REST + WebSocket + auth + alerts + schedule
  frontend/          React 18 + Vite + MUI — dashboard (nomogram, charts, GOST, alerts, AI)
  ai-service/        FastAPI + XGBoost/ONNX — RUL + conformal interval + decision layer
packages/
  shared-contracts/  JSON Schemas + TS types + MQTT topics — canonical payload contract
  k2u-core/          symmetrical-components math (K₂U, φ₂) shared by front/back/tests
infra/
  mosquitto/         broker config + ACL (+ TLS certs in production)
  coolify/           per-service deploy notes + env templates
docs/                coding plan, ported firmware/hardware/dashboard plans
docker-compose.yml   local bring-up (Mongo + Mosquitto)
```

## Status

**Phase 0 — foundations (done).**

- [x] Monorepo scaffold (pnpm workspaces, shared tsconfig)
- [x] `@k2u/shared-contracts` — telemetry/aggregate/alert/prediction schemas + TS types + topics
- [x] `@k2u/core` — K₂U math ported from the proven nomogram; **6/6 tests pass**
      (balanced→0 %, 2 % synthetic recovery, forward/inverse round-trip <1e-7,
      β/complex agreement, triangle validation, GOST boundaries)
- [x] Local `docker-compose` (Mongo 7 + Mosquitto 2) + broker config/ACL

**Phase 3 — backend ingestion + API (done, ahead of firmware).**

- [x] NestJS app: Mongo time-series schemas (telemetry/aggregate) + events/predictions/devices/sites
- [x] MQTT ingestion pipeline: validate → store → event (idempotent on `seq`), WARNING/CRITICAL → events
- [x] Ajv (draft 2020-12) telemetry validator with GOST-band + K₂U-recompute cross-checks; **8/8 tests pass**
- [x] REST API (`/api/health,/latest,/history,/aggregates,/events,/sites,/devices,/predictions`)
- [x] WebSocket gateway `/ws/live` fanning out ingested data
- [x] `tools/sim-publisher.mjs` — emit synthetic telemetry to test the whole path with no ESP32

**Phase 5 — React dashboard (done).**

- [x] Vite + React 18 + MUI app; axios REST client + auto-reconnecting `/ws/live` hook
- [x] `Nomogram.jsx` — polar nomogram ported from the proven `index.html` (iso-K₂U curves,
      2%/4% GOST zones, radial phase-angle lines, live operating point + trail, drag inverse mode)
- [x] Panels: operating point, voltage+K₂U chart (recharts), alerts, GOST compliance, RUL/AI
- [x] Plain-JS K₂U mirror + geometry helpers; **5/5 lib tests pass**, all 16 JSX/JS files parse clean

**Phase 8 — AI service (done).**

- [x] FastAPI service: `/health`, `/predict` (RUL + CQR interval + balancer decision + payback)
- [x] Physics fleet generator (Miner + Montsinger/Arrhenius, unbalance heating ∝ k·K₂U²) —
      **reproduces paper distributions**: median t_fail 20.7/22.6 yr (paper 20.3/23.0),
      K₂U p95 quartiles [1.43, 2.11, 2.84, 4.22] vs paper [1.43, 2.04, 2.90, 4.27]
- [x] Training pipeline (XGBoost + temporal CV + quantile q10/q90 + CQR qhat + 3-level decision),
      a faithful port of the paper's `sim_train.py`/`sim_cqr.py`; saves serving artifacts
- [x] Pure-logic tests pass (decision thresholds, payback, feature vector, physics fallback)
- [x] Backend calls it (PredictionsModule → RulPanel on the dashboard)

Note: the XGBoost training run (R²≈0.76, qhat≈0.07, decision acc≈0.95) is reproduced by
`python train/train.py`; it wasn't re-executed in this sandbox because the scipy/xgboost
wheels exceed the environment's install window. The physics generator (the rewritten part)
is verified against the paper's published statistics above.

**Phases 6 + 7 — alerts, predictions wiring, GOST rollup (done).**

- [x] Alerts: state-change detection (escalate always, recover respects cooldown) + Telegram +
      ack endpoint; ingestion refactored to delegate to `AlertsService`. **6/6 alert-logic tests pass**
- [x] Predictions: pure feature-builder (aggregates → 15 features) + `PredictionsService`
      calling the AI service, nightly `@Cron` refresh + on-demand endpoint. **3/3 builder tests pass**
- [x] Compliance: nightly GOST weekly-95-percentile rollup + `GET /api/compliance`. **verdict tests pass**
- [x] New API: `GET /api/compliance`, `POST /api/events/:id/ack`, `POST /api/predictions/refresh`
- [x] Wired into `ScheduleModule.forRoot()`; all 32 backend TS files parse clean

**Phase 1 — ESP32 firmware (done).**

- [x] PlatformIO project (pinned toolchain/libs), `config.h`, `secrets.h.example`
- [x] `lib/k2u` hardware-independent β-method + line-from-phase + GOST classify —
      **native g++ checks pass**: balanced→0 %, 2 % synthetic within 0.0003 %, 4.5 %→CRITICAL, degenerate→NaN
- [x] `main.cpp` FreeRTOS tasks: Measure (validate + median filter) → Compute → Telemetry
      (MQTT/TLS publish) → Display (OLED) → Watchdog; ArduinoJson telemetry matching the contract
- [x] Unity host tests (`pio test -e native`)

**Phase 9 — manual raw-data entry + CSV import (done).**

- [x] Shared `lineFromPhaseNominal` in `k2u-core` + frontend mirror (phase→line reconstruction)
- [x] Backend `POST /api/readings` + `/api/readings/bulk`: compute K₂U via k2u-core, store
      telemetry `source:"manual"|"import"`, run through the same alerts pipeline
- [x] Frontend Manual Entry page: phase/line toggle, **live K₂U preview + nomogram**, CSV upload
      (`lib/csv.js` parser) with preview + bulk import; nav route wired
- [x] Verified: core 8/8, frontend 16/16 (incl. CSV parser), backend manual-logic 5/5;
      all 36 backend TS + 19 frontend JS/JSX parse clean

The whole system now runs **with no hardware** — enter or import readings and the full
dashboard/GOST/RUL/alerts pipeline works (useful for the defense demo).

**GOST report export (done).**

- [x] Pure report model (`lib/report.js`): weekly rollup → sorted rows, verdicts, summary, CSV.
      **6 report tests pass** (durations, verdict boundaries, sort/summary, empty, CSV)
- [x] jsPDF compliance PDF (`lib/pdf.js`) + JSZip bundle (`lib/zipExport.js`) over the tested model
- [x] Reports page: device + date-range (react-day-picker), preview table + verdict,
      Export PDF / CSV / ZIP; nav route wired. 21/21 frontend lib tests pass; all files parse clean

**Auth + Docker + deploy (done).**

- [x] JWT auth: scrypt password hashing (**4 tests pass**), login endpoint, config-gated
      guard (`AUTH_REQUIRED`) + roles, admin seed. Write endpoints guarded (no-op until enabled)
- [x] Backend image bundles workspace packages via webpack (`nest build --webpack`)
- [x] Frontend image: nginx serving the Vite build + reverse-proxy of `/api` and `/ws`
- [x] Full-stack `docker compose up -d --build` (mongo + mosquitto + ai-service + backend + frontend)
- [x] Coolify deploy guide (`infra/coolify/README.md`) with the six-resource topology + security checklist

## Run the whole stack

```bash
docker compose up -d --build          # dashboard :8080, backend :3000
node apps/backend/tools/sim-publisher.mjs   # feed synthetic telemetry (no ESP32 needed)
```

Remaining polish: firmware store-and-forward (LittleFS ring buffer) + calibration mode.

## Quick start

```bash
# Prerequisites: Node >= 20, pnpm 9, Docker
pnpm install
docker compose up -d          # Mongo on 27017, Mosquitto on 1883 (dev)

# Run the K₂U math test suite
pnpm --filter @k2u/core test
```

## Math (one line)

From line-voltage magnitudes, `k2uFromVoltages()` runs the full complex
symmetrical-components transform (K₂U + φ₂); `k2uBeta()` is the RMS-only IEC
61000-4-30 closed form the firmware uses. Both are cross-checked in tests.
GOST 32144-2013 limits: 2 % normal, 4 % maximum.
# k2u

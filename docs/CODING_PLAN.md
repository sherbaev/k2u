# K₂U Monitoring & RUL Prediction System — Coding Plan

**Project:** Remote monitoring of voltage unbalance (negative-sequence factor K₂U) on renewable-energy (PV inverter) and telecom sites, with AI-based Remaining Useful Life (RUL) prediction and balancer-need decision support.

**Grounded in:** the dissertation (BOB II–IV), the Scopus manuscript + simulation results (`scopus_paper_2026/simulation`), and the existing `unbalance` planning docs (`FIRMWARE_PLAN.md`, `HARDWARE_BOM.md`, `DASHBOARD_PLAN.md`) and nomogram (`index.html`).

**Decisions locked for this plan:**
- Deliverable: coding plan document (this file). No code scaffolded yet.
- Repo: **fresh monorepo**; port only the proven nomogram math and reuse the plans as reference.
- Data input priority: **live ESP32 → MQTT → Mongo path first**; manual raw-data entry + CSV/Excel import added afterward as a secondary input.

---

## 1. System overview

Five cooperating components across three planes:

```
                          ┌─────────────── Coolify VPS (self-hosted PaaS) ───────────────┐
[ESP32 node] --Wi-Fi-->   │  Mosquitto(8883 TLS) → NestJS ingestion → MongoDB 7 (TS)     │
  3× PZEM-004T            │        │                     │                                │
  K₂U + φ₂ on-device      │        │              REST + WebSocket                        │
                          │        │                     │                                │
[Manual entry / CSV] ───► │   (backend REST)      React dashboard  ◄── operator browser   │
  (secondary path)        │        │                                                      │
                          │   AI service (FastAPI + ONNX): RUL + CQR interval + decision  │
                          │   Traefik (auto-HTTPS) · Coolify orchestration · backups      │
                          └───────────────────────────────────────────────────────────────┘
```

- **Data plane:** device/manual input → validation → MongoDB time-series → WebSocket → dashboard.
- **Control plane:** operator → backend → MQTT `cmd` topic → device (thresholds, calibration).
- **AI plane:** backend feeds engineered features → FastAPI model → RUL + interval + balancer-need → stored + shown.

The K₂U **polar nomogram** is the central visualization: radial = K₂U %, angle = φ₂, with 2 %/4 % GOST 32144-2013 limit rings.

---

## 2. Monorepo layout (fresh)

```
k2u-platform/
  apps/
    firmware/          ESP32 (PlatformIO/Arduino) — measure, compute K₂U, publish MQTT
    backend/           NestJS 10 — ingestion + REST + WebSocket + auth + alerts + schedule
    frontend/          React 18 + Vite + MUI — dashboard (nomogram, charts, GOST, alerts, AI, reports)
    ai-service/        FastAPI + XGBoost/ONNX — RUL + conformal interval + decision layer
  packages/
    shared-contracts/  JSON Schemas + TS types for the telemetry/aggregate/alert/prediction payloads
    k2u-core/          symmetrical-components math (TS port of index.html) — used by frontend + backend + tests
  infra/
    mosquitto/         mosquitto.conf, aclfile, certs/ (mTLS)
    coolify/           per-service deploy notes, env templates, docker-compose for local bring-up
  docs/                ported plans (firmware/hardware/dashboard), API reference, thesis-metric map
  docker-compose.yml   local full-stack (mosquitto + mongo + backend + frontend + ai-service)
  README.md
```

**Why a monorepo:** the telemetry JSON contract must stay identical across firmware, backend, and frontend. `packages/shared-contracts` is the single source of truth (JSON Schema → generated TS types + a Python model for the AI service). `packages/k2u-core` guarantees the nomogram math is the same code the firmware unit-tests validate.

Tooling: pnpm workspaces for JS packages; `firmware/` and `ai-service/` are independent toolchains referenced from the root README. TypeScript everywhere on the JS side.

---

## 3. Frontend stack mapping (given `package.json`)

The supplied dependency set (originally a "dental" template) maps cleanly onto this project — reuse it as the frontend baseline:

| Dependency | Use in this project |
|---|---|
| `react` 18 + `react-dom` + `vite` | App shell and build |
| `@mui/material` 9 + `@mui/icons-material` + `@emotion/*` | Dashboard layout, cards, tables, dialogs, theming |
| `react-router-dom` 6 | Routes: Overview, Site, Device, GOST report, Alerts, Admin, Manual entry |
| `recharts` | 24-hour voltage/K₂U time-series, GOST trend, RUL gauge/forecast charts |
| `@dnd-kit/*` | Rearrangeable dashboard widget grid (operator-customizable panels) |
| `react-day-picker` + `date-fns` | Date-range selection for history and report export |
| `axios` | REST client to NestJS |
| `jspdf` + `jszip` | GOST compliance report export to PDF; bundle CSV/PDF into a ZIP (Excel via SheetJS if added) |
| `three` | Optional 3D site/enclosure view or a 3D phasor visualization — **defer**; nomogram is 2D SVG |
| `lucide-react` | Icon set alongside MUI icons |

**Added to package.json during the build:** a WebSocket client (native `WebSocket` or `socket.io-client` depending on the gateway), and `d3` (or hand-rolled SVG) for the polar nomogram. The nomogram is ported from `index.html`'s proven forward/inverse math into `packages/k2u-core` + a `Nomogram.tsx` component. `recharts` covers the standard charts; the nomogram needs custom SVG so it stays D3/SVG.

---

## 4. Deployment topology (Coolify)

One Coolify project, six resources:

| Resource | Image / source | Exposure | Key env |
|---|---|---|---|
| Mosquitto | `eclipse-mosquitto:2` | **8883** (TLS) open to nodes | mounts `infra/mosquitto/` conf + certs + ACL |
| MongoDB | MongoDB 7 (Coolify DB) | internal Docker network only | volume + nightly backup |
| Backend (NestJS) | Git `apps/backend`, Dockerfile/Nixpacks | 443 via Traefik | `MONGO_URI`, `MQTT_URL=tls://mosquitto:8883`, `JWT_SECRET`, `TELEGRAM_TOKEN`, `AI_URL` |
| Frontend (React) | Git `apps/frontend`, static build | 443 via Traefik + domain | `VITE_API_URL`, `VITE_WS_URL` |
| AI service (FastAPI) | Git `apps/ai-service`, Dockerfile | internal only (backend calls it) | `MODEL_PATH`, `MONGO_URI` (read-only) |
| Traefik / Coolify | provided by Coolify | 80/443 | auto Let's Encrypt |

Only **443** (HTTPS/WSS) and **8883** (MQTT/TLS) are exposed publicly. MongoDB, AI service, and internal traffic stay on the Docker network. Nightly `mongodump` to external storage. This matches thesis §3.1 and §3.5 (five-layer security: TLS transport, per-device auth + ACL, network isolation, input validation, audit + backup).

---

## 5. Firmware plan (ESP32) — `apps/firmware`

Reuse `docs/FIRMWARE_PLAN.md` verbatim as the reference; summary of the build:

**Toolchain:** PlatformIO + Arduino-ESP32, FreeRTOS. Libs: `mandulaj/PZEM-004T-v30`, `knolleary/PubSubClient` over `WiFiClientSecure` (TLS), `bblanchon/ArduinoJson`, `adafruit/RTClib` (DS3231), `adafruit/SSD1306`. `platformio.ini` pins exact versions for reproducible DGU builds.

**Hardware (per node, ≈$74):** ESP32-WROOM-32, 3× PZEM-004T v3.0 (one per phase, **phase-to-neutral** ~220 V on a 4-wire 380/220 V supply → also yields K₀U for free), DS3231 RTC, SSD1306 OLED, level shifter, HLK-PM01 PSU, IP65 enclosure + 3-pole MCB + fuses. Build 2 nodes (PV site + telecom site). **380 V taps by a licensed electrician; develop on a low-voltage bench first.**

**FreeRTOS tasks:** MeasureTask (1 s, poll 3 PZEMs, validate 180–260 V, median filter, derive line voltages) · ComputeTask (K₂U + φ₂, classify NORMAL/WARNING/CRITICAL, 10-min RTC-aligned aggregate) · TelemetryTask (10 s JSON publish, QoS 0 telemetry / QoS 1 aggregate+alert, store-and-forward flush) · DisplayTask · WatchdogTask.

**Core math (`k2u.cpp`, host-unit-tested, RMS-only per IEC 61000-4-30):**
```
β   = (U_AB⁴+U_BC⁴+U_CA⁴) / (U_AB²+U_BC²+U_CA²)²      # clamp β∈[1/3,1/2)
K2U = sqrt((1−sqrt(3−6β)) / (1+sqrt(3−6β))) · 100 %
```
Keep hardware-independent so `pio test -e native` proves forward/inverse consistency — the same math ported to `packages/k2u-core`.

**Store-and-forward:** LittleFS ring buffer (4096 records), 10-min aggregates persisted and replayed at QoS 1 on reconnect (exponential backoff, `clean_session=false`). Raw 10 s telemetry may drop.

**Calibration:** per-channel `(k, b)` in NVS, settable over `cmd` topic/serial; `CALIB` mode prints raw-vs-reference for the 5-point etalon comparison (feeds thesis §2.5 accuracy tables).

**Milestones (order):** blink+WiFi+SNTP → 1 PZEM → 3 PZEMs (addr 0x01–03) → k2u.cpp + unit tests → Measure+Compute live on OLED → MQTT/TLS publish lands in Mongo → 10-min aggregate + events → store-and-forward → watchdog/reliability → calibration + field deploy.

---

## 6. MQTT contract + Mosquitto — `infra/mosquitto` + `packages/shared-contracts`

**Topics** (`site/{siteId}/dev/{devId}/…`):

| Purpose | Topic suffix | Dir | QoS |
|---|---|---|---|
| Telemetry (10 s) | `telemetry` | dev→srv | 0 |
| 10-min aggregate | `aggregate` | dev→srv | 1 |
| Alert | `alert` | dev→srv | 1 |
| Command | `cmd` | srv→dev | 1 |
| Ack | `ack` | dev→srv | 1 |

**Telemetry JSON (canonical schema, lives in `shared-contracts`):**
```json
{ "ts":"2026-06-09T10:15:30+05:00","site_id":"UZT-TELECOM-01","dev_id":"K2U-01","seq":123,
  "u_a":229.1,"u_b":225.4,"u_c":231.0,"u_ab":394.2,"u_bc":391.8,"u_ca":398.6,
  "k2u":1.62,"phi2":137.5,"freq":50.0,"i_a":4.1,"i_b":3.8,"i_c":4.4,
  "temp":41.3,"status":"NORMAL","buf_fill":0.04 }
```

**Mosquitto:** TLS on 8883, per-device credentials, `aclfile` restricting each device to its own `site/{siteId}/dev/{devId}/#`. mTLS client certs recommended. Config + certs mounted from `infra/mosquitto/`.

---

## 7. Backend plan (NestJS) — `apps/backend`

| Module | Responsibility |
|---|---|
| `IngestionModule` | MQTT client subscribes telemetry/aggregate/alert; validates against JSON Schema (class-validator/Zod), value ranges (0≤K₂U≤100, 300≤U≤500), idempotent on `seq`; writes to Mongo |
| `ApiModule` | REST: `GET /api/sites`, `/api/devices`, `/api/latest`, `/api/history`, `/api/aggregates`, `/api/events`, `/api/predictions`; `POST /api/readings` (manual entry, Phase 7) |
| `RealtimeGateway` | WebSocket `/ws/live` — push new telemetry + events to subscribed dashboards |
| `AlertsModule` | state-change detection NORMAL→WARNING→CRITICAL, cooldown, Telegram dispatch |
| `CommandModule` | publish `cmd` with TTL, track `ack` |
| `AuthModule` | JWT login, roles operator/admin |
| `PredictionsModule` | build features from aggregates, call AI service over HTTP, store RUL + interval + balancer-need |
| `ScheduleModule` | nightly GOST weekly-95-percentile rollup + daily prediction refresh |

**Ingestion pipeline (3 stages, thesis §3.2):** validate → store → event-process. Malformed packets rejected to audit log; duplicate `seq` accepted idempotently; WARNING/CRITICAL packets fan out to WebSocket + Telegram with cooldown + state-change gating.

MQTT in NestJS: `mqtt` npm client in a provider (or `@nestjs/microservices` MQTT transport), TLS to Mosquitto:8883.

---

## 8. MongoDB schema (Mongo 7 time-series) — used by backend + AI

| Collection | Type | Key fields |
|---|---|---|
| `telemetry` | time-series | `ts`, meta `{siteId,devId}`, `u_a,u_b,u_c`, `u_ab,u_bc,u_ca`, `k2u`, `phi2`, `freq`, `i_a,i_b,i_c`, `temp`, `status`, `source` (`device`\|`manual`\|`import`) |
| `aggregates10m` | time-series | `ts`, meta `{siteId,devId}`, `k2u_avg/min/max`, `k2u_p95`, `exceed_2pct_s`, `exceed_4pct_s`, `temp_*`, `load_factor` |
| `events` | normal | `ts`, `siteId`, `devId`, `type` (WARNING/CRITICAL), `k2u`, `ackBy`, `ackAt` |
| `predictions` | normal | `ts`, `siteId`, `devId`, `rul`, `rul_lo`, `rul_hi`, `k2u_forecast`, `balancer_need` (none/recommended/required), `payback` |
| `devices` | normal | `devId`, `siteId`, `phaseConfig`, `calib`, `lastSeen`, cert ref |
| `sites` | normal | `siteId`, name, type (pv/telecom), location, ratings |

Time-series auto-index on `{meta, ts}`. TTL ~90 days on raw `telemetry`; keep `aggregates10m` long-term (GOST weekly 95-percentile computed from aggregates). GOST rollup via Aggregation Pipeline (`$group`, `$percentile`) in a scheduled job. `source` field lets manual/imported readings coexist with device data.

---

## 9. AI service plan (FastAPI + ONNX) — `apps/ai-service`

Grounded in thesis BOB IV and the **actual simulation results** (`sim_summary2.json`, `sim_summary3.json`):

**Two outputs:** (1) RUL as relative remaining resource `rul_rel ∈ [0,1]`; (2) balancer-need indicator `{none, recommended, required}` — advisory only (no closed-loop control), plus economic payback.

**Model:** XGBoost gradient-boosting regressor (best params from sim: `max_depth=6, learning_rate=0.1, n_estimators=600`, subsample/colsample 0.9). Baselines Random Forest + Linear + PhysicsOnly for the thesis comparison table. Separate device_type parametrization (PV vs telecom) — sim shows both single-model+categorical and per-type work.

**Achieved sim metrics to reproduce/verify:** XGBoost RMSE 0.173 / MAE 0.132 / **R² 0.765** (test); telecom R² 0.791, PV R² 0.721; XGB-without-physics R² drops to 0.148 (physics-augmented training matters). Inference ≈2.2 µs/sample.

**15 features (`FEATS` in `sim_train.py`):** `k2u_mean_7d/30d`, `k2u_p95_7d/30d`, `k2u_max_30d`, `exposure_2pct_30d`, `exposure_4pct_30d`, `cum_damage_index`, `temp_mean/max_30d`, `load_factor_mean_30d`, `thermal_cycles_30d`, `is_pv`, `service_age`, `rated_power`. Top importance: `cum_damage_index` (0.35), `exposure_2pct_30d` (0.17), `service_age` (0.10).

**Training data (3 sources, thesis §4.2):** synthetic aging trajectories from the physics model (Miner's rule + Arrhenius/Coffin–Manson, low confidence weight), accelerated-aging literature params, real maintenance/failure labels (high weight). **Temporal split** (train on past, test on future) to avoid leakage.

**Uncertainty:** Conformalized Quantile Regression (CQR) — `sim_cqr.py` gives `qhat≈0.0715`, coverage improving 0.64→0.78 after calibration. Expose `rul_lo/rul_hi`. Explainability: feature importance (gain) + SHAP per prediction ("why this estimate") for the operator UI.

**Decision layer (thesis §4.6, sim decision accuracy 0.95):** combine RUL estimate + K₂U 30-day forecast (expected 95-percentile) → three-level balancer-need + payback. Only *sustained* high, cumulative-damage unbalance justifies a balancer.

**Deployment:** train offline in `simulation/` style scripts, export to ONNX, serve via FastAPI (`/predict`, `/health`); NestJS `PredictionsModule` calls it. Periodic retraining as real labels accumulate.

---

## 10. Frontend dashboard plan — `apps/frontend`

Routes: Overview · Site · Device detail · GOST report · Alerts · Manual entry (Phase 7) · Admin. Seven panels (thesis §3.3), draggable via dnd-kit:

1. **K₂U polar nomogram** — port `index.html` math into `k2u-core` + `Nomogram.tsx` (SVG): iso-K₂U circles every 0.5 %, 2 % yellow / 4 % red rings, zonal shading, live operating point + 10-min trail, historical point cloud, interactive inverse mode (drag point → line-voltage ratios).
2. **Operating point** — K₂U %, φ₂, status badge, U_BC/U_AB & U_CA/U_AB ratios.
3. **Real-time chart** — U_a/U_b/U_c + K₂U last 24 h (recharts, WebSocket-fed).
4. **GOST compliance** — weekly 95-percentile, 2 %/4 % exceedance count + duration, pass/fail.
5. **Alerts log** — WARNING/CRITICAL with ack buttons.
6. **AI panel** — RUL gauge + CQR interval, K₂U forecast, balancer-need badge (green/yellow/red) + payback, SHAP "why".
7. **Reports** — GOST compliance export to PDF (jspdf) / CSV, ZIP bundle (jszip).

Live updates via WebSocket rendered within ~100 ms; smooth operating-point animation.

---

## 11. Manual raw-data entry + import (Phase 7, secondary)

After the live path works, add offline/no-hardware input so the dashboard, GOST analysis, RUL, and reports run without an ESP32 (useful for thesis defense/demos):

- **Manual reading form** — enter U_a/U_b/U_c (or U_ab/U_bc/U_ca), temp, load, timestamp, device/site; backend computes K₂U via `k2u-core` (shared math), writes with `source:"manual"`.
- **CSV/Excel import** — upload historical logs; server validates each row against the same JSON Schema, computes K₂U, bulk-inserts with `source:"import"`. SheetJS added for `.xlsx` parsing.
- Manual/imported data flows through the identical validation → aggregation → GOST → RUL pipeline, tagged by `source` so it is auditable and separable from device data.

---

## 12. Sequenced build roadmap (live path first)

| Phase | Deliverable | Acceptance |
|---|---|---|
| 0 | Monorepo scaffold, `shared-contracts` schemas, `k2u-core` math + tests, local `docker-compose` | `pnpm test` green; k2u forward/inverse consistent to machine precision |
| 1 | Firmware happy-path: 3× PZEM → K₂U → publish to local Mosquitto | Balanced input → 0 %; synthetic 2 % case matches |
| 2 | Mosquitto TLS + ACL | Each device limited to its own topics; TLS handshake OK |
| 3 | NestJS IngestionModule → Mongo | Telemetry docs land in `telemetry` time-series; bad packets rejected to audit |
| 4 | REST + WebSocket (`/api/latest`, `/ws/live`) | Dashboard shell shows live operating point |
| 5 | React nomogram + core panels wired to live data | Operating point + 24 h chart update via WS |
| 6 | Aggregation + GOST weekly 95-percentile job | Weekly p95 + exceedance computed from aggregates; pass/fail correct |
| 7 | Alerts (state-change + Telegram) | WARNING/CRITICAL fire once per transition, cooldown honored |
| 8 | AI service: XGBoost + CQR + decision layer (stub → real) | Reproduce sim R²≈0.76, decision acc≈0.95; predictions stored + shown |
| 9 | Manual entry + CSV/Excel import (secondary) | No-hardware readings produce identical downstream analysis |
| 10 | Auth/roles, reports (PDF/ZIP), store-and-forward field test, hardening | JWT roles enforced; pull-the-antenna replay works; GOST PDF exports |
| 11 | Field deploy to PV + telecom nodes; DGU registration package | Real data flowing; screenshots + module list for DGU certificate |

---

## 13. Verification & thesis-metric hooks

Wire the build to the metrics the dissertation/Scopus paper report, so results are reproducible for defense:

- **Measurement accuracy (§2.5):** firmware `CALIB` mode 5-point comparison vs etalon meter → voltage error %, K₂U absolute error, 7-day correlation.
- **Platform performance (§3.2):** load-test ingestion rate (msg/s), E2E latency p50/p99, DB size per device/month — fill the thesis placeholders.
- **RUL model (§4.3):** unit-test the training pipeline reproduces `sim_summary2.json` (RMSE 0.173, R² 0.765; per-type PV/telecom; physics-ablation R² 0.148).
- **CQR (§4):** verify calibrated coverage ≈0.78 (`sim_summary3.json`, `qhat≈0.0715`).
- **Decision layer (§4.6):** confusion matrix ≈ sim (accuracy 0.951; `required` recall 0.98).
- **k2u-core:** property test that the TS port matches the firmware C++ math and `index.html` on the same inputs.

A CI job (GitHub Actions) runs `k2u-core` tests, backend schema-validation tests, and the AI reproduction check on every push.

---

## 14. Risks & open choices

- **Physics augmentation is load-bearing** — sim shows R² collapses 0.765→0.148 without physics-generated training data; keep the synthetic-trajectory generator (`sim_generate.py`) as a first-class part of `ai-service`.
- **CQR interval coverage (~0.78)** is below the nominal 0.80 target — document honestly; more real labels + recalibration improve it.
- **Real failure labels are scarce early** — model leans on synthetic + accelerated-aging literature at first; schedule periodic retraining as maintenance records accumulate.
- **380 V safety** — all mains taps by a licensed electrician; bench-develop firmware at low voltage.
- **Open firmware choices (FIRMWARE_PLAN §11):** shared 3-address PZEM bus (recommended) vs 3 UARTs; LittleFS vs NVS ring buffer (recommend LittleFS); OTA in v1 or defer (recommend defer).
- **`three.js`** in the dependency list has no confirmed use yet — defer any 3D view until the 2D system is complete.

---

## 15. Immediate next steps

1. `git init` the `k2u-platform` monorepo with the layout in §2; add pnpm workspaces.
2. Author `packages/shared-contracts` JSON Schemas (telemetry/aggregate/alert/prediction) and generate TS types.
3. Port `index.html` math into `packages/k2u-core` with the forward/inverse property test.
4. Stand up local `docker-compose` (Mosquitto + Mongo) and the NestJS ingestion skeleton to get one telemetry packet end-to-end into Mongo (Phases 0–3).

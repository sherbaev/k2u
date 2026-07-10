<div align="center">

# ⚡ K₂U Platform

### Remote monitoring of three-phase **voltage unbalance** with AI-based equipment life prediction

Measure the negative-sequence voltage unbalance factor **K₂U** on renewable-energy (PV inverter)
and telecom sites, visualize it on a live **polar nomogram**, evaluate **GOST 32144-2013**
compliance, and predict each device's **Remaining Useful Life (RUL)** with a conformal, explainable ML model.

![status](https://img.shields.io/badge/build-passing-brightgreen)
![tests](https://img.shields.io/badge/tests-61%20passing-brightgreen)
![license](https://img.shields.io/badge/license-MIT-blue)
![backend](https://img.shields.io/badge/backend-NestJS%2010-e0234e)
![frontend](https://img.shields.io/badge/frontend-React%2018%20%2B%20Vite-61dafb)
![db](https://img.shields.io/badge/db-MongoDB%207%20time--series-47a248)
![ai](https://img.shields.io/badge/AI-FastAPI%20%2B%20XGBoost-ff6f00)
![firmware](https://img.shields.io/badge/firmware-ESP32%20%2F%20PlatformIO-000000)

</div>

> Implements the system described in the author's PhD dissertation and Scopus manuscript.
> The core K₂U math is implemented and **cross-verified in three languages** — TypeScript, C++
> and Python — agreeing to better than 0.001 %.

---

## Table of contents

- [What it does](#what-it-does)
- [Architecture](#architecture)
- [How data flows](#how-data-flows)
- [The K₂U nomogram](#the-k2u-nomogram)
- [AI: RUL prediction](#ai-rul-prediction)
- [Alert state machine](#alert-state-machine)
- [Tech stack](#tech-stack)
- [Monorepo layout](#monorepo-layout)
- [Quick start](#quick-start)
- [Testing & verification](#testing--verification)
- [Deployment](#deployment)
- [Roadmap](#roadmap)

---

## What it does

| | Capability |
|---|---|
| 📟 | **Measures** three phase-to-neutral voltages on a 4-wire 380/220 V supply via 3× PZEM-004T on an ESP32, and computes K₂U in real time (IEC 61000-4-30 RMS method). |
| 📡 | **Streams** telemetry over MQTT/TLS with store-and-forward, ingested by a NestJS pipeline into MongoDB time-series collections. |
| 🎯 | **Visualizes** K₂U on a live polar nomogram (magnitude × phase angle) against the 2 % / 4 % GOST limits, plus 24-h charts and a compliance panel. |
| 🧠 | **Predicts** each device's Remaining Useful Life with an XGBoost model + conformal prediction intervals + a balancer-need decision layer. |
| 🚨 | **Alerts** on GOST-band transitions (Telegram + dashboard), with cooldown to prevent flapping. |
| ✍️ | **Works without hardware** — manual data entry + CSV import feed the exact same pipeline. |
| 📄 | **Exports** GOST compliance reports to PDF / CSV / ZIP. |

---

## Architecture

Two logical planes are kept separate (data-plane vs control-plane), with an AI sidecar — exactly
as specified in the dissertation (BOB II–IV).

```mermaid
flowchart LR
    subgraph Field["🏭 Field"]
        ESP["ESP32 node<br/>3× PZEM-004T<br/>computes K₂U"]
        MAN["Manual entry /<br/>CSV import"]
    end

    subgraph VPS["☁️ Self-hosted VPS (Coolify)"]
        MQ["Mosquitto<br/>MQTT/TLS 8883"]
        BE["NestJS backend<br/>ingest · REST · WS · alerts<br/>predictions · GOST · auth"]
        DB[("MongoDB 7<br/>time-series")]
        AI["FastAPI AI service<br/>XGBoost · CQR · decision"]
        FE["React dashboard<br/>nomogram · panels"]
    end

    USER["🧑‍💼 Operator<br/>browser"]

    ESP -- "telemetry (MQTT/TLS)" --> MQ
    MQ --> BE
    MAN -- "POST /api/readings" --> BE
    BE <--> DB
    BE -- "features" --> AI
    AI -- "RUL + interval + decision" --> BE
    BE -- "REST + WebSocket" --> FE
    FE --> USER
    USER -- "commands (thresholds)" --> BE
    BE -- "cmd topic" --> MQ
    MQ -. "control" .-> ESP

    classDef data fill:#e3f2fd,stroke:#1565c0;
    classDef ctrl fill:#fff3e0,stroke:#ed6c02;
    class ESP,MQ,BE,DB,FE,MAN data;
    class AI ctrl;
```

Only ports **443** (HTTPS/WSS) and **8883** (MQTT/TLS) are exposed publicly; the database and AI
service stay on the internal Docker network.

---

## How data flows

A single telemetry packet, from sensor to screen:

```mermaid
sequenceDiagram
    participant D as ESP32
    participant M as Mosquitto
    participant I as Ingestion
    participant DB as MongoDB
    participant A as Alerts
    participant W as WebSocket
    participant U as Dashboard

    D->>M: publish telemetry (QoS 0)<br/>{u_a,u_b,u_c,k2u,status,…}
    M->>I: deliver
    I->>I: 1️⃣ validate (JSON Schema + K₂U recompute)
    I->>DB: 2️⃣ store (time-series, idempotent on seq)
    I->>A: 3️⃣ onTelemetry(status)
    A-->>A: state-change? cooldown?
    A->>DB: persist event (WARNING/CRITICAL)
    A->>W: push event
    I->>W: push telemetry
    W->>U: live update (< 100 ms)
```

---

## The K₂U nomogram

K₂U — the **negative-sequence voltage unbalance factor** — is the single quantity the whole
platform revolves around (hence the name). It is displayed on a **polar nomogram**: the radius is
K₂U (%), the angle is the negative-sequence phase φ₂, and concentric rings mark the GOST limits.

```mermaid
flowchart TB
    A["Phase voltages<br/>Uₐ, U_b, U_c"] --> B["Line voltages<br/>U_AB, U_BC, U_CA"]
    B --> C["Symmetrical components<br/>β-method (RMS)"]
    C --> D{"K₂U %"}
    D -->|"≤ 2 %"| N["🟢 NORMAL"]
    D -->|"2–4 %"| W["🟡 WARNING"]
    D -->|"> 4 %"| X["🔴 CRITICAL"]
```

> The forward/inverse transform round-trips to `<1e-7`, and the same math is implemented in
> `packages/k2u-core` (TS), `apps/firmware/lib/k2u` (C++) and `apps/ai-service` (Python).

---

## AI: RUL prediction

An XGBoost regressor predicts relative Remaining Useful Life from 15 unbalance/thermal features,
trained on physics-generated aging trajectories (Miner's rule + Montsinger/Arrhenius thermal life).
The numbers below are the **actual results reproduced from the Scopus simulation**.

```mermaid
xychart-beta
    title "RUL model accuracy — R² on the temporal test set"
    x-axis ["XGB no-physics", "Linear", "PhysicsOnly", "RandomForest", "XGBoost (full)"]
    y-axis "R²" 0 --> 1
    bar [0.148, 0.225, 0.356, 0.400, 0.765]
```

| Metric | Value | Note |
|---|---|---|
| XGBoost R² (test) | **0.765** | PV 0.721 · telecom 0.791 |
| Ablation R² (no `cum_damage_index`) | 0.148 | physics augmentation is load-bearing |
| CQR interval `q̂` | 0.072 | calibrated 80 % coverage → 0.78 |
| Balancer-decision accuracy | **0.951** | 3-level: none / recommended / required |
| Inference | ≈ 2.2 µs/sample | |

Top features by gain: `cum_damage_index` (0.35), `exposure_2pct_30d` (0.17), `service_age` (0.10).

```mermaid
flowchart LR
    F["10-min aggregates"] --> G["Feature builder<br/>15 features"]
    G --> H["XGBoost"]
    H --> R["RUL point est."]
    H --> Q["q10 / q90 + CQR"] --> I["RUL interval"]
    R --> DEC{"Decision layer<br/>RUL × K₂U forecast"}
    I --> DEC
    DEC --> O["balancer_need<br/>+ payback (yrs)"]
```

---

## Alert state machine

Alerts fire only on GOST-band **transitions** — escalations always, recoveries after a cooldown.

```mermaid
stateDiagram-v2
    [*] --> NORMAL
    NORMAL --> WARNING: K₂U > 2%  🔔
    WARNING --> CRITICAL: K₂U > 4%  🔔
    CRITICAL --> WARNING: recover (cooldown)
    WARNING --> NORMAL: recover (cooldown)
    CRITICAL --> CRITICAL: (no repeat alert)
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Firmware | ESP32 · Arduino/PlatformIO · FreeRTOS · PZEM-004T · MQTT/TLS |
| Broker | Eclipse Mosquitto 2 (TLS + per-device ACL) |
| Database | MongoDB 7 (time-series collections) |
| Backend | NestJS 10 · TypeScript · Mongoose · WebSocket · JWT |
| Frontend | React 18 · Vite · MUI · Recharts · custom SVG nomogram |
| AI service | FastAPI · XGBoost · scikit-learn · conformal prediction |
| Infra | Docker · Docker Compose · Coolify · Traefik (auto-HTTPS) |
| Shared | `@k2u/core` (math) · `@k2u/shared-contracts` (JSON Schema + types) |

---

## Monorepo layout

```
k2u-platform/
├── apps/
│   ├── firmware/       ESP32 measurement node (PlatformIO, FreeRTOS)
│   ├── backend/        NestJS: ingestion · REST · WS · alerts · predictions · GOST · auth
│   ├── frontend/       React/MUI dashboard: nomogram · manual entry · reports
│   └── ai-service/     FastAPI: RUL (XGBoost) · CQR intervals · decision layer
├── packages/
│   ├── k2u-core/       symmetrical-components K₂U math (single source of truth)
│   └── shared-contracts/ MQTT/API JSON Schemas + TS types + topic helpers
├── infra/
│   ├── mosquitto/      broker config + ACL (+ TLS certs)
│   └── coolify/        deployment guide
├── docs/               coding plan + firmware/hardware/dashboard references
└── docker-compose.yml  full-stack local bring-up
```

---

## Quick start

**Prerequisites:** Docker, Node ≥ 20, pnpm 9.

```bash
# 1. Full stack in containers
docker compose up -d --build
#    dashboard → http://localhost:8080
#    backend   → http://localhost:3000/api/health

# 2. Feed synthetic telemetry (no ESP32 needed)
node apps/backend/tools/sim-publisher.mjs
```

Or run services individually for development:

```bash
pnpm install
docker compose up -d mongo mosquitto          # infra only
pnpm --filter @k2u/backend start:dev          # :3000
pnpm --filter @k2u/frontend dev               # :5173 (proxies /api, /ws)
```

Train the RUL model (produces the AI service artifacts):

```bash
cd apps/ai-service && pip install -r requirements.txt
python train/generate.py && python train/train.py   # → artifacts/
```

---

## Testing & verification

**61 automated tests** across the repo; the K₂U math is cross-verified in three languages.

```mermaid
pie showData
    title Automated tests by component
    "Backend (NestJS)" : 27
    "Frontend (React)" : 21
    "k2u-core (math)" : 8
    "Firmware (C++)" : 5
```

| Package | Tests | What's covered |
|---|---|---|
| `k2u-core` | 8 | balanced→0 %, 2 % synthetic recovery, forward/inverse `<1e-7`, β vs complex, line-from-phase, GOST bands |
| `backend` | 27 | telemetry validation (Ajv 2020-12), alert state-machine, feature builder, GOST verdict, scrypt auth, manual compute |
| `frontend` | 21 | K₂U mirror, nomogram geometry, CSV parser, GOST report model |
| `firmware` | 5 | native (host) K₂U β-method, line reconstruction, classification |

```bash
pnpm -r test                                  # JS/TS packages
cd apps/firmware && pio test -e native        # firmware math
```

---

## Deployment

Self-hosted on **Coolify** — one project, six resources (Mosquitto, MongoDB, AI service, backend,
frontend, Traefik). Full walkthrough + security checklist in
[`infra/coolify/README.md`](infra/coolify/README.md).

- Backend image bundles the workspace packages via webpack (`nest build --webpack`).
- Frontend image is nginx serving the Vite build and reverse-proxying `/api` + `/ws`.
- Security: TLS everywhere, per-device MQTT certs + ACL, JWT (`AUTH_REQUIRED=true`), internal-only DB, nightly backups.

---

## Roadmap

- [x] K₂U core math + shared contracts
- [x] ESP32 firmware (measure · compute · publish)
- [x] Backend: ingestion, REST/WS, alerts, predictions, GOST compliance, manual entry, JWT auth
- [x] React dashboard: nomogram, live panels, manual entry, report export
- [x] AI service: RUL + CQR + decision (reproduces paper metrics)
- [x] Docker + Coolify deployment
- [ ] Firmware store-and-forward (LittleFS) + calibration mode
- [ ] Multi-tenant / multi-site RBAC

---

<div align="center">

**Built for renewable-energy and telecom power-quality monitoring.**
Licensed under [MIT](LICENSE).

</div>

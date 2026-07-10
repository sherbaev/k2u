#!/usr/bin/env node
/**
 * sim-publisher.mjs — MQTT telemetry simulator for K2U devices.
 *
 * Publishes synthetic telemetry packets that match the
 * `@k2u/shared-contracts` Telemetry payload / topic shape, so the backend's
 * MQTT ingestion pipeline can be exercised end-to-end without real ESP32
 * hardware.
 *
 * Usage:
 *   MQTT_URL=mqtt://localhost:1883 node tools/sim-publisher.mjs
 *
 * Env vars:
 *   MQTT_URL       broker URL                          (default: mqtt://localhost:1883)
 *   SIM_PERIOD_MS  publish interval per device, in ms   (default: 10000)
 *   SIM_DEVICE_COUNT  number of simulated devices       (default: 2)
 *
 * Requires the `mqtt` npm package to be installed (e.g. `npm i mqtt` /
 * `pnpm add mqtt` in apps/backend).
 */

import mqtt from "mqtt";

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const SIM_PERIOD_MS = Number(process.env.SIM_PERIOD_MS ?? 10000);
const SIM_DEVICE_COUNT = Number(process.env.SIM_DEVICE_COUNT ?? 2);

// Mirrors packages/shared-contracts/src/topics.ts::telemetryTopic().
// Kept as a small local helper here since this script is plain ESM
// (no TypeScript, no build step) and must run standalone.
function telemetryTopic(siteId, devId) {
  return `site/${siteId}/dev/${devId}/telemetry`;
}

const TELEMETRY_QOS = 0;

// Base fleet: two representative sites/devices. If SIM_DEVICE_COUNT > 2,
// additional synthetic devices are appended.
const BASE_DEVICES = [
  { siteId: "UZT-TELECOM-01", devId: "K2U-01" },
  { siteId: "UZ-PV-01", devId: "K2U-02" },
];

function buildDeviceList(count) {
  const devices = BASE_DEVICES.slice(0, Math.max(count, 0));
  for (let i = devices.length; i < count; i += 1) {
    const n = String(i + 1).padStart(2, "0");
    devices.push({ siteId: `SIM-SITE-${n}`, devId: `K2U-${n}` });
  }
  return devices;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

// Gaussian-ish noise via sum of uniforms (cheap approximation of a normal distribution).
function noise(spread) {
  return ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2 * spread;
}

function statusFromK2u(k2u) {
  if (k2u > 4) return "CRITICAL";
  if (k2u > 2) return "WARNING";
  return "NORMAL";
}

function createDeviceState(device) {
  return {
    ...device,
    seq: 1,
    k2u: 0.5 + Math.random() * 1.5, // start comfortably in NORMAL range
    temp: 35 + Math.random() * 5,
  };
}

// Advances one device's simulated state by one tick and returns a telemetry packet.
function tick(state) {
  // Slow random-walk for k2u, occasionally nudged harder to simulate an
  // unbalance event, so NORMAL / WARNING / CRITICAL all show up over time.
  const kick = Math.random() < 0.12 ? noise(1.2) : noise(0.25);
  state.k2u = clamp(state.k2u + kick, 0.3, 5.5);

  // Slow random-walk for temperature.
  state.temp = clamp(state.temp + noise(0.8), 35, 50);

  const nominalPhaseV = 230; // V, phase-to-neutral
  const unbalanceFrac = state.k2u / 100;

  // Rough, simulator-grade approximation of an unbalanced three-phase set:
  // push phase A up and B/C down (with a little independent noise) so the
  // spread roughly tracks the target k2u percentage.
  const uA = nominalPhaseV * (1 + (2 / 3) * unbalanceFrac) + noise(0.6);
  const uB = nominalPhaseV * (1 - (1 / 3) * unbalanceFrac) + noise(0.6);
  const uC = nominalPhaseV * (1 - (1 / 3) * unbalanceFrac) + noise(0.6);

  const sqrt3 = Math.sqrt(3);
  const uAB = sqrt3 * ((uA + uB) / 2) + noise(0.5);
  const uBC = sqrt3 * ((uB + uC) / 2) + noise(0.5);
  const uCA = sqrt3 * ((uC + uA) / 2) + noise(0.5);

  const freq = clamp(50 + noise(0.05), 49.5, 50.5);
  const iA = clamp(4 + noise(0.3), 0, 20);
  const iB = clamp(4 + noise(0.3), 0, 20);
  const iC = clamp(4 + noise(0.3), 0, 20);
  const phi2 = Math.random() * 360;
  const bufFill = clamp(0.02 + Math.random() * 0.06, 0, 1);

  const packet = {
    ts: new Date().toISOString(),
    site_id: state.siteId,
    dev_id: state.devId,
    seq: state.seq,
    u_a: Number(uA.toFixed(1)),
    u_b: Number(uB.toFixed(1)),
    u_c: Number(uC.toFixed(1)),
    u_ab: Number(uAB.toFixed(1)),
    u_bc: Number(uBC.toFixed(1)),
    u_ca: Number(uCA.toFixed(1)),
    k2u: Number(state.k2u.toFixed(2)),
    phi2: Number(phi2.toFixed(1)),
    freq: Number(freq.toFixed(2)),
    i_a: Number(iA.toFixed(2)),
    i_b: Number(iB.toFixed(2)),
    i_c: Number(iC.toFixed(2)),
    temp: Number(state.temp.toFixed(1)),
    status: statusFromK2u(state.k2u),
    buf_fill: Number(bufFill.toFixed(2)),
    source: "device",
  };

  state.seq += 1;
  return packet;
}

function main() {
  const devices = buildDeviceList(SIM_DEVICE_COUNT).map(createDeviceState);

  console.log(
    `[sim-publisher] connecting to ${MQTT_URL} | devices=${devices.length} | period=${SIM_PERIOD_MS}ms`,
  );

  const client = mqtt.connect(MQTT_URL);
  let timer;

  client.on("connect", () => {
    console.log("[sim-publisher] connected");

    const publishAll = () => {
      for (const state of devices) {
        const packet = tick(state);
        const topic = telemetryTopic(state.siteId, state.devId);
        client.publish(topic, JSON.stringify(packet), { qos: TELEMETRY_QOS }, (err) => {
          if (err) {
            console.error(`[${state.devId}] publish error: ${err.message}`);
            return;
          }
          console.log(
            `[${state.devId}] seq=${packet.seq} k2u=${packet.k2u}% status=${packet.status}`,
          );
        });
      }
    };

    publishAll();
    timer = setInterval(publishAll, SIM_PERIOD_MS);
  });

  client.on("error", (err) => {
    console.error(`[sim-publisher] connection error: ${err.message}`);
  });

  function shutdown() {
    console.log("\n[sim-publisher] shutting down...");
    if (timer) clearInterval(timer);
    client.end(false, {}, () => {
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();

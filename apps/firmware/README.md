# firmware — ESP32 K₂U measurement node

Measures three phase-neutral voltages (3× PZEM-004T on a shared Modbus bus),
derives line voltages, computes K₂U (RMS β-method) + GOST classification, and
publishes MQTT/TLS telemetry to the Coolify platform. See `docs/FIRMWARE_PLAN.md`
and `docs/HARDWARE_BOM.md`.

## Build & flash (PlatformIO)

```bash
cp include/secrets.h.example include/secrets.h   # fill WiFi/MQTT/TLS
pio run -e esp32dev -t upload
pio device monitor
```

## Test the math on the host (no hardware)

```bash
pio test -e native
```

The K₂U math (`lib/k2u`) is hardware-independent and identical to
`packages/k2u-core`. It is **verified**: balanced→0 %, a 2 % synthetic set
recovers to within 0.0003 %, 4.5 %→CRITICAL, degenerate→NaN.

## Structure

- `platformio.ini` — pinned toolchain + libraries (reproducible for the DGU/thesis).
- `include/config.h` — identity, thresholds, periods, pin map (from HARDWARE_BOM).
- `include/secrets.h.example` — WiFi/MQTT creds + broker CA (copy to `secrets.h`, gitignored).
- `lib/k2u/` — β-method, line-from-phase (nominal 120°), GOST classify. Host-unit-tested.
- `src/main.cpp` — FreeRTOS tasks: Measure (1 Hz, validate + median filter) → Compute
  (K₂U + classify) → Telemetry (10 s MQTT publish) → Display (OLED) → Watchdog.
- `test/test_native/` — Unity tests for `lib/k2u`.

## Safety

380 V mains taps must be done by a licensed electrician with the panel
de-energised, behind a 3-pole breaker + fuses. Develop on a low-voltage bench
(single 220 V phase or variac) before any 3-phase connection.

## Notes / TODO (from FIRMWARE_PLAN)

- Store-and-forward: 10-min aggregates buffered in a LittleFS ring buffer, replayed
  at QoS 1 on reconnect. `main.cpp` publishes live telemetry; the LittleFS queue is
  the next increment.
- Per-channel calibration `(k, b)` in NVS, settable over the `cmd` topic / serial
  `CALIB` mode (feeds the thesis §2.5 accuracy tables).
- PZEM shared-bus addresses (0x01/0x02/0x03) are set once with a USB-TTL adapter.

# ESP32 firmware plan — K₂U measurement node

Firmware for the measurement node: read three **phase-to-neutral** voltages from 3× PZEM-004T,
derive line voltages, compute **K₂U + φ₂**, classify against GOST 32144-2013 (2 %/4 %), and
publish over **MQTT/TLS** to the Coolify platform, with **store-and-forward** when offline.

Consistent with BOB II of the thesis and `HARDWARE_BOM.md` / `DASHBOARD_PLAN.md`.

---

## 1. Toolchain & libraries

| Item | Choice |
|---|---|
| Framework | Arduino-ESP32 (via **PlatformIO** — reproducible builds, easy CI) |
| RTOS | FreeRTOS (built into ESP32 Arduino core) |
| PZEM driver | `mandulaj/PZEM-004T-v30` |
| MQTT | `knolleary/PubSubClient` (or `256dpi/arduino-mqtt`) over `WiFiClientSecure` (TLS) |
| JSON | `bblanchon/ArduinoJson` |
| RTC | `adafruit/RTClib` (DS3231) |
| OLED | `adafruit/SSD1306` + GFX |
| Time | built-in SNTP (`configTime`) + DS3231 fallback |

`platformio.ini` pins exact library versions so the build is reproducible for the DGU/thesis.

---

## 2. Repository layout (`firmware/`)

```
firmware/
  platformio.ini
  include/
    config.h            # site_id, dev_id, thresholds, periods, pins
    secrets.h           # WiFi creds, MQTT host, TLS certs  (gitignored)
  src/
    main.cpp            # setup(): init peripherals, create tasks
    tasks/
      MeasureTask.cpp    # read PZEMs, derive line voltages, filter
      ComputeTask.cpp    # K₂U + φ₂, GOST classify, 10-min aggregate, events
      TelemetryTask.cpp  # JSON build, MQTT publish, store-and-forward
      DisplayTask.cpp    # OLED readout
      WatchdogTask.cpp   # heartbeats, WiFi/MQTT health, reboot
    lib/
      k2u.cpp/.h         # symmetrical-components math (unit-testable, no HW deps)
      pzem_bus.cpp/.h     # 3-meter Modbus wrapper
      ringbuffer.cpp/.h   # flash-backed store-and-forward queue
      net.cpp/.h          # WiFi + MQTT(TLS) connect/reconnect
  test/                  # native unit tests for k2u.cpp (pio test)
```

Keeping `k2u.cpp` hardware-independent lets you **unit-test the math on the host** (`pio test -e native`) — proves forward/inverse consistency to machine precision, same as the nomogram README.

---

## 3. Pinout (matches HARDWARE_BOM.md)

| Signal | ESP32 pin | Notes |
|---|---|---|
| PZEM bus TX/RX | UART2: GPIO17 / GPIO16 | through 5 V↔3.3 V level shifter |
| I²C SDA / SCL | GPIO21 / GPIO22 | DS3231 (0x68) + OLED (0x3C) |
| Status LED | GPIO2 | onboard |

PZEM wiring: **shared Modbus bus, 3 slave addresses** (0x01/0x02/0x03 — set once with the USB-TTL
tool). Each PZEM voltage tap = phase↔neutral (L1-N, L2-N, L3-N, ~220 V).

---

## 4. FreeRTOS task model (from BOB II §2.3)

| Task | Priority | Period | Job |
|---|---|---|---|
| MeasureTask | 4 | Δt_s = 1 s | poll 3 PZEMs (U_A,U_B,U_C, currents), validate 180–260 V, median-filter, derive U_AB=U_A−U_B… |
| ComputeTask | 3 | 1 s | K₂U + φ₂; classify NORMAL/WARNING/CRITICAL; update 10-min aggregate; emit threshold events |
| TelemetryTask | 2 | T_tx = 10 s | build JSON; MQTT publish (QoS 0 telemetry, QoS 1 aggregate/alert); flush ring-buffer on reconnect |
| DisplayTask | 1 | 1 s | OLED: U_A/U_B/U_C, K₂U %, status |
| WatchdogTask | 1 | 30 s | check task heartbeats + WiFi/MQTT; reboot on hang (esp_task_wdt) |

Shared state passed via a mutex-protected struct + FreeRTOS queues. Aggregation windows are
**RTC-aligned** (00,10,20… min) so multiple devices are comparable.

---

## 5. Core math (`k2u.cpp`)

Inputs: line voltages U_AB, U_BC, U_CA (derived from measured phase voltages). RMS-only method
(IEC 61000-4-30), no phase angles needed:

```
β   = (U_AB⁴+U_BC⁴+U_CA⁴) / (U_AB²+U_BC²+U_CA²)²
K2U = sqrt((1−sqrt(3−6β)) / (1+sqrt(3−6β))) · 100 %    // clamp β to [1/3, 1/2)
```

Bonus (4-wire): since phase voltages are measured directly, also expose K₀U (zero-sequence) for
diagnostics. φ₂ approximated from the three magnitudes (triangle reconstruction); exact φ₂ only in
the optional B-variant (synchronous sampling) — out of scope for v1.

---

## 6. MQTT topics & JSON (from BOB II §2.4)

Topics: `site/{siteId}/dev/{devId}/{telemetry|aggregate|alert|cmd|ack}`.
TLS on 8883, per-device credentials + ACL.

Telemetry packet (every 10 s):
```json
{ "ts":"...","site_id":"UZT-TELECOM-01","dev_id":"K2U-01","seq":123,
  "u_a":229.1,"u_b":225.4,"u_c":231.0,"u_ab":394.2,"u_bc":391.8,"u_ca":398.6,
  "k2u":1.62,"phi2":137.5,"freq":50.0,"i_a":4.1,"i_b":3.8,"i_c":4.4,
  "temp":41.3,"status":"NORMAL","buf_fill":0.04 }
```

---

## 7. Store-and-forward

Flash-backed ring buffer (LittleFS / NVS, 4096 records). 10-min aggregates are persisted; on MQTT
reconnect they're replayed in order at QoS 1. Raw 10 s telemetry is not buffered (trend data, OK to
drop). Reconnect uses exponential backoff (1,2,4…64 s); `clean_session=false`.

---

## 8. Calibration hooks (feeds BOB II §2.5)

- Per-channel linear correction `(k, b)` stored in NVS; settable over the `cmd` topic or serial.
- A `CALIB` serial mode prints raw vs reference for the 5-point comparison against the etalon meter.
- Records the fields the thesis placeholders need: voltage error %, K₂U abs error, 7-day correlation.

---

## 9. Build milestones (in order)

1. **Blink + Wi-Fi + SNTP** — board alive, time synced, DS3231 set.
2. **One PZEM** over UART2 — read & print U/I/P.
3. **Three PZEMs** on the shared bus (addresses 0x01–0x03).
4. **k2u.cpp + unit tests** — verify against known cases (balanced → 0 %, a 2 % synthetic case).
5. **MeasureTask + ComputeTask** — live K₂U on serial + OLED.
6. **MQTT/TLS publish** to the Coolify Mosquitto → confirm docs land in MongoDB.
7. **10-min aggregate + events** (threshold crossings).
8. **Store-and-forward** — pull the antenna, confirm queue + replay.
9. **WatchdogTask + reliability** — survive Wi-Fi loss, broker loss, power cycle.
10. **Calibration mode** + field deploy to the two test sites.

---

## 10. Safety (carry over from BOM)

380 V mains taps by a licensed electrician, panel de-energised, behind a 3-pole breaker + fuses.
Develop steps 1–8 on a **low-voltage bench** (a single 220 V phase or a variac) before any
3-phase connection.

---

## 11. Open choices

1. **PZEM bus**: shared 3-address (recommended) vs 3 separate UARTs — confirm before wiring.
2. **Flash FS**: LittleFS (file-like, easy) vs NVS (key-value) for the ring buffer — recommend LittleFS.
3. **OTA updates**: include ArduinoOTA in v1, or defer to v2? (recommend defer.)

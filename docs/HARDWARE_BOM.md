# Hardware shopping list — K₂U asymmetry measurement node

Target: measure three **phase-to-neutral** voltages (~220 V each) on a **4-wire 380/220 V**
three-phase supply, compute K₂U + phase angle on an ESP32, show locally, and publish over
Wi-Fi/MQTT to the Coolify dashboard.

You have two test sites (telecom tower + 3-phase home solar inverter). The list below is **per
node**. Build **2 nodes** to test both sites at once, or build 1 and move it between sites.

---

## Why phase-to-neutral (read this before wiring)

- PZEM-004T measures up to **260 V AC** → it fits a 220 V phase-to-neutral tap, **not** a 380 V
  line-to-line tap. So connect each PZEM between one phase (L1/L2/L3) and **neutral (N)**.
- From the three phase voltages U_A, U_B, U_C you compute the symmetrical components and K₂U
  directly (and you also get zero-sequence K₀U for free — a bonus over a line-voltage-only setup).
- **380 V three-phase is lethal.** All taps must be done by a licensed electrician with the panel
  de-energised, behind a 3-pole breaker + fuses. Develop/test the ESP32 logic at low voltage first.

---

## Core measurement node (per unit)

| # | Component | Model / spec | Qty | Purpose | Approx. USD |
|---|---|---|---|---|---|
| 1 | Microcontroller | ESP32-WROOM-32 DevKit V1 | 1 | K₂U compute, Wi-Fi, MQTT | 6 |
| 2 | Voltage/power meter | PZEM-004T **v3.0** (with 100 A CT clamp) | 3 | one per phase: V, I, P, freq via UART | 3 × 9 = 27 |
| 3 | Real-time clock | DS3231 module | 1 | accurate timestamps when NTP is down | 2 |
| 4 | Local display (optional) | 0.96″ OLED SSD1306 (I²C) | 1 | show U, K₂U, status on-site | 3 |
| 5 | Logic level shifter | 4-channel bidirectional (TXS0108 / BSS138) | 1 | PZEM TTL is 5 V, ESP32 is 3.3 V | 2 |
| 6 | Node power supply | HLK-PM01 (220 V→5 V, 3 W) | 1 | powers ESP32 + peripherals, isolated | 3 |
| 7 | Buck/LDO (if needed) | AMS1117 3.3 V or MP1584 | 1 | clean 3.3 V rail | 1 |

**Node electronics subtotal: ≈ $46**

---

## Enclosure, protection & wiring (per unit)

| # | Component | Spec | Qty | Purpose | Approx. USD |
|---|---|---|---|---|---|
| 8 | Enclosure | IP65 DIN / wall box, ~200×150×80 mm | 1 | field protection | 8 |
| 9 | 3-pole MCB | C-curve, 6 A | 1 | isolate the voltage taps | 5 |
| 10 | Fuses + holders | 1 A, one per phase tap | 3 | tap protection | 3 |
| 11 | Terminal blocks | DIN rail, for L1/L2/L3/N | 1 set | safe terminations | 4 |
| 12 | Ferrules + wire | 1.0–1.5 mm² stranded, ferruled | 1 set | mains wiring | 4 |
| 13 | Dupont jumpers | M-M, M-F | 1 set | signal wiring | 2 |
| 14 | DIN rail | short length | 1 | mounting | 2 |

**Enclosure/protection subtotal: ≈ $28**

---

## Tools / one-time (not per node)

| # | Item | Purpose | Approx. USD |
|---|---|---|---|
| T1 | USB-TTL adapter (CP2102/FT232) | PZEM address-setting & calibration | 4 |
| T2 | Multimeter (true-RMS) | calibration reference / safety checks | — (have one) |
| T3 | Reference: clamp/PQ meter or known-good voltmeter | metrology comparison for the thesis | borrow/lab |

---

## Per-node total

| Bucket | USD |
|---|---|
| Electronics | ~46 |
| Enclosure + protection | ~28 |
| **Per node** | **~74** |
| **Two nodes** | **~148** + ~$4 tools |

(Industrial IEC 61000-4-30 analyzers are thousands of dollars per point — this keeps your
"two orders of magnitude cheaper" claim in the thesis honest.)

---

## Wiring the 3 PZEMs to one ESP32 (two options)

PZEM-004T v3.0 speaks **Modbus-RTU over 5 V TTL** and supports a **settable slave address**.

- **Option A (recommended) — shared bus, 3 addresses.** Set the three meters to addresses
  0x01, 0x02, 0x03 (one-time, via USB-TTL + T1). Wire all three on one UART through the level
  shifter; poll by address. Cleanest, fewest pins.
- **Option B — separate UARTs.** ESP32 has 2 free hardware UARTs (UART1, UART2) + 1 SoftwareSerial.
  One PZEM per port. Simpler firmware, more wiring.

Each PZEM: **voltage tap = phase↔neutral** (L1-N, L2-N, L3-N). The included CT clamp goes around
the same phase conductor if you also want current/power (useful — feeds the `load_factor` and
`thermal` features of the RUL model). Voltage-only is enough for pure K₂U.

---

## Notes specific to your two sites

- **Telecom tower:** 4-wire 380/220 V, main loads = rectifier modules + AC. Tap L1/L2/L3/N at the
  incoming distribution board. Confirm there's a neutral (there almost always is).
- **Home 3-phase solar inverter:** tap the three phases + neutral at the inverter's AC connection
  point or the house's 3-phase incomer. Confirm the inverter is grid-tied 380 V (you confirmed it is).

---

## Where to buy

- **AliExpress / global:** ESP32, PZEM-004T v3.0, DS3231, OLED, level shifter, HLK-PM01 — search by
  exact model strings above.
- **Local (Uzbekistan) electrical suppliers:** MCB, fuses, terminal blocks, ferrules, enclosure,
  DIN rail — buy locally; cheaper and faster than importing, and you want proper-rated parts for mains.

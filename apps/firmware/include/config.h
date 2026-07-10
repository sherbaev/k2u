#pragma once
// Node identity, thresholds, periods and pin map. Non-secret configuration.
// Secrets (WiFi/MQTT creds, TLS certs) live in secrets.h (gitignored).

// ---- identity ----
#define SITE_ID "UZT-TELECOM-01"
#define DEV_ID  "K2U-01"

// ---- GOST 32144-2013 thresholds (percent) ----
#define K2U_NORMAL_PCT 2.0f
#define K2U_MAX_PCT    4.0f

// ---- timing ----
#define MEASURE_PERIOD_MS   1000    // poll PZEMs @ 1 Hz
#define TELEMETRY_PERIOD_MS 10000   // publish telemetry @ 0.1 Hz
#define AGG_WINDOW_MS       600000  // 10-minute RTC-aligned aggregate
#define WATCHDOG_PERIOD_MS  30000

// ---- validation bounds (phase-neutral RMS, volts) ----
#define U_MIN_V 180.0f
#define U_MAX_V 260.0f

// ---- pin map (matches HARDWARE_BOM.md) ----
#define PZEM_RX_PIN 16   // UART2 RX (from level shifter)
#define PZEM_TX_PIN 17   // UART2 TX
#define I2C_SDA_PIN 21   // DS3231 (0x68) + SSD1306 (0x3C)
#define I2C_SCL_PIN 22
#define STATUS_LED_PIN 2

// ---- PZEM shared-bus slave addresses (one per phase) ----
#define PZEM_ADDR_A 0x01
#define PZEM_ADDR_B 0x02
#define PZEM_ADDR_C 0x03

// ---- store-and-forward ----
#define RINGBUFFER_CAPACITY 4096

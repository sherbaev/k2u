/**
 * ESP32 K2U measurement node.
 *
 * Reads three phase-neutral RMS voltages from 3x PZEM-004T (shared Modbus bus,
 * addresses 0x01/0x02/0x03), derives line voltages, computes K2U (RMS beta
 * method) + GOST classification, and publishes MQTT/TLS telemetry to the
 * Coolify platform. FreeRTOS task model per docs/FIRMWARE_PLAN.md.
 *
 * The K2U math lives in lib/k2u (hardware-independent, unit-tested on host).
 */
#include <Arduino.h>
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <PZEM004Tv30.h>
#include <RTClib.h>
#include <Adafruit_SSD1306.h>
#include <time.h>

#include "config.h"
#include "secrets.h"
#include "k2u.h"

// ------------------------------------------------------------------ globals
static HardwareSerial PzemSerial(2);  // UART2
static PZEM004Tv30 pzemA(PzemSerial, PZEM_RX_PIN, PZEM_TX_PIN, PZEM_ADDR_A);
static PZEM004Tv30 pzemB(PzemSerial, PZEM_RX_PIN, PZEM_TX_PIN, PZEM_ADDR_B);
static PZEM004Tv30 pzemC(PzemSerial, PZEM_RX_PIN, PZEM_TX_PIN, PZEM_ADDR_C);

static RTC_DS3231 rtc;
static Adafruit_SSD1306 oled(128, 64, &Wire, -1);
static WiFiClientSecure netClient;
static PubSubClient mqtt(netClient);

struct Shared {
  float ua, ub, uc;         // phase-neutral RMS
  float uab, ubc, uca;      // derived line voltages
  float ia, ib, ic, freq, temp;
  float k2u;
  k2u::Status status;
  uint32_t seq;
  bool valid;
};
static Shared g{};
static SemaphoreHandle_t gMutex;

// --------------------------------------------------------------- utilities
static void isoTimestamp(char* buf, size_t n) {
  if (rtc.begin() && rtc.now().isValid()) {
    DateTime t = rtc.now();
    snprintf(buf, n, "%04d-%02d-%02dT%02d:%02d:%02d+05:00",
             t.year(), t.month(), t.day(), t.hour(), t.minute(), t.second());
    return;
  }
  time_t now = time(nullptr);
  struct tm tm_now;
  gmtime_r(&now, &tm_now);
  strftime(buf, n, "%Y-%m-%dT%H:%M:%SZ", &tm_now);
}

static float median3(float a, float b, float c) {
  if ((a >= b && a <= c) || (a <= b && a >= c)) return a;
  if ((b >= a && b <= c) || (b <= a && b >= c)) return b;
  return c;
}

static void connectWifi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) delay(250);
  configTime(5 * 3600, 0, "pool.ntp.org", "time.google.com");  // UTC+5
}

static bool connectMqtt() {
  netClient.setCACert(MQTT_ROOT_CA);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(1024);
  if (mqtt.connected()) return true;
  return mqtt.connect(DEV_ID, MQTT_USER, MQTT_PASS);
}

// --------------------------------------------------------------- tasks
static void MeasureTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(MEASURE_PERIOD_MS);
  // simple median filter over 3 samples per phase
  float bufA[3] = {220, 220, 220}, bufB[3] = {220, 220, 220}, bufC[3] = {220, 220, 220};
  uint8_t k = 0;
  for (;;) {
    float ua = pzemA.voltage(), ub = pzemB.voltage(), uc = pzemC.voltage();
    float ia = pzemA.current(), ib = pzemB.current(), ic = pzemC.current();
    float f = pzemA.frequency();
    bool ok = !isnan(ua) && !isnan(ub) && !isnan(uc) &&
              ua > U_MIN_V && ua < U_MAX_V &&
              ub > U_MIN_V && ub < U_MAX_V &&
              uc > U_MIN_V && uc < U_MAX_V;
    if (ok) {
      bufA[k] = ua; bufB[k] = ub; bufC[k] = uc; k = (k + 1) % 3;
      float mua = median3(bufA[0], bufA[1], bufA[2]);
      float mub = median3(bufB[0], bufB[1], bufB[2]);
      float muc = median3(bufC[0], bufC[1], bufC[2]);
      float uab, ubc, uca;
      k2u::line_from_phase_nominal(mua, mub, muc, &uab, &ubc, &uca);
      if (xSemaphoreTake(gMutex, portMAX_DELAY)) {
        g.ua = mua; g.ub = mub; g.uc = muc;
        g.uab = uab; g.ubc = ubc; g.uca = uca;
        g.ia = ia; g.ib = ib; g.ic = ic;
        g.freq = isnan(f) ? 0 : f;
        g.temp = temperatureRead();  // ESP32 internal; replace with sensor if fitted
        g.valid = true;
        xSemaphoreGive(gMutex);
      }
    }
    vTaskDelay(period);
  }
}

static void ComputeTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(MEASURE_PERIOD_MS);
  for (;;) {
    if (xSemaphoreTake(gMutex, portMAX_DELAY)) {
      if (g.valid) {
        g.k2u = k2u::beta_method(g.uab, g.ubc, g.uca);
        g.status = k2u::classify(g.k2u);
      }
      xSemaphoreGive(gMutex);
    }
    vTaskDelay(period);
  }
}

static void publishTelemetry() {
  Shared s;
  if (!xSemaphoreTake(gMutex, portMAX_DELAY)) return;
  s = g;
  g.seq++;
  xSemaphoreGive(gMutex);
  if (!s.valid) return;

  char ts[40];
  isoTimestamp(ts, sizeof(ts));

  JsonDocument doc;
  doc["ts"] = ts;
  doc["site_id"] = SITE_ID;
  doc["dev_id"] = DEV_ID;
  doc["seq"] = s.seq;
  doc["u_a"] = s.ua; doc["u_b"] = s.ub; doc["u_c"] = s.uc;
  doc["u_ab"] = s.uab; doc["u_bc"] = s.ubc; doc["u_ca"] = s.uca;
  doc["k2u"] = s.k2u;
  doc["freq"] = s.freq;
  doc["i_a"] = s.ia; doc["i_b"] = s.ib; doc["i_c"] = s.ic;
  doc["temp"] = s.temp;
  doc["status"] = k2u::status_name(s.status);
  doc["source"] = "device";

  char payload[512];
  size_t n = serializeJson(doc, payload, sizeof(payload));
  char topic[96];
  snprintf(topic, sizeof(topic), "site/%s/dev/%s/telemetry", SITE_ID, DEV_ID);

  if (mqtt.connected()) {
    mqtt.publish(topic, (const uint8_t*)payload, n, false);  // QoS 0 telemetry
  }
  // NOTE: 10-min aggregates use a LittleFS-backed ring buffer with QoS-1 replay
  // on reconnect (store-and-forward) — see FIRMWARE_PLAN §7. Raw telemetry may drop.
}

static void TelemetryTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(TELEMETRY_PERIOD_MS);
  for (;;) {
    if (WiFi.status() != WL_CONNECTED) connectWifi();
    if (!mqtt.connected()) connectMqtt();
    mqtt.loop();
    publishTelemetry();
    vTaskDelay(period);
  }
}

static void DisplayTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(MEASURE_PERIOD_MS);
  for (;;) {
    Shared s;
    if (xSemaphoreTake(gMutex, portMAX_DELAY)) { s = g; xSemaphoreGive(gMutex); }
    oled.clearDisplay();
    oled.setTextSize(1);
    oled.setTextColor(SSD1306_WHITE);
    oled.setCursor(0, 0);
    oled.printf("Ua %.1f Ub %.1f\nUc %.1f\n", s.ua, s.ub, s.uc);
    oled.printf("K2U %.2f%%\n%s", s.k2u, k2u::status_name(s.status));
    oled.display();
    vTaskDelay(period);
  }
}

static void WatchdogTask(void*) {
  const TickType_t period = pdMS_TO_TICKS(WATCHDOG_PERIOD_MS);
  for (;;) {
    digitalWrite(STATUS_LED_PIN, !digitalRead(STATUS_LED_PIN));
    if (WiFi.status() != WL_CONNECTED) WiFi.reconnect();
    vTaskDelay(period);
  }
}

// --------------------------------------------------------------- setup
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED_PIN, OUTPUT);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  rtc.begin();
  PzemSerial.begin(9600, SERIAL_8N1, PZEM_RX_PIN, PZEM_TX_PIN);

  connectWifi();
  connectMqtt();

  gMutex = xSemaphoreCreateMutex();

  xTaskCreatePinnedToCore(MeasureTask, "measure", 4096, nullptr, 4, nullptr, 1);
  xTaskCreatePinnedToCore(ComputeTask, "compute", 4096, nullptr, 3, nullptr, 1);
  xTaskCreatePinnedToCore(TelemetryTask, "telemetry", 8192, nullptr, 2, nullptr, 0);
  xTaskCreatePinnedToCore(DisplayTask, "display", 4096, nullptr, 1, nullptr, 0);
  xTaskCreatePinnedToCore(WatchdogTask, "watchdog", 2048, nullptr, 1, nullptr, 0);
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));  // all work happens in tasks
}

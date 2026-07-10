import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  Divider,
  Alert,
  AlertTitle,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
} from "@mui/material";
import {
  Cpu,
  Cable,
  Wifi,
  ShieldAlert,
  Settings2,
  Radio,
  PenLine,
  ArrowRight,
  Gauge,
  ListChecks,
} from "lucide-react";

const CORE_COMPONENTS = [
  { model: "ESP32-WROOM-32 DevKit V1", qty: "1", purpose: "K₂U compute, Wi-Fi, MQTT", price: "6" },
  { model: "PZEM-004T v3.0 (with 100 A CT clamp)", qty: "3", purpose: "one per phase: V, I, P, freq via UART", price: "27" },
  { model: "DS3231 RTC module", qty: "1", purpose: "accurate timestamps when NTP is down", price: "2" },
  { model: "0.96″ OLED SSD1306 (I²C)", qty: "1", purpose: "local readout: U, K₂U, status", price: "3" },
  { model: "4-channel logic level shifter (TXS0108 / BSS138)", qty: "1", purpose: "PZEM TTL is 5 V, ESP32 is 3.3 V", price: "2" },
  { model: "HLK-PM01 (220 V→5 V, 3 W)", qty: "1", purpose: "isolated power for ESP32 + peripherals", price: "3" },
  { model: "AMS1117 3.3 V or MP1584 buck/LDO", qty: "1", purpose: "clean 3.3 V rail (if needed)", price: "1" },
];

const ENCLOSURE_COMPONENTS = [
  { model: "IP65 DIN / wall box, ~200×150×80 mm", qty: "1", purpose: "field protection", price: "8" },
  { model: "3-pole MCB, C-curve, 6 A", qty: "1", purpose: "isolate the voltage taps", price: "5" },
  { model: "Fuses + holders, 1 A", qty: "3", purpose: "one per phase tap", price: "3" },
  { model: "DIN rail terminal blocks", qty: "1 set", purpose: "safe terminations for L1/L2/L3/N", price: "4" },
  { model: "Ferrules + 1.0–1.5 mm² stranded wire", qty: "1 set", purpose: "mains wiring", price: "4" },
  { model: "Dupont jumpers, M-M / M-F", qty: "1 set", purpose: "signal wiring", price: "2" },
  { model: "DIN rail (short length)", qty: "1", purpose: "mounting", price: "2" },
];

const PIN_MAP = [
  { signal: "PZEM bus TX / RX", pin: "UART2: GPIO17 / GPIO16", notes: "through a 5 V ↔ 3.3 V level shifter" },
  { signal: "I²C SDA / SCL", pin: "GPIO21 / GPIO22", notes: "DS3231 (0x68) + OLED (0x3C)" },
  { signal: "Status LED", pin: "GPIO2", notes: "onboard LED, heartbeat / fault indicator" },
];

const WIRING_STEPS = [
  "Set the three PZEM-004T units to Modbus slave addresses 0x01, 0x02 and 0x03 — one-time, via a USB-TTL adapter (CP2102/FT232).",
  "Wire all three PZEMs in parallel onto one shared Modbus/TTL bus (recommended over 3 separate UARTs — fewer pins, same firmware poll loop).",
  "Route that bus through the 4-channel logic level shifter into ESP32 UART2 — GPIO17 (TX) / GPIO16 (RX). PZEM TTL is 5 V; the ESP32 is 3.3 V logic.",
  "Wire the DS3231 RTC and the OLED display on the shared I²C bus — GPIO21 (SDA) / GPIO22 (SCL).",
  "At the distribution board, tap each PZEM's voltage input across one phase and neutral: L1–N, L2–N, L3–N (~220 V each) — never line-to-line (380 V exceeds the PZEM's 260 V rating).",
  "Optional: thread the included CT clamp around the same phase conductor to also capture current/power (feeds the RUL model's load-factor features).",
  "Power the ESP32 and peripherals from an isolated 220 V→5 V supply (HLK-PM01), with a clean 3.3 V rail (AMS1117/MP1584) for the logic side.",
];

function fmtUsd(n) {
  return `$${n}`;
}

function priceRows(rows) {
  return rows.reduce((sum, r) => sum + Number(r.price), 0);
}

const TELEMETRY_JSON = `{
  "ts": "2026-07-10T09:12:03Z",
  "site_id": "UZT-TELECOM-01",
  "dev_id": "K2U-01",
  "seq": 123,
  "u_a": 229.1, "u_b": 225.4, "u_c": 231.0,
  "u_ab": 394.2, "u_bc": 391.8, "u_ca": 398.6,
  "k2u": 1.62, "phi2": 137.5, "freq": 50.0,
  "i_a": 4.1, "i_b": 3.8, "i_c": 4.4,
  "temp": 41.3, "status": "NORMAL", "buf_fill": 0.04
}`;

const FLASH_STEPS = `cd firmware
cp include/secrets.h.example include/secrets.h
# edit include/secrets.h with your Wi-Fi + MQTT credentials

pio run -e esp32dev -t upload
pio device monitor`;

function CodeBlock({ children }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.75,
        borderRadius: 2,
        bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.04)" : "rgba(15,23,42,0.035)"),
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        fontSize: "0.8rem",
        lineHeight: 1.6,
        overflowX: "auto",
        whiteSpace: "pre",
      }}
    >
      {children}
    </Paper>
  );
}

function SectionHeading({ icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 1.5 }}>
      <Box
        sx={{
          width: 38,
          height: 38,
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "primary.main",
          backgroundImage: "linear-gradient(135deg, #155e9c, #0f8b8d)",
          color: "#fff",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.25 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
    </Stack>
  );
}

function BomTable({ rows }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)") } }}>
            <TableCell>Component / model</TableCell>
            <TableCell align="center">Qty</TableCell>
            <TableCell>Purpose</TableCell>
            <TableCell align="right">Approx. USD</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.model} hover>
              <TableCell sx={{ fontWeight: 500 }}>{r.model}</TableCell>
              <TableCell align="center">{r.qty}</TableCell>
              <TableCell>
                <Typography variant="body2" color="text.secondary">
                  {r.purpose}
                </Typography>
              </TableCell>
              <TableCell align="right">{fmtUsd(r.price)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function Setup() {
  const navigate = useNavigate();
  const electronicsTotal = priceRows(CORE_COMPONENTS);
  const enclosureTotal = priceRows(ENCLOSURE_COMPONENTS);
  const perNodeTotal = electronicsTotal + enclosureTotal;

  return (
    <Box sx={{ maxWidth: 1080, mx: "auto" }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.75} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "primary.main",
              backgroundImage: "linear-gradient(135deg, #155e9c, #0f8b8d)",
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <Cpu size={22} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              Hardware &amp; setup — connect an ESP32 node
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Build a measurement node, wire it safely, flash the firmware, and point it at this deployment.
            </Typography>
          </Box>
        </Stack>
        <Chip size="small" variant="outlined" label="~$74 / node" />
      </Stack>

      {/* Intro */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<Cpu size={19} />}
            title="What is a measurement node?"
            subtitle="One ESP32 + three PZEM-004T meters, reading a full 4-wire 380/220 V three-phase supply."
          />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Each node measures the three <strong>phase-to-neutral</strong> voltages (U_A, U_B, U_C,
            ~220 V each) with one PZEM-004T per phase, derives the line voltages, and computes{" "}
            <strong>K₂U</strong> (negative-sequence voltage unbalance) and the phase angle φ₂ on the
            ESP32 in real time. It classifies the result against GOST 32144-2013 (2% normal / 4%
            max), shows it locally on an OLED, and publishes it over Wi-Fi/MQTT to this dashboard —
            for about two orders of magnitude less than a commercial power-quality analyzer.
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip size="small" icon={<Gauge size={13} />} label="3× PZEM-004T v3.0" />
            <Chip size="small" icon={<Radio size={13} />} label="Wi-Fi + MQTT" />
            <Chip size="small" label="GOST 32144-2013 classification" />
            <Chip size="small" label="K₂U + φ₂ on-device" />
          </Stack>
        </CardContent>
      </Card>

      {/* BOM */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<ListChecks size={19} />}
            title="Bill of materials (per node)"
            subtitle="Everything needed for one measurement node — build two to test both sites at once."
          />

          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            Core electronics — subtotal {fmtUsd(electronicsTotal)}
          </Typography>
          <Box sx={{ mb: 2, mt: 0.75 }}>
            <BomTable rows={CORE_COMPONENTS} />
          </Box>

          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            Enclosure, protection &amp; wiring — subtotal {fmtUsd(enclosureTotal)}
          </Typography>
          <Box sx={{ mb: 2, mt: 0.75 }}>
            <BomTable rows={ENCLOSURE_COMPONENTS} />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between" alignItems={{ sm: "center" }}>
            <Typography variant="body2" color="text.secondary">
              One-time tools (not per node): USB-TTL adapter for PZEM address-setting (~$4), a
              true-RMS multimeter, and ideally a reference meter for metrology comparison.
            </Typography>
            <Chip
              label={`Per node: ${fmtUsd(perNodeTotal)}`}
              color="primary"
              sx={{ fontWeight: 700, fontSize: "0.9rem", py: 2 }}
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Wiring */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<Cable size={19} />}
            title="Wiring"
            subtitle="Shared Modbus bus for the 3 PZEMs, I²C for RTC + display, phase-to-neutral taps only."
          />

          <List sx={{ py: 0 }}>
            {WIRING_STEPS.map((step, i) => (
              <ListItem key={i} alignItems="flex-start" sx={{ px: 0, py: 0.75 }}>
                <ListItemAvatar sx={{ minWidth: 40 }}>
                  <Avatar sx={{ width: 26, height: 26, fontSize: "0.8rem", bgcolor: "primary.main" }}>
                    {i + 1}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText primary={<Typography variant="body2">{step}</Typography>} />
              </ListItem>
            ))}
          </List>

          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, display: "block", mt: 2, mb: 1 }}>
            Pin map
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2.5 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ "& th": { fontWeight: 700, bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(15,23,42,0.03)") } }}>
                  <TableCell>Signal</TableCell>
                  <TableCell>ESP32 pin</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {PIN_MAP.map((r) => (
                  <TableRow key={r.signal} hover>
                    <TableCell sx={{ fontWeight: 500 }}>{r.signal}</TableCell>
                    <TableCell>
                      <Box component="code" sx={{ fontFamily: "ui-monospace, monospace", fontSize: "0.8rem" }}>
                        {r.pin}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {r.notes}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert severity="error" icon={<ShieldAlert size={20} />} variant="outlined">
            <AlertTitle sx={{ fontWeight: 700 }}>Safety — 380 V three-phase mains is lethal</AlertTitle>
            All voltage taps must be performed by a <strong>licensed electrician</strong> with the
            panel <strong>de-energised</strong>, behind a 3-pole breaker and fuses. Develop and
            bench-test the firmware and wiring at <strong>low voltage first</strong> (a single
            220 V phase or a variac) before connecting to any live 3-phase supply.
          </Alert>
        </CardContent>
      </Card>

      {/* Firmware config */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<Settings2 size={19} />}
            title="Firmware configuration"
            subtitle="PlatformIO project — set site/device identity and secrets before flashing."
          />

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  include/config.h
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Non-secret, checked-in settings: <code>SITE_ID</code>, <code>DEV_ID</code>, GOST
                  thresholds (2% / 4%), sample &amp; publish periods, and the pin assignments
                  from the table above.
                </Typography>
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2, height: "100%" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  include/secrets.h <Chip size="small" label="gitignored" sx={{ ml: 0.5 }} />
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wi-Fi SSID/password, MQTT broker host + port, MQTT username/password, and the
                  broker's TLS CA certificate (for the 8883 port).
                </Typography>
              </Paper>
            </Grid>
          </Grid>

          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            Flashing (PlatformIO)
          </Typography>
          <Box sx={{ mt: 0.75 }}>
            <CodeBlock>{FLASH_STEPS}</CodeBlock>
          </Box>
        </CardContent>
      </Card>

      {/* Connect to this system */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <SectionHeading
            icon={<Wifi size={19} />}
            title="Connect to this system"
            subtitle="MQTT settings for this deployment — devices register themselves on first telemetry."
          />

          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, width: 220 }}>Broker host</TableCell>
                  <TableCell>
                    <Box component="code" sx={{ fontFamily: "ui-monospace, monospace" }}>178.105.41.164</Box>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Port</TableCell>
                  <TableCell>
                    <Box component="code" sx={{ fontFamily: "ui-monospace, monospace" }}>1883</Box> (dev / plaintext)
                    {" — or "}
                    <Box component="code" sx={{ fontFamily: "ui-monospace, monospace" }}>8883</Box> (TLS, recommended for field deployments)
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Topic pattern</TableCell>
                  <TableCell>
                    <Box component="code" sx={{ fontFamily: "ui-monospace, monospace" }}>
                      site/{"{siteId}"}/dev/{"{devId}"}/telemetry
                    </Box>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
            Telemetry JSON shape (published every ~10 s)
          </Typography>
          <Box sx={{ mt: 0.75, mb: 2 }}>
            <CodeBlock>{TELEMETRY_JSON}</CodeBlock>
          </Box>

          <Alert severity="info" variant="outlined">
            Devices <strong>auto-register</strong> the first time they publish telemetry with a new
            <code> site_id</code>/<code>dev_id</code> pair — nothing else to configure server-side.
            Prefer to control the display name, rated power, or location ahead of time? Pre-create
            the device on the{" "}
            <Button size="small" variant="text" onClick={() => navigate("/devices")} sx={{ px: 0.5, minWidth: 0 }}>
              Devices
            </Button>{" "}
            page with the same IDs — the node's telemetry will attach to it automatically.
          </Alert>
        </CardContent>
      </Card>

      {/* No hardware callout */}
      <Alert
        severity="success"
        variant="outlined"
        icon={<PenLine size={20} />}
        action={
          <Button
            size="small"
            variant="contained"
            endIcon={<ArrowRight size={14} />}
            onClick={() => navigate("/manual")}
          >
            Manual entry
          </Button>
        }
        sx={{ alignItems: "center" }}
      >
        <AlertTitle sx={{ fontWeight: 700 }}>No hardware yet?</AlertTitle>
        Type in phase or line voltages by hand, or import historical readings from a CSV file — the
        same K₂U engine and GOST classification run either way.
      </Alert>
    </Box>
  );
}

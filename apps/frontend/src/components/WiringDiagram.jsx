import { useMemo } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

const VB_W = 1200;
const VB_H = 760;

const PZEM_X = 260;
const PZEM_W = 210;
const PZEM_H = 110;

const PZEMS = [
  { addr: "0x01", phase: "L1–N", y: 70, mainsY: 150, bendX: 215 },
  { addr: "0x02", phase: "L2–N", y: 205, mainsY: 220, bendX: 225 },
  { addr: "0x03", phase: "L3–N", y: 340, mainsY: 290, bendX: 235 },
];

const ESP_X = 730;
const ESP_Y = 110;
const ESP_W = 230;
const ESP_H = 340;

const LS_X = 545;
const LS_Y = 205;
const LS_W = 130;
const LS_H = 140;

const RO_X = 1020;
const RO_W = 150;

const HLK_X = 730;
const HLK_Y = 560;
const HLK_W = 230;
const HLK_H = 110;

const MB_X = 30;
const MB_Y = 110;
const MB_W = 150;
const MB_H = 260;

function poly(points) {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
}

/**
 * Labeled SVG schematic of the K2U measurement node: ESP32 + 3x PZEM-004T on a
 * shared Modbus/UART bus through a level shifter, DS3231 + OLED on I2C, and an
 * HLK-PM01 isolated 220V->5V supply. Pure SVG (no external images), fully
 * theme-aware, responsive via viewBox. Color-coded: red = power, grey = GND,
 * blue = data/signal, orange = mains AC (danger).
 */
export default function WiringDiagram() {
  const theme = useTheme();
  const dark = theme.palette.mode === "dark";

  const colors = useMemo(
    () => ({
      boxFill: dark ? "#1b222c" : "#f8fafc",
      boxStroke: dark ? "#3a4453" : "#cbd5e1",
      espFill: dark ? "#122036" : "#e7f0fb",
      espStroke: dark ? "#3b6ea5" : "#8db6e0",
      lsFill: dark ? "#182a28" : "#eaf6f3",
      lsStroke: dark ? "#2f6c62" : "#8fcabd",
      title: dark ? "#eef1f6" : "#0f172a",
      muted: dark ? "#94a1b5" : "#64748b",
      pinText: dark ? "#b7c1d1" : "#475569",
      power: dark ? "#f26d6d" : "#dc2626",
      ground: dark ? "#98a3b5" : "#475569",
      signal: dark ? "#5fa8ff" : "#2563eb",
      mains: dark ? "#f2a34e" : "#c2650a",
      danger: dark ? "#f2a34e" : "#b91c1c",
      dot: dark ? "#dfe4ec" : "#334155",
    }),
    [dark],
  );

  const nBusTaps = PZEMS.map((p) => p.y + 75);
  const nBusMin = Math.min(...nBusTaps, 350);
  const nBusMax = Math.max(...nBusTaps, 625);

  const txTaps = PZEMS.map((p) => p.y + 35);
  const txMin = Math.min(...txTaps, 240);
  const txMax = Math.max(...txTaps, 240);

  const rxTaps = PZEMS.map((p) => p.y + 75);
  const rxMin = Math.min(...rxTaps, 280);
  const rxMax = Math.max(...rxTaps, 280);

  return (
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        width="100%"
        style={{ minWidth: 780, height: "auto", display: "block" }}
        role="img"
        aria-label="Wiring schematic of the K2U measurement node: ESP32 connected to three PZEM-004T meters via a level-shifted Modbus bus, a DS3231 RTC and OLED display on I2C, and an HLK-PM01 220V to 5V power supply"
      >
        {/* ---------- Title ---------- */}
        <text x={20} y={30} fontSize={16} fontWeight={700} fill={colors.title}>
          K₂U measurement node — wiring schematic
        </text>
        <text x={20} y={48} fontSize={10.5} fill={colors.muted}>
          ESP32 · 3× PZEM-004T (Modbus RTU) · DS3231 · SSD1306 OLED · HLK-PM01
        </text>

        {/* ---------- Mains distribution board (danger zone) ---------- */}
        <rect
          x={MB_X - 10}
          y={MB_Y - 10}
          width={MB_W + 20}
          height={MB_H + 20}
          rx={16}
          fill="none"
          stroke={colors.danger}
          strokeDasharray="5 5"
          strokeWidth={1.5}
          opacity={0.7}
        />
        <rect x={MB_X} y={MB_Y} width={MB_W} height={MB_H} rx={12} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.5} />
        <text x={MB_X + MB_W / 2} y={MB_Y + 28} textAnchor="middle" fontSize={12.5} fontWeight={700} fill={colors.title}>
          Distribution board
        </text>
        <text x={MB_X + MB_W / 2} y={MB_Y + 43} textAnchor="middle" fontSize={9} fill={colors.muted}>
          3-phase 380/220 V panel
        </text>
        {[
          { l: "L1", y: 150 },
          { l: "L2", y: 220 },
          { l: "L3", y: 290 },
          { l: "N", y: 350 },
        ].map((t) => (
          <g key={t.l}>
            <text x={MB_X + MB_W - 14} y={t.y + 4} textAnchor="end" fontSize={11} fontWeight={700} fill={colors.mains}>
              {t.l}
            </text>
            <circle cx={MB_X + MB_W} cy={t.y} r={3.5} fill={colors.mains} />
          </g>
        ))}

        {/* ---------- Mains -> PZEM phase wires (L1/L2/L3) ---------- */}
        {PZEMS.map((p) => (
          <path
            key={`main-${p.addr}`}
            d={poly([
              [MB_X + MB_W, p.mainsY],
              [p.bendX, p.mainsY],
              [p.bendX, p.y + 35],
              [PZEM_X, p.y + 35],
            ])}
            stroke={colors.mains}
            strokeWidth={2.75}
            fill="none"
            strokeLinecap="round"
          />
        ))}
        <circle cx={MB_X + MB_W} cy={150} r={3.5} fill={colors.mains} />

        {/* ---------- Shared neutral bus: mains N -> 3x PZEM N-in -> HLK N-in ---------- */}
        <path d={poly([[MB_X + MB_W, 350], [205, 350]])} stroke={colors.mains} strokeWidth={2.75} fill="none" />
        <path d={poly([[205, nBusMin], [205, nBusMax]])} stroke={colors.mains} strokeWidth={2.75} fill="none" />
        {PZEMS.map((p) => (
          <path
            key={`n-${p.addr}`}
            d={poly([[205, p.y + 75], [PZEM_X, p.y + 75]])}
            stroke={colors.mains}
            strokeWidth={2.75}
            fill="none"
          />
        ))}
        <path d={poly([[205, 625], [HLK_X, 625]])} stroke={colors.mains} strokeWidth={2.75} fill="none" />
        <circle cx={205} cy={350} r={3} fill={colors.mains} />

        {/* ---------- Mains L1 branch -> HLK-PM01 AC-in ---------- */}
        <path
          d={poly([[MB_X + MB_W, 150], [190, 150], [190, 595], [HLK_X, 595]])}
          stroke={colors.mains}
          strokeWidth={2.75}
          fill="none"
        />
        <circle cx={MB_X + MB_W} cy={150} r={3} fill={colors.mains} />

        {/* ---------- PZEM boxes + TX/RX pins ---------- */}
        {PZEMS.map((p) => (
          <g key={p.addr}>
            <rect x={PZEM_X} y={p.y} width={PZEM_W} height={PZEM_H} rx={10} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.5} />
            <text x={PZEM_X + PZEM_W / 2} y={p.y + 24} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.title}>
              PZEM-004T v3.0
            </text>
            <text x={PZEM_X + PZEM_W / 2} y={p.y + 40} textAnchor="middle" fontSize={9.5} fill={colors.muted}>
              Addr {p.addr} · {p.phase} ~220 V
            </text>
            <text x={PZEM_X + 8} y={p.y + 38} fontSize={9} fill={colors.mains}>
              L
            </text>
            <circle cx={PZEM_X} cy={p.y + 35} r={3} fill={colors.mains} />
            <text x={PZEM_X + 8} y={p.y + 78} fontSize={9} fill={colors.mains}>
              N
            </text>
            <circle cx={PZEM_X} cy={p.y + 75} r={3} fill={colors.mains} />
            <text x={PZEM_X + PZEM_W - 22} y={p.y + 38} fontSize={9} fill={colors.signal}>
              TX
            </text>
            <circle cx={PZEM_X + PZEM_W} cy={p.y + 35} r={3} fill={colors.signal} />
            <text x={PZEM_X + PZEM_W - 22} y={p.y + 78} fontSize={9} fill={colors.signal}>
              RX
            </text>
            <circle cx={PZEM_X + PZEM_W} cy={p.y + 75} r={3} fill={colors.signal} />
          </g>
        ))}

        {/* ---------- Shared TX / RX Modbus bus: PZEMs -> level shifter (HV side) ---------- */}
        <path d={poly([[495, txMin], [495, txMax]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        {PZEMS.map((p) => (
          <path key={`tx-${p.addr}`} d={poly([[PZEM_X + PZEM_W, p.y + 35], [495, p.y + 35]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        ))}
        <path d={poly([[495, 240], [520, 240], [520, 245], [LS_X, 245]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />

        <path d={poly([[512, rxMin], [512, rxMax]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        {PZEMS.map((p) => (
          <path key={`rx-${p.addr}`} d={poly([[PZEM_X + PZEM_W, p.y + 75], [512, p.y + 75]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        ))}
        <path d={poly([[512, 280], [535, 280], [535, 285], [LS_X, 285]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />

        {/* ---------- Level shifter box (5V <-> 3.3V) ---------- */}
        <rect x={LS_X} y={LS_Y} width={LS_W} height={LS_H} rx={10} fill={colors.lsFill} stroke={colors.lsStroke} strokeWidth={1.5} />
        <text x={LS_X + LS_W / 2} y={LS_Y + 62} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={colors.title}>
          Level shifter
        </text>
        <text x={LS_X + LS_W / 2} y={LS_Y + 76} textAnchor="middle" fontSize={8.5} fill={colors.muted}>
          5 V ↔ 3.3 V logic
        </text>
        <text x={LS_X + LS_W / 2} y={LS_Y + 88} textAnchor="middle" fontSize={8.5} fill={colors.muted}>
          (TXS0108 / BSS138)
        </text>
        {/* HV (left) pins */}
        <text x={LS_X - 6} y={249} textAnchor="end" fontSize={8.5} fill={colors.pinText}>TX in</text>
        <circle cx={LS_X} cy={245} r={3} fill={colors.signal} />
        <text x={LS_X - 6} y={289} textAnchor="end" fontSize={8.5} fill={colors.pinText}>RX in</text>
        <circle cx={LS_X} cy={285} r={3} fill={colors.signal} />
        <text x={LS_X - 6} y={229} textAnchor="end" fontSize={8.5} fill={colors.power}>5 V</text>
        <circle cx={LS_X} cy={225} r={3} fill={colors.power} />
        <text x={LS_X - 6} y={329} textAnchor="end" fontSize={8.5} fill={colors.ground}>GND</text>
        <circle cx={LS_X} cy={325} r={3} fill={colors.ground} />
        {/* LV (right) pins */}
        <text x={LS_X + LS_W + 6} y={249} fontSize={8.5} fill={colors.pinText}>TX out</text>
        <circle cx={LS_X + LS_W} cy={245} r={3} fill={colors.signal} />
        <text x={LS_X + LS_W + 6} y={289} fontSize={8.5} fill={colors.pinText}>RX out</text>
        <circle cx={LS_X + LS_W} cy={285} r={3} fill={colors.signal} />
        <text x={LS_X + LS_W + 6} y={229} fontSize={8.5} fill={colors.power}>3V3</text>
        <circle cx={LS_X + LS_W} cy={225} r={3} fill={colors.power} />
        <text x={LS_X + LS_W + 6} y={329} fontSize={8.5} fill={colors.ground}>GND</text>
        <circle cx={LS_X + LS_W} cy={325} r={3} fill={colors.ground} />

        {/* ---------- Level shifter (LV) -> ESP32 signal + power wires ---------- */}
        <path d={poly([[LS_X + LS_W, 245], [ESP_X, 245]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[LS_X + LS_W, 285], [ESP_X, 285]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[LS_X + LS_W, 225], [705, 225], [705, 335], [ESP_X, 335]])} stroke={colors.power} strokeWidth={2.5} fill="none" />
        <path d={poly([[LS_X + LS_W, 325], [715, 325], [715, 375], [ESP_X, 375]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />

        {/* ---------- ESP32 box ---------- */}
        <rect x={ESP_X} y={ESP_Y} width={ESP_W} height={ESP_H} rx={14} fill={colors.espFill} stroke={colors.espStroke} strokeWidth={2} />
        <text x={ESP_X + ESP_W / 2} y={ESP_Y + 68} textAnchor="middle" fontSize={16} fontWeight={700} fill={colors.title}>
          ESP32-WROOM-32
        </text>
        <text x={ESP_X + ESP_W / 2} y={ESP_Y + 86} textAnchor="middle" fontSize={10.5} fill={colors.muted}>
          DevKit V1
        </text>
        <circle cx={ESP_X + 55} cy={ESP_Y + 34} r={5} fill={colors.power} opacity={0.9} />
        <text x={ESP_X + 68} y={ESP_Y + 38} fontSize={9} fill={colors.muted}>
          GPIO2 — onboard status LED
        </text>

        {/* ESP32 left-edge pins */}
        <text x={ESP_X - 6} y={241} textAnchor="end" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GPIO17 (TX)</text>
        <circle cx={ESP_X} cy={245} r={3.5} fill={colors.signal} />
        <text x={ESP_X - 6} y={281} textAnchor="end" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GPIO16 (RX)</text>
        <circle cx={ESP_X} cy={285} r={3.5} fill={colors.signal} />
        <text x={ESP_X - 6} y={331} textAnchor="end" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>3V3</text>
        <circle cx={ESP_X} cy={335} r={3.5} fill={colors.power} />
        <text x={ESP_X - 6} y={371} textAnchor="end" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GND</text>
        <circle cx={ESP_X} cy={375} r={3.5} fill={colors.ground} />

        {/* ESP32 right-edge pins */}
        <text x={ESP_X + ESP_W + 6} y={241} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GPIO21 (SDA)</text>
        <circle cx={ESP_X + ESP_W} cy={245} r={3.5} fill={colors.signal} />
        <text x={ESP_X + ESP_W + 6} y={281} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GPIO22 (SCL)</text>
        <circle cx={ESP_X + ESP_W} cy={285} r={3.5} fill={colors.signal} />
        <text x={ESP_X + ESP_W + 6} y={331} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>3V3</text>
        <circle cx={ESP_X + ESP_W} cy={335} r={3.5} fill={colors.power} />
        <text x={ESP_X + ESP_W + 6} y={371} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GND</text>
        <circle cx={ESP_X + ESP_W} cy={375} r={3.5} fill={colors.ground} />

        {/* ESP32 bottom-edge pins (power in) */}
        <text x={790} y={ESP_Y + ESP_H + 16} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>VIN / 5V</text>
        <circle cx={790} cy={ESP_Y + ESP_H} r={3.5} fill={colors.power} />
        <text x={900} y={ESP_Y + ESP_H + 16} textAnchor="middle" fontSize={9.5} fontFamily="ui-monospace, monospace" fill={colors.pinText}>GND</text>
        <circle cx={900} cy={ESP_Y + ESP_H} r={3.5} fill={colors.ground} />

        {/* ---------- I2C bus + power rail: ESP32 -> DS3231 + OLED ---------- */}
        <path d={poly([[ESP_X + ESP_W, 245], [985, 245]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[985, 165], [985, 310]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[985, 165], [RO_X, 165]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[985, 310], [RO_X, 310]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />

        <path d={poly([[ESP_X + ESP_W, 285], [997, 285]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[997, 185], [997, 330]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[997, 185], [RO_X, 185]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />
        <path d={poly([[997, 330], [RO_X, 330]])} stroke={colors.signal} strokeWidth={2.5} fill="none" />

        <path d={poly([[ESP_X + ESP_W, 335], [1005, 335]])} stroke={colors.power} strokeWidth={2.5} fill="none" />
        <path d={poly([[1005, 205], [1005, 350]])} stroke={colors.power} strokeWidth={2.5} fill="none" />
        <path d={poly([[1005, 205], [RO_X, 205]])} stroke={colors.power} strokeWidth={2.5} fill="none" />
        <path d={poly([[1005, 350], [RO_X, 350]])} stroke={colors.power} strokeWidth={2.5} fill="none" />

        <path d={poly([[ESP_X + ESP_W, 375], [1015, 375]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />
        <path d={poly([[1015, 225], [1015, 375]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />
        <path d={poly([[1015, 225], [RO_X, 225]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />
        <path d={poly([[1015, 375], [RO_X, 375]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />

        {/* ---------- DS3231 RTC ---------- */}
        <rect x={RO_X} y={140} width={RO_W} height={110} rx={10} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.5} />
        <text x={RO_X + RO_W / 2} y={178} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.title}>
          DS3231 RTC
        </text>
        <text x={RO_X + RO_W / 2} y={196} textAnchor="middle" fontSize={9.5} fill={colors.muted}>
          I²C · address 0x68
        </text>
        <text x={RO_X + 6} y={168} fontSize={8} fill={colors.signal}>SDA</text>
        <text x={RO_X + 6} y={188} fontSize={8} fill={colors.signal}>SCL</text>
        <text x={RO_X + 6} y={208} fontSize={8} fill={colors.power}>3V3</text>
        <text x={RO_X + 6} y={228} fontSize={8} fill={colors.ground}>GND</text>

        {/* ---------- SSD1306 OLED ---------- */}
        <rect x={RO_X} y={290} width={RO_W} height={140} rx={10} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.5} />
        <text x={RO_X + RO_W / 2} y={352} textAnchor="middle" fontSize={12} fontWeight={700} fill={colors.title}>
          0.96″ OLED
        </text>
        <text x={RO_X + RO_W / 2} y={370} textAnchor="middle" fontSize={9.5} fill={colors.muted}>
          SSD1306 · I²C · 0x3C
        </text>
        <text x={RO_X + 6} y={313} fontSize={8} fill={colors.signal}>SDA</text>
        <text x={RO_X + 6} y={333} fontSize={8} fill={colors.signal}>SCL</text>
        <text x={RO_X + 6} y={353} fontSize={8} fill={colors.power}>3V3</text>
        <text x={RO_X + 6} y={373} fontSize={8} fill={colors.ground}>GND</text>

        {/* ---------- HLK-PM01 box ---------- */}
        <rect x={HLK_X} y={HLK_Y} width={HLK_W} height={HLK_H} rx={12} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.5} />
        <text x={HLK_X + HLK_W / 2} y={HLK_Y + 44} textAnchor="middle" fontSize={13} fontWeight={700} fill={colors.title}>
          HLK-PM01
        </text>
        <text x={HLK_X + HLK_W / 2} y={HLK_Y + 62} textAnchor="middle" fontSize={9.5} fill={colors.muted}>
          220 V AC → 5 V DC, 3 W (isolated)
        </text>
        <text x={HLK_X - 6} y={599} textAnchor="end" fontSize={9} fill={colors.mains}>AC L</text>
        <circle cx={HLK_X} cy={595} r={3.5} fill={colors.mains} />
        <text x={HLK_X - 6} y={629} textAnchor="end" fontSize={9} fill={colors.mains}>AC N</text>
        <circle cx={HLK_X} cy={625} r={3.5} fill={colors.mains} />

        {/* HLK -> ESP32 DC power out (aligned straight up) */}
        <path d={poly([[790, HLK_Y], [790, ESP_Y + ESP_H]])} stroke={colors.power} strokeWidth={2.75} fill="none" />
        <path d={poly([[900, HLK_Y], [900, ESP_Y + ESP_H]])} stroke={colors.ground} strokeWidth={2.75} fill="none" />
        <text x={790} y={HLK_Y - 8} textAnchor="middle" fontSize={9} fill={colors.power}>5V OUT</text>
        <text x={900} y={HLK_Y - 8} textAnchor="middle" fontSize={9} fill={colors.ground}>GND</text>

        {/* HLK 5V/GND branch -> level shifter HV rail */}
        <path d={poly([[790, 500], [485, 500], [485, 225], [LS_X, 225]])} stroke={colors.power} strokeWidth={2.5} fill="none" />
        <path d={poly([[900, 505], [470, 505], [470, 325], [LS_X, 325]])} stroke={colors.ground} strokeWidth={2.5} fill="none" />

        {/* ---------- Legend ---------- */}
        <rect x={970} y={30} width={205} height={100} rx={10} fill={colors.boxFill} stroke={colors.boxStroke} strokeWidth={1.25} />
        <text x={982} y={48} fontSize={10.5} fontWeight={700} fill={colors.title}>
          Legend
        </text>
        {[
          { color: colors.power, label: "Power (5V / 3.3V)", y: 63 },
          { color: colors.ground, label: "Ground (GND)", y: 79 },
          { color: colors.signal, label: "Data / signal (UART · I²C)", y: 95 },
          { color: colors.mains, label: "Mains ~220 V AC", y: 111 },
        ].map((row) => (
          <g key={row.label}>
            <line x1={982} y1={row.y} x2={1008} y2={row.y} stroke={row.color} strokeWidth={3} strokeLinecap="round" />
            <text x={1014} y={row.y + 3} fontSize={9} fill={colors.pinText}>
              {row.label}
            </text>
          </g>
        ))}

        {/* ---------- Safety note ---------- */}
        <text x={VB_W / 2} y={718} textAnchor="middle" fontSize={11.5} fontWeight={700} fill={colors.danger}>
          ⚠ Mains taps (L1/L2/L3/N, HLK-PM01 AC input) — licensed electrician only, panel de-energised.
        </text>
        <text x={VB_W / 2} y={736} textAnchor="middle" fontSize={9.5} fill={colors.muted}>
          Low-voltage logic (ESP32, PZEM data bus, I²C, DC power) is safe to prototype on a bench before any mains connection.
        </text>
      </svg>
    </Box>
  );
}

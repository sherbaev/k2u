import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Stack,
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Popover,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import FolderZipIcon from "@mui/icons-material/FolderZip";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { api } from "../lib/api.js";
import { buildReport } from "../lib/report.js";
import { downloadPdf } from "../lib/pdf.js";
import { downloadCsv, downloadReportZip } from "../lib/zipExport.js";

const VERDICT_COLOR = { PASS: "success", MARGINAL: "warning", FAIL: "error", "N/A": "default" };

/** Last-90-days default window for the date-range picker. */
function defaultRange() {
  const to = new Date();
  return { from: subDays(to, 90), to };
}

/**
 * GOST compliance report export page: pick a device + date range, load the
 * weekly compliance rollup, preview it, and export as PDF / CSV / ZIP.
 */
export default function Reports() {
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [devId, setDevId] = useState("");
  const [range, setRange] = useState(defaultRange());
  const [anchorEl, setAnchorEl] = useState(null);

  const [rawRows, setRawRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [zipping, setZipping] = useState(false);

  useEffect(() => {
    api.devices().then((d) => setDevices(Array.isArray(d) ? d : [])).catch(() => setDevices([]));
    api.sites().then((s) => setSites(Array.isArray(s) ? s : [])).catch(() => setSites([]));
  }, []);

  // Auto-select the first device once the list loads.
  useEffect(() => {
    if (!devId && devices.length) setDevId(devices[0].devId);
  }, [devices, devId]);

  const device = useMemo(() => devices.find((d) => d.devId === devId) || null, [devices, devId]);
  const site = useMemo(() => {
    if (!device) return {};
    return sites.find((s) => s.siteId === device.siteId) || {};
  }, [device, sites]);

  async function handleLoad() {
    if (!devId) return;
    setLoading(true);
    setError("");
    try {
      const rows = await api.compliance({ devId });
      setRawRows(Array.isArray(rows) ? rows : []);
      setLoaded(true);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load compliance data.");
      setRawRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Client-side filter to the selected date range, by week-start.
  const filteredRows = useMemo(() => {
    if (!range?.from || !range?.to) return rawRows;
    const from = startOfDay(range.from).getTime();
    const to = endOfDay(range.to).getTime();
    return rawRows.filter((r) => {
      const t = new Date(r.weekStart).getTime();
      return Number.isFinite(t) && t >= from && t <= to;
    });
  }, [rawRows, range]);

  const report = useMemo(
    () =>
      buildReport({
        site,
        device: { devId },
        from: range?.from ? format(range.from, "yyyy-MM-dd") : "",
        to: range?.to ? format(range.to, "yyyy-MM-dd") : "",
        compliance: filteredRows,
      }),
    [site, devId, range, filteredRows],
  );

  const hasRows = report.rows.length > 0;

  async function handleExportZip() {
    setZipping(true);
    try {
      await downloadReportZip(report, `gost-${devId}.zip`);
    } finally {
      setZipping(false);
    }
  }

  const rangeLabel =
    range?.from && range?.to
      ? `${format(range.from, "MMM d, yyyy")} – ${format(range.to, "MMM d, yyyy")}`
      : "Select a date range";

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
        GOST compliance reports
      </Typography>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", sm: "center" }}
            flexWrap="wrap"
          >
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Device</InputLabel>
              <Select label="Device" value={devId} onChange={(e) => setDevId(e.target.value)}>
                {devices.length === 0 && <MenuItem value="">(no devices)</MenuItem>}
                {devices.map((d) => (
                  <MenuItem key={d.devId} value={d.devId}>
                    {d.devId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<CalendarMonthIcon />}
              onClick={(e) => setAnchorEl(e.currentTarget)}
            >
              {rangeLabel}
            </Button>
            <Popover
              open={Boolean(anchorEl)}
              anchorEl={anchorEl}
              onClose={() => setAnchorEl(null)}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            >
              <Box sx={{ p: 1 }}>
                <DayPicker mode="range" selected={range} onSelect={(r) => setRange(r || {})} />
              </Box>
            </Popover>

            <Button variant="contained" disabled={!devId || loading} onClick={handleLoad}>
              {loading ? "Loading…" : "Load"}
            </Button>

            {site?.name && (
              <Typography variant="body2" color="text.secondary">
                {site.name} ({site.type})
              </Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" sx={{ mb: 2 }}>
            <Chip
              label={`Overall: ${report.summary.overallVerdict}`}
              color={VERDICT_COLOR[report.summary.overallVerdict] || "default"}
            />
            <Typography variant="body2" color="text.secondary">
              {report.summary.weeks} week{report.summary.weeks === 1 ? "" : "s"} — PASS{" "}
              {report.summary.weeksPass}, MARGINAL {report.summary.weeksMarginal}, FAIL{" "}
              {report.summary.weeksFail}. Worst weekly K₂U p95: {report.summary.worstP95.toFixed(2)}%.
            </Typography>
          </Stack>

          {loading ? (
            <Stack alignItems="center" sx={{ py: 4 }}>
              <CircularProgress size={28} />
            </Stack>
          ) : !hasRows ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
              {loaded
                ? "No compliance data for the selected device and date range."
                : "Choose a device and date range, then click Load."}
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Week start</TableCell>
                    <TableCell align="right">K₂U p95 %</TableCell>
                    <TableCell align="right">≥2% time</TableCell>
                    <TableCell align="right">≥4% time</TableCell>
                    <TableCell>Verdict</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report.rows.map((r) => (
                    <TableRow key={r.weekStart}>
                      <TableCell>{format(new Date(r.weekStart), "MMM d, yyyy")}</TableCell>
                      <TableCell align="right">{r.k2u_p95.toFixed(2)}</TableCell>
                      <TableCell align="right">{r.exceed_2pct}</TableCell>
                      <TableCell align="right">{r.exceed_4pct}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.verdict} color={VERDICT_COLOR[r.verdict] || "default"} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          startIcon={<PictureAsPdfIcon />}
          disabled={!hasRows}
          onClick={() => downloadPdf(report, `gost-${devId}.pdf`)}
        >
          Export PDF
        </Button>
        <Button
          variant="outlined"
          startIcon={<TableChartIcon />}
          disabled={!hasRows}
          onClick={() => downloadCsv(report, `gost-${devId}.csv`)}
        >
          Export CSV
        </Button>
        <Button
          variant="outlined"
          startIcon={<FolderZipIcon />}
          disabled={!hasRows || zipping}
          onClick={handleExportZip}
        >
          {zipping ? "Zipping…" : "Export ZIP"}
        </Button>
      </Stack>
    </Box>
  );
}

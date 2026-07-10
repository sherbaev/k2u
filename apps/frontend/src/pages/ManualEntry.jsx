import { useMemo, useState } from "react";
import axios from "axios";
import {
  Box,
  Grid,
  Card,
  CardHeader,
  CardContent,
  Typography,
  Stack,
  Divider,
  TextField,
  Button,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Paper,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Nomogram from "../components/Nomogram.jsx";
import { k2uFromVoltages, lineFromPhaseNominal } from "../lib/k2u.js";
import { parseCsv, toReadings } from "../lib/csv.js";

const STATUS_COLORS = { NORMAL: "success", WARNING: "warning", CRITICAL: "error" };

/** Parse a text-field value to a finite number, or NaN if it isn't one. */
function toNumberOrNaN(value) {
  if (value === "" || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
}

/** "YYYY-MM-DDTHH:mm" for the current local time, for <input type="datetime-local">. */
function nowLocalIso() {
  const d = new Date();
  d.setSeconds(0, 0);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/**
 * Manual reading form: enter phase or line voltages, preview K2U live
 * (value, status chip, nomogram point), then POST to /api/readings.
 */
function ManualReadingCard() {
  const [mode, setMode] = useState("phase"); // "phase" | "line"
  const [siteId, setSiteId] = useState("");
  const [devId, setDevId] = useState("");
  const [ts, setTs] = useState(nowLocalIso());
  const [temp, setTemp] = useState("");
  const [loadFactor, setLoadFactor] = useState("");
  const [ua, setUa] = useState("");
  const [ub, setUb] = useState("");
  const [uc, setUc] = useState("");
  const [uab, setUab] = useState("");
  const [ubc, setUbc] = useState("");
  const [uca, setUca] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  // Derive line voltages from whichever mode is active.
  const line = useMemo(() => {
    if (mode === "phase") {
      const a = toNumberOrNaN(ua);
      const b = toNumberOrNaN(ub);
      const c = toNumberOrNaN(uc);
      if (![a, b, c].every((v) => Number.isFinite(v) && v > 0)) return null;
      return lineFromPhaseNominal(a, b, c);
    }
    const ab = toNumberOrNaN(uab);
    const bc = toNumberOrNaN(ubc);
    const ca = toNumberOrNaN(uca);
    if (![ab, bc, ca].every((v) => Number.isFinite(v) && v > 0)) return null;
    return { uab: ab, ubc: bc, uca: ca };
  }, [mode, ua, ub, uc, uab, ubc, uca]);

  const preview = useMemo(() => {
    if (!line) return { valid: false };
    return k2uFromVoltages(line.uab, line.ubc, line.uca);
  }, [line]);

  const point = useMemo(() => {
    if (!line || !line.uab) return null;
    return { x: line.ubc / line.uab, y: line.uca / line.uab };
  }, [line]);

  async function handleSubmit() {
    setResult(null);

    if (!siteId.trim() || !devId.trim()) {
      setResult({ ok: false, message: "site_id and dev_id are required." });
      return;
    }
    if (!preview.valid) {
      setResult({ ok: false, message: "Enter a valid, physically consistent voltage triangle." });
      return;
    }

    const body = {
      site_id: siteId.trim(),
      dev_id: devId.trim(),
      ts: ts ? new Date(ts).toISOString() : new Date().toISOString(),
      source: "manual",
    };
    if (temp !== "" && Number.isFinite(toNumberOrNaN(temp))) body.temp = toNumberOrNaN(temp);
    if (loadFactor !== "" && Number.isFinite(toNumberOrNaN(loadFactor))) {
      body.load_factor = toNumberOrNaN(loadFactor);
    }
    if (mode === "phase") {
      body.u_a = toNumberOrNaN(ua);
      body.u_b = toNumberOrNaN(ub);
      body.u_c = toNumberOrNaN(uc);
    } else {
      body.u_ab = toNumberOrNaN(uab);
      body.u_bc = toNumberOrNaN(ubc);
      body.u_ca = toNumberOrNaN(uca);
    }

    setSubmitting(true);
    try {
      const { data } = await axios.post("/api/readings", body);
      setResult({
        ok: true,
        message: "Reading submitted.",
        k2u: data?.k2u,
        status: data?.status,
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err?.response?.data?.message || err.message || "Submit failed.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader title="Manual reading" />
      <CardContent>
        <Stack spacing={2}>
          <ToggleButtonGroup
            color="primary"
            size="small"
            exclusive
            value={mode}
            onChange={(_e, next) => next && setMode(next)}
          >
            <ToggleButton value="phase">Phase (U_a, U_b, U_c)</ToggleButton>
            <ToggleButton value="line">Line (U_ab, U_bc, U_ca)</ToggleButton>
          </ToggleButtonGroup>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Site ID"
              size="small"
              fullWidth
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
            />
            <TextField
              label="Device ID"
              size="small"
              fullWidth
              value={devId}
              onChange={(e) => setDevId(e.target.value)}
            />
          </Stack>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Timestamp"
              type="datetime-local"
              size="small"
              fullWidth
              InputLabelProps={{ shrink: true }}
              value={ts}
              onChange={(e) => setTs(e.target.value)}
            />
            <TextField
              label="Temp (°C)"
              size="small"
              fullWidth
              value={temp}
              onChange={(e) => setTemp(e.target.value)}
            />
            <TextField
              label="Load factor (0–1)"
              size="small"
              fullWidth
              value={loadFactor}
              onChange={(e) => setLoadFactor(e.target.value)}
            />
          </Stack>

          <Divider />

          {mode === "phase" ? (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="U_a (V)" size="small" fullWidth value={ua} onChange={(e) => setUa(e.target.value)} />
              <TextField label="U_b (V)" size="small" fullWidth value={ub} onChange={(e) => setUb(e.target.value)} />
              <TextField label="U_c (V)" size="small" fullWidth value={uc} onChange={(e) => setUc(e.target.value)} />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="U_ab (V)" size="small" fullWidth value={uab} onChange={(e) => setUab(e.target.value)} />
              <TextField label="U_bc (V)" size="small" fullWidth value={ubc} onChange={(e) => setUbc(e.target.value)} />
              <TextField label="U_ca (V)" size="small" fullWidth value={uca} onChange={(e) => setUca(e.target.value)} />
            </Stack>
          )}

          <Divider />

          <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {preview.valid ? `${preview.k2u.toFixed(2)}%` : "—"}
            </Typography>
            {preview.valid ? (
              <Chip label={preview.status} color={STATUS_COLORS[preview.status] || "default"} size="small" />
            ) : (
              <Chip label="invalid" size="small" />
            )}
            {preview.valid && (
              <Typography variant="body2" color="text.secondary">
                φ₂ = {preview.phi2.toFixed(1)}°
              </Typography>
            )}
          </Stack>

          <Box sx={{ maxWidth: 360, mx: "auto", width: "100%" }}>
            <Nomogram point={point} />
          </Box>

          <Button variant="contained" disabled={submitting} onClick={handleSubmit}>
            {submitting ? "Submitting…" : "Submit reading"}
          </Button>

          {result && (
            <Alert severity={result.ok ? "success" : "error"}>
              {result.message}
              {result.ok && Number.isFinite(result.k2u) && (
                <> — K₂U {result.k2u.toFixed(2)}% ({result.status})</>
              )}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * CSV bulk-import form: pick a .csv file, preview the first rows parsed
 * client-side, then POST all rows to /api/readings/bulk.
 */
function CsvImportCard() {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    setResult(null);
    setRows([]);
    setFileName(file ? file.name : "");
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        setRows(parseCsv(String(reader.result || "")));
      } catch {
        setResult({ ok: false, message: "Could not parse CSV file." });
      }
    };
    reader.onerror = () => setResult({ ok: false, message: "Could not read file." });
    reader.readAsText(file);
  }

  async function handleImport() {
    setResult(null);
    setImporting(true);
    try {
      const items = toReadings(rows);
      const { data } = await axios.post("/api/readings/bulk", { items });
      const inserted = data?.inserted ?? items.length;
      const rejected = data?.rejected ?? 0;
      setResult({
        ok: true,
        message: `Imported ${inserted} row${inserted === 1 ? "" : "s"}.${rejected ? ` ${rejected} rejected.` : ""}`,
      });
    } catch (err) {
      setResult({
        ok: false,
        message: err?.response?.data?.message || err.message || "Import failed.",
      });
    } finally {
      setImporting(false);
    }
  }

  const previewRows = rows.slice(0, 5);
  const columns = previewRows.length ? Object.keys(previewRows[0]) : [];

  return (
    <Card sx={{ height: "100%" }}>
      <CardHeader title="CSV import" />
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Columns: site_id, dev_id, ts, u_a/u_b/u_c (or u_ab/u_bc/u_ca), temp, load_factor.
          </Typography>

          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
            {fileName || "Choose CSV file"}
            <input type="file" accept=".csv" hidden onChange={handleFile} />
          </Button>

          {rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No file loaded yet.
            </Typography>
          ) : (
            <>
              <Typography variant="body2">
                Parsed {rows.length} row{rows.length === 1 ? "" : "s"}. Preview of first {previewRows.length}:
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {columns.map((c) => (
                        <TableCell key={c}>{c}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {previewRows.map((row, i) => (
                      <TableRow key={i}>
                        {columns.map((c) => (
                          <TableCell key={c}>{row[c] === undefined ? "" : String(row[c])}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Button variant="contained" disabled={importing || rows.length === 0} onClick={handleImport}>
                {importing ? "Importing…" : `Import ${rows.length} rows`}
              </Button>
            </>
          )}

          {result && <Alert severity={result.ok ? "success" : "error"}>{result.message}</Alert>}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function ManualEntry() {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
        Manual data entry
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <ManualReadingCard />
        </Grid>
        <Grid item xs={12} md={6}>
          <CsvImportCard />
        </Grid>
      </Grid>
    </Box>
  );
}

import { useEffect, useMemo, useState } from "react";
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import { useLive } from "../lib/useLive.js";
import { api } from "../lib/api.js";
import Nomogram from "../components/Nomogram.jsx";
import OperatingPointCard from "../components/OperatingPointCard.jsx";
import VoltageChart from "../components/VoltageChart.jsx";
import AlertsPanel from "../components/AlertsPanel.jsx";
import GostPanel from "../components/GostPanel.jsx";
import RulPanel from "../components/RulPanel.jsx";

function ratios(t) {
  if (!t || !t.u_ab) return null;
  return { x: t.u_bc / t.u_ab, y: t.u_ca / t.u_ab };
}

export default function Dashboard() {
  const { connected, latest, history, events } = useLive();
  const devIds = Object.keys(latest);
  const [devId, setDevId] = useState(null);
  const [aggregates, setAggregates] = useState([]);
  const [prediction, setPrediction] = useState(null);
  const [seedEvents, setSeedEvents] = useState([]);

  // Auto-select the first device that appears.
  useEffect(() => {
    if (!devId && devIds.length) setDevId(devIds[0]);
  }, [devIds, devId]);

  // Load slow-changing data on device change (aggregates, latest prediction, event history).
  useEffect(() => {
    if (!devId) return;
    api.aggregates({ devId, limit: 1008 }).then(setAggregates).catch(() => {});
    api.predictions({ devId, limit: 1 }).then((p) => setPrediction(p?.[0] ?? null)).catch(() => {});
    api.events({ devId, limit: 100 }).then(setSeedEvents).catch(() => {});
  }, [devId]);

  const telemetry = devId ? latest[devId] : null;
  const point = ratios(telemetry);

  const devHistory = useMemo(
    () => history.filter((t) => (t.meta?.devId ?? t.dev_id) === devId),
    [history, devId],
  );
  const trail = useMemo(
    () => devHistory.slice(-10).map(ratios).filter(Boolean),
    [devHistory],
  );
  const allEvents = useMemo(
    () => [...events.filter((e) => e.devId === devId), ...seedEvents].slice(0, 100),
    [events, seedEvents, devId],
  );

  return (
    <Box>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Device</InputLabel>
          <Select label="Device" value={devId ?? ""} onChange={(e) => setDevId(e.target.value)}>
            {devIds.length === 0 && <MenuItem value="">(waiting…)</MenuItem>}
            {devIds.map((d) => (
              <MenuItem key={d} value={d}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Chip
          size="small"
          color={connected ? "success" : "default"}
          label={connected ? "live" : "disconnected"}
        />
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7} lg={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                K₂U polar nomogram
              </Typography>
              <Nomogram point={point} trail={trail} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5} lg={6}>
          <Stack spacing={2}>
            <OperatingPointCard telemetry={telemetry} />
            <RulPanel prediction={prediction} />
          </Stack>
        </Grid>

        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <VoltageChart history={devHistory} />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} lg={4}>
          <GostPanel aggregates={aggregates} />
        </Grid>

        <Grid item xs={12}>
          <AlertsPanel events={allEvents} onAck={() => {}} />
        </Grid>
      </Grid>
    </Box>
  );
}

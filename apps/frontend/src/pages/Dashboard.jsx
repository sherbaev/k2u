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
import { LayoutDashboard, Radio, ShieldCheck, BellRing, TrendingUp } from "lucide-react";
import { useLive } from "../lib/useLive.js";
import { api } from "../lib/api.js";
import Nomogram from "../components/Nomogram.jsx";
import OperatingPointCard from "../components/OperatingPointCard.jsx";
import VoltageChart from "../components/VoltageChart.jsx";
import AlertsPanel from "../components/AlertsPanel.jsx";
import GostPanel from "../components/GostPanel.jsx";
import RulPanel from "../components/RulPanel.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";

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
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);

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

  // Fleet-wide device/site registry for the summary stat cards.
  useEffect(() => {
    api.devices().then((d) => setDevices(Array.isArray(d) ? d : [])).catch(() => {});
    api.sites().then((s) => setSites(Array.isArray(s) ? s : [])).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const k2uValues = Object.values(latest)
      .map((t) => t?.k2u)
      .filter((v) => Number.isFinite(v));
    const worstK2u = k2uValues.length ? Math.max(...k2uValues) : null;

    const siteIdByDev = {};
    for (const d of devices) siteIdByDev[d.devId] = d.siteId;
    const criticalSites = new Set();
    for (const [dev, t] of Object.entries(latest)) {
      if (t?.status === "CRITICAL") {
        const sId = siteIdByDev[dev];
        if (sId) criticalSites.add(sId);
      }
    }
    const totalSites = sites.length;
    const compliantSites = Math.max(0, totalSites - criticalSites.size);

    const activeAlerts = events.filter(
      (e) => (e.type === "WARNING" || e.type === "CRITICAL") && !e.ackAt,
    ).length;

    return {
      deviceCount: devices.length || devIds.length,
      worstK2u,
      compliantSites,
      totalSites,
      activeAlerts,
    };
  }, [devices, sites, latest, events, devIds.length]);

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
      <PageHeader
        icon={<LayoutDashboard size={22} />}
        title="Overview"
        subtitle="Fleet-wide K₂U status, live nomogram and GOST 32144-2013 compliance for the selected device."
        actions={
          <Stack direction="row" spacing={2} alignItems="center">
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
        }
      />

      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<Radio size={20} />}
            label="Devices"
            value={stats.deviceCount}
            hint="Registered monitoring units"
            tone="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Worst K₂U now"
            value={stats.worstK2u !== null ? `${stats.worstK2u.toFixed(2)}%` : "—"}
            hint="Across all live devices"
            tone={stats.worstK2u > 4 ? "error" : stats.worstK2u > 2 ? "warning" : "success"}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<ShieldCheck size={20} />}
            label="Sites in compliance"
            value={`${stats.compliantSites}/${stats.totalSites || 0}`}
            hint="GOST 32144-2013"
            tone={stats.compliantSites === stats.totalSites ? "success" : "warning"}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<BellRing size={20} />}
            label="Active alerts"
            value={stats.activeAlerts}
            hint="Unacknowledged warnings/critical"
            tone={stats.activeAlerts > 0 ? "warning" : "success"}
          />
        </Grid>
      </Grid>

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

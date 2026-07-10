import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Link,
} from "@mui/material";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Download,
  Sun,
  Antenna,
  Gauge,
  BatteryCharging,
  Timer,
  CalendarClock,
  Building2,
  MapPin,
  MapPinOff,
  Activity,
  TrendingUp,
  Radio,
} from "lucide-react";
import { api } from "../lib/api.js";
import { useShowCoords } from "../lib/prefs.js";
import { formatAge, formatPeriod, formatDateTime } from "../lib/format.js";
import { downloadFirmwareZip } from "../lib/firmwareGen.js";
import PageHeader from "../components/PageHeader.jsx";
import StatCard from "../components/StatCard.jsx";
import EmptyState from "../components/EmptyState.jsx";
import VoltageChart from "../components/VoltageChart.jsx";
import GostPanel from "../components/GostPanel.jsx";
import RulPanel from "../components/RulPanel.jsx";
import OperatingPointCard from "../components/OperatingPointCard.jsx";
import Nomogram from "../components/Nomogram.jsx";
import DeviceLifecycleChip from "../components/DeviceLifecycleChip.jsx";
import DeviceDialog from "../components/DeviceDialog.jsx";

const DEVICE_TYPE_LABEL = {
  pv_inverter: "PV inverter",
  telecom_rect: "Telecom rectifier",
};

const POLL_MS = 15000;

function DeviceTypeIcon({ deviceType, size = 20 }) {
  return deviceType === "telecom_rect" ? <Antenna size={size} /> : <Sun size={size} />;
}

function ratios(t) {
  if (!t || !t.u_ab) return null;
  return { x: t.u_bc / t.u_ab, y: t.u_ca / t.u_ab };
}

function k2uTone(status) {
  if (status === "CRITICAL") return "error";
  if (status === "WARNING") return "warning";
  if (status === "NORMAL") return "success";
  return "neutral";
}

function lifecycleTone(status) {
  if (status === "receiving") return "success";
  if (status === "offline") return "warning";
  if (status === "archived") return "neutral";
  return "primary";
}

function ConfigItem({ icon, label, value }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Stack direction="row" spacing={1.25} alignItems="flex-start">
        <Box sx={{ color: "text.secondary", mt: "2px" }}>{icon}</Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: "break-word" }}>
            {value}
          </Typography>
        </Box>
      </Stack>
    </Grid>
  );
}

export default function DeviceDetail() {
  const { devId } = useParams();
  const navigate = useNavigate();
  const showCoords = useShowCoords();

  const [device, setDevice] = useState(null);
  const [history, setHistory] = useState([]);
  const [aggregates, setAggregates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState(null);

  const refreshDevice = useCallback(async () => {
    try {
      const d = await api.getDevice(devId);
      setDevice(d);
      setNotFound(false);
      setError("");
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(err?.response?.data?.message || err.message || "Could not refresh device.");
      }
    }
  }, [devId]);

  // Initial load: device + recent history + weekly aggregates.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    Promise.all([
      api.getDevice(devId),
      api.history({ devId, limit: 300 }).catch(() => []),
      api.aggregates({ devId, limit: 1200 }).catch(() => []),
    ])
      .then(([d, h, a]) => {
        if (cancelled) return;
        setDevice(d);
        setHistory(Array.isArray(h) ? h : []);
        setAggregates(Array.isArray(a) ? a : []);
        setError("");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setNotFound(true);
        else setError(err?.response?.data?.message || err.message || "Could not load device.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [devId]);

  // Live-ish poll: refresh status/latest/prediction every ~15s.
  useEffect(() => {
    const t = setInterval(refreshDevice, POLL_MS);
    return () => clearInterval(t);
  }, [refreshDevice]);

  const latest = device?.latest || null;
  const prediction = device?.prediction || null;
  const trail = useMemo(
    () => history.slice(-10).map(ratios).filter(Boolean),
    [history],
  );
  const point = useMemo(() => ratios(latest), [latest]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await api.deleteDevice(devId);
      navigate("/devices");
    } catch (err) {
      setNotice({
        severity: "error",
        message: err?.response?.data?.message || err.message || "Could not delete device.",
      });
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function handleDownloadFirmware() {
    try {
      await downloadFirmwareZip(device);
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Could not build firmware archive." });
    }
  }

  if (notFound) {
    return (
      <Box>
        <Card>
          <CardContent>
            <EmptyState
              icon={<Radio size={24} />}
              title={`Device "${devId}" not found`}
              description="It may have been deleted, or the link is incorrect."
              actionLabel="Back to devices"
              onAction={() => navigate("/devices")}
            />
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (loading && !device) {
    return (
      <Box>
        <Card>
          <CardContent>
            <Typography color="text.secondary">Loading device…</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box>
      <Link
        component={RouterLink}
        to="/devices"
        underline="hover"
        color="text.secondary"
        sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, mb: 1.5, fontSize: "0.85rem" }}
      >
        <ArrowLeft size={15} /> Devices
      </Link>

      <PageHeader
        icon={<DeviceTypeIcon deviceType={device?.deviceType} />}
        title={device?.name || devId}
        subtitle={`${devId} · ${device?.siteId || "—"} · ${DEVICE_TYPE_LABEL[device?.deviceType] || "Device"}`}
        actions={
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button
              variant="outlined"
              startIcon={<Pencil size={16} />}
              onClick={() => setEditOpen(true)}
              disabled={!device}
            >
              Edit
            </Button>
            <Button
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={handleDownloadFirmware}
              disabled={!device}
            >
              Download firmware
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Trash2 size={16} />}
              onClick={() => setDeleteOpen(true)}
              disabled={!device}
            >
              Delete
            </Button>
          </Stack>
        }
      />

      {notice && (
        <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>
          {notice.message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Prominent lifecycle status */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <DeviceLifecycleChip status={device?.status} />
            {(device?.status === "receiving" || device?.status === "offline") && (
              <Typography variant="body2" color="text.secondary">
                last seen {formatAge(device?.lastSeenAgeSec)}
              </Typography>
            )}
          </Stack>
          {device?.status === "provisioned" && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              This device is registered. It will show as connected once it publishes to{" "}
              <Box component="code" sx={{ px: 0.5, py: 0.25, borderRadius: "4px", bgcolor: "action.hover" }}>
                site/{device?.siteId || "{siteId}"}/dev/{devId}/telemetry
              </Box>
              .
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Stat row */}
      <Grid container spacing={2} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<Activity size={20} />}
            label="Current K₂U"
            value={Number.isFinite(latest?.k2u) ? `${latest.k2u.toFixed(2)}%` : "—"}
            hint="GOST 32144-2013 band"
            tone={k2uTone(latest?.status)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<Radio size={20} />}
            label="Status"
            value={
              device?.status
                ? device.status.charAt(0).toUpperCase() + device.status.slice(1)
                : "—"
            }
            hint={device?.online ? "Online" : "Not currently online"}
            tone={lifecycleTone(device?.status)}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Remaining useful life"
            value={
              Number.isFinite(prediction?.rul) ? `${(prediction.rul * 100).toFixed(0)}%` : "—"
            }
            hint="AI prediction"
            tone="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard
            icon={<Timer size={20} />}
            label="Telemetry period"
            value={formatPeriod(device?.telemetryPeriodSec)}
            hint="Publish interval"
            tone="neutral"
          />
        </Grid>
      </Grid>

      {/* Recent voltages + operating point */}
      <Grid container spacing={2} sx={{ mt: 0.25 }}>
        <Grid item xs={12} lg={7}>
          <VoltageChart history={history} />
        </Grid>
        <Grid item xs={12} lg={5}>
          <OperatingPointCard telemetry={latest} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.25 }}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: "100%" }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Operating point (nomogram)
              </Typography>
              <Box sx={{ width: "100%", maxWidth: 340, mx: "auto" }}>
                <Nomogram point={point} trail={trail} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={7}>
          <GostPanel aggregates={aggregates} />
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.25, mb: 2 }}>
        <Grid item xs={12}>
          <RulPanel prediction={prediction} />
        </Grid>
      </Grid>

      {/* Configuration */}
      <Card>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h6">Configuration</Typography>
            <Button size="small" startIcon={<Pencil size={14} />} onClick={() => setEditOpen(true)} disabled={!device}>
              Edit
            </Button>
          </Stack>
          <Grid container spacing={2.5}>
            <ConfigItem icon={<Building2 size={16} />} label="Site" value={device?.siteId || "—"} />
            <ConfigItem
              icon={<Gauge size={16} />}
              label="Rated power"
              value={Number.isFinite(device?.ratedPower) ? `${device.ratedPower} kW` : "—"}
            />
            <ConfigItem
              icon={<BatteryCharging size={16} />}
              label="Energy delivered"
              value={Number.isFinite(device?.energyKwh) ? `${device.energyKwh} kWh` : "—"}
            />
            <ConfigItem
              icon={<Timer size={16} />}
              label="Service age"
              value={Number.isFinite(device?.serviceAge) ? `${device.serviceAge} yr` : "—"}
            />
            <ConfigItem
              icon={<Timer size={16} />}
              label="Telemetry period"
              value={formatPeriod(device?.telemetryPeriodSec)}
            />
            <ConfigItem
              icon={<CalendarClock size={16} />}
              label="Expiry"
              value={device?.expiresAt ? formatDateTime(device.expiresAt) : "Never"}
            />
            {showCoords ? (
              <ConfigItem
                icon={<MapPin size={16} />}
                label="Coordinates"
                value={
                  Number.isFinite(device?.location?.lat) && Number.isFinite(device?.location?.lon)
                    ? `${device.location.lat.toFixed(4)}, ${device.location.lon.toFixed(4)}`
                    : "—"
                }
              />
            ) : (
              <ConfigItem icon={<MapPinOff size={16} />} label="Coordinates" value="hidden" />
            )}
            {device?.location?.address && (
              <ConfigItem icon={<Building2 size={16} />} label="Address" value={device.location.address} />
            )}
          </Grid>
        </CardContent>
      </Card>

      <DeviceDialog
        open={editOpen}
        mode="edit"
        device={device}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => {
          setDevice((d) => ({ ...d, ...updated }));
          setNotice({ severity: "success", message: "Device updated." });
          refreshDevice();
        }}
      />

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)}>
        <DialogTitle>Delete this device?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove <strong>{device?.name || devId}</strong> ({devId}) and stop it
            from appearing on the dashboard. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete device"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

import { useEffect, useMemo, useState } from "react";
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
  TextField,
  MenuItem,
  Alert,
  Divider,
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Radio,
  Plus,
  Sparkles,
  MapPin,
  Sun,
  Antenna,
  Gauge,
  Hash,
  Building2,
} from "lucide-react";
import { api } from "../lib/api.js";
import { useLive } from "../lib/useLive.js";
import StatusBadge from "../components/StatusBadge.jsx";
import PageHeader from "../components/PageHeader.jsx";
import EmptyState from "../components/EmptyState.jsx";

const UZBEKISTAN_CENTER = [41.3, 69.2];
const DEFAULT_ZOOM = 6;

const STATUS_HEX = { NORMAL: "#2e7d32", WARNING: "#ed6c02", CRITICAL: "#d32f2f" };

const DEVICE_TYPE_LABEL = {
  pv_inverter: "PV inverter",
  telecom_rect: "Telecom rectifier",
};

const DEMO_DEVICES = [
  {
    name: "Rooftop PV Inverter A",
    devId: "K2U-01",
    siteId: "UZ-PV-01",
    siteName: "Tashkent Solar Rooftop",
    siteType: "pv",
    deviceType: "pv_inverter",
    ratedPower: 50,
    serviceAge: 2,
    lat: 41.2995,
    lon: 69.2401,
  },
  {
    name: "Telecom Tower Rectifier",
    devId: "K2U-02",
    siteId: "UZ-TC-01",
    siteName: "Samarkand Telecom Tower",
    siteType: "telecom",
    deviceType: "telecom_rect",
    ratedPower: 12,
    serviceAge: 5,
    lat: 39.6542,
    lon: 66.9597,
  },
  {
    name: "PV Inverter B",
    devId: "K2U-03",
    siteId: "UZ-PV-02",
    siteName: "Jizzakh Solar Farm",
    siteType: "pv",
    deviceType: "pv_inverter",
    ratedPower: 80,
    serviceAge: 1,
    lat: 40.1158,
    lon: 67.8422,
  },
];

/** Colored circular divIcon so we don't need to patch Leaflet's default marker assets under Vite. */
function statusIcon(status) {
  const color = STATUS_HEX[status] || "#8a94a6";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2.5px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -10],
  });
}

function DeviceTypeIcon({ deviceType, size = 18 }) {
  return deviceType === "telecom_rect" ? (
    <Antenna size={size} />
  ) : (
    <Sun size={size} />
  );
}

function emptyForm() {
  return {
    name: "",
    devId: "",
    siteId: "",
    deviceType: "pv_inverter",
    ratedPower: "",
    serviceAge: "",
    lat: "",
    lon: "",
    address: "",
  };
}

export default function Devices() {
  const { latest } = useLive();
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const [demoLoading, setDemoLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [d, s] = await Promise.all([api.devices(), api.sites()]);
      setDevices(Array.isArray(d) ? d : []);
      setSites(Array.isArray(s) ? s : []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load devices.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const siteById = useMemo(() => {
    const map = {};
    for (const s of sites) map[s.siteId] = s;
    return map;
  }, [sites]);

  const devicesWithCoords = useMemo(
    () =>
      devices.filter(
        (d) => Number.isFinite(d?.location?.lat) && Number.isFinite(d?.location?.lon),
      ),
    [devices],
  );

  function handleField(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleCreateDevice() {
    setFormError("");
    if (!form.name.trim() || !form.devId.trim() || !form.siteId.trim()) {
      setFormError("Name, device ID and site ID are required.");
      return;
    }
    const lat = form.lat === "" ? undefined : Number(form.lat);
    const lon = form.lon === "" ? undefined : Number(form.lon);
    if (form.lat !== "" && !Number.isFinite(lat)) {
      setFormError("Latitude must be a number.");
      return;
    }
    if (form.lon !== "" && !Number.isFinite(lon)) {
      setFormError("Longitude must be a number.");
      return;
    }

    const body = {
      devId: form.devId.trim(),
      siteId: form.siteId.trim(),
      name: form.name.trim(),
      deviceType: form.deviceType,
      ratedPower: form.ratedPower === "" ? undefined : Number(form.ratedPower),
      serviceAge: form.serviceAge === "" ? undefined : Number(form.serviceAge),
      location:
        lat !== undefined || lon !== undefined || form.address
          ? { lat, lon, address: form.address || undefined }
          : undefined,
    };

    setSubmitting(true);
    try {
      await api.createDevice(body);
      setDialogOpen(false);
      setForm(emptyForm());
      setNotice({ severity: "success", message: `Device "${body.name}" created.` });
      await refresh();
    } catch (err) {
      setFormError(err?.response?.data?.message || err.message || "Could not create device.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoadDemo() {
    setDemoLoading(true);
    setNotice(null);
    try {
      for (const d of DEMO_DEVICES) {
        try {
          await api.createSite({
            siteId: d.siteId,
            name: d.siteName,
            type: d.siteType,
            location: { lat: d.lat, lon: d.lon, address: d.siteName },
          });
        } catch {
          // site may already exist / endpoint may reject duplicates — continue.
        }
        await api.createDevice({
          devId: d.devId,
          siteId: d.siteId,
          name: d.name,
          deviceType: d.deviceType,
          ratedPower: d.ratedPower,
          serviceAge: d.serviceAge,
          location: { lat: d.lat, lon: d.lon, address: d.siteName },
        });
      }
      setNotice({ severity: "success", message: "Demo devices loaded." });
      await refresh();
    } catch (err) {
      setNotice({
        severity: "error",
        message:
          err?.response?.data?.message ||
          err.message ||
          "Could not load demo devices (backend may not support device creation yet).",
      });
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <Box>
      <PageHeader
        icon={<Radio size={22} />}
        title="Devices"
        subtitle="ESP32 monitoring units deployed across sites, with live K₂U status and location."
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<Sparkles size={16} />}
              onClick={handleLoadDemo}
              disabled={demoLoading}
            >
              {demoLoading ? "Loading…" : "Load demo devices"}
            </Button>
            <Button
              variant="contained"
              startIcon={<Plus size={16} />}
              onClick={() => {
                setFormError("");
                setDialogOpen(true);
              }}
            >
              Add device
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

      <Card sx={{ mb: 3, overflow: "hidden" }}>
        <Box sx={{ px: 2.5, pt: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Site map
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {devicesWithCoords.length} of {devices.length} device
            {devices.length === 1 ? "" : "s"} plotted (devices without coordinates are hidden).
          </Typography>
        </Box>
        <Box sx={{ height: 380 }}>
          <MapContainer
            center={UZBEKISTAN_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ height: "100%", width: "100%" }}
            scrollWheelZoom={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {devicesWithCoords.map((d) => {
              const t = latest[d.devId];
              return (
                <Marker
                  key={d.devId}
                  position={[d.location.lat, d.location.lon]}
                  icon={statusIcon(t?.status)}
                >
                  <Popup>
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {d.name || d.devId}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {d.devId} · {siteById[d.siteId]?.name || d.siteId}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        K₂U: {Number.isFinite(t?.k2u) ? `${t.k2u.toFixed(2)}%` : "—"}
                      </Typography>
                    </Stack>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </Box>
      </Card>

      {loading ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">Loading devices…</Typography>
          </CardContent>
        </Card>
      ) : devices.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<Radio size={24} />}
              title="No devices yet — add one"
              description="Register an ESP32 monitoring unit manually, or load a few demo devices to populate the map and dashboard for screenshots."
              actionLabel="Load demo devices"
              onAction={handleLoadDemo}
            />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {devices.map((d) => {
            const t = latest[d.devId];
            const site = siteById[d.siteId];
            return (
              <Grid item xs={12} sm={6} lg={4} key={d.devId}>
                <Card sx={{ height: "100%" }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Stack direction="row" spacing={1.25} alignItems="center">
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: "10px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "rgba(21,94,156,0.10)",
                            color: "primary.main",
                          }}
                        >
                          <DeviceTypeIcon deviceType={d.deviceType} />
                        </Box>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                            {d.name || d.devId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {DEVICE_TYPE_LABEL[d.deviceType] || d.deviceType || "Device"}
                          </Typography>
                        </Box>
                      </Stack>
                      <StatusBadge status={t?.status} />
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Stack spacing={0.75}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Hash size={14} color="#8a94a6" />
                        <Typography variant="body2" color="text.secondary">
                          {d.devId}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Building2 size={14} color="#8a94a6" />
                        <Typography variant="body2" color="text.secondary">
                          {site?.name || d.siteId}
                        </Typography>
                      </Stack>
                      {Number.isFinite(d?.location?.lat) && Number.isFinite(d?.location?.lon) && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <MapPin size={14} color="#8a94a6" />
                          <Typography variant="body2" color="text.secondary">
                            {d.location.lat.toFixed(4)}, {d.location.lon.toFixed(4)}
                          </Typography>
                        </Stack>
                      )}
                      {Number.isFinite(d.ratedPower) && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Gauge size={14} color="#8a94a6" />
                          <Typography variant="body2" color="text.secondary">
                            {d.ratedPower} kW rated
                          </Typography>
                        </Stack>
                      )}
                    </Stack>

                    <Divider sx={{ my: 1.5 }} />

                    <Stack direction="row" alignItems="baseline" spacing={1}>
                      <Typography variant="h4" sx={{ fontWeight: 700 }}>
                        {Number.isFinite(t?.k2u) ? `${t.k2u.toFixed(2)}%` : "—"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        latest K₂U
                      </Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add device</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField label="Device name" fullWidth value={form.name} onChange={handleField("name")} />
            <Stack direction="row" spacing={2}>
              <TextField label="Device ID" fullWidth value={form.devId} onChange={handleField("devId")} />
              <TextField label="Site ID" fullWidth value={form.siteId} onChange={handleField("siteId")} />
            </Stack>
            <TextField
              label="Device type"
              select
              fullWidth
              value={form.deviceType}
              onChange={handleField("deviceType")}
            >
              <MenuItem value="pv_inverter">PV inverter</MenuItem>
              <MenuItem value="telecom_rect">Telecom rectifier</MenuItem>
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Rated power (kW)"
                fullWidth
                value={form.ratedPower}
                onChange={handleField("ratedPower")}
              />
              <TextField
                label="Service age (years)"
                fullWidth
                value={form.serviceAge}
                onChange={handleField("serviceAge")}
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField label="Latitude" fullWidth value={form.lat} onChange={handleField("lat")} />
              <TextField label="Longitude" fullWidth value={form.lon} onChange={handleField("lon")} />
            </Stack>
            <TextField
              label="Address / site description (optional)"
              fullWidth
              value={form.address}
              onChange={handleField("address")}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateDevice} disabled={submitting}>
            {submitting ? "Creating…" : "Create device"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

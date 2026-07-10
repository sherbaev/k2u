import { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardActionArea,
  CardContent,
  CardActions,
  Typography,
  Stack,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  IconButton,
  Tooltip,
} from "@mui/material";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Radio,
  Plus,
  Sparkles,
  MapPin,
  MapPinOff,
  Sun,
  Antenna,
  Gauge,
  Hash,
  Building2,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Download,
} from "lucide-react";
import { api } from "../lib/api.js";
import { useLive } from "../lib/useLive.js";
import { useShowCoords, setShowCoords } from "../lib/prefs.js";
import { formatAge } from "../lib/format.js";
import { downloadFirmwareZip } from "../lib/firmwareGen.js";
import StatusBadge from "../components/StatusBadge.jsx";
import DeviceLifecycleChip from "../components/DeviceLifecycleChip.jsx";
import DeviceDialog from "../components/DeviceDialog.jsx";
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

export default function Devices() {
  const { latest } = useLive();
  const showCoords = useShowCoords();
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogDevice, setDialogDevice] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  function openCreateDialog() {
    setDialogMode("create");
    setDialogDevice(null);
    setDialogOpen(true);
  }

  function openEditDialog(device) {
    setDialogMode("edit");
    setDialogDevice(device);
    setDialogOpen(true);
  }

  async function handleDownloadFirmware(device) {
    try {
      await downloadFirmwareZip(device);
    } catch (err) {
      setNotice({ severity: "error", message: err.message || "Could not build firmware archive." });
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteDevice(deleteTarget.devId);
      setNotice({
        severity: "success",
        message: `Device "${deleteTarget.name || deleteTarget.devId}" deleted.`,
      });
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      setNotice({
        severity: "error",
        message: err?.response?.data?.message || err.message || "Could not delete device.",
      });
    } finally {
      setDeleting(false);
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
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Tooltip title={showCoords ? "Hide coordinates" : "Show coordinates"}>
              <IconButton
                onClick={() => setShowCoords(!showCoords)}
                size="small"
                aria-label="Toggle coordinate visibility"
                sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px" }}
              >
                {showCoords ? <Eye size={17} /> : <EyeOff size={17} />}
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              startIcon={<Sparkles size={16} />}
              onClick={handleLoadDemo}
              disabled={demoLoading}
            >
              {demoLoading ? "Loading…" : "Load demo devices"}
            </Button>
            <Button variant="contained" startIcon={<Plus size={16} />} onClick={openCreateDialog}>
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
            {showCoords
              ? `${devicesWithCoords.length} of ${devices.length} device${devices.length === 1 ? "" : "s"} plotted (devices without coordinates are hidden).`
              : "Coordinates are hidden — toggle the eye icon above to show the map."}
          </Typography>
        </Box>
        {showCoords ? (
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
        ) : (
          <Box
            sx={{
              height: 380,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
              color: "text.secondary",
              bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.02)" : "rgba(15,23,42,0.02)"),
            }}
          >
            <MapPinOff size={28} />
            <Typography variant="body2">Device locations are hidden for privacy.</Typography>
          </Box>
        )}
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
                <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                  <CardActionArea
                    component={RouterLink}
                    to={`/devices/${encodeURIComponent(d.devId)}`}
                    sx={{ flexGrow: 1, alignItems: "stretch", justifyContent: "flex-start", display: "block" }}
                  >
                    <CardContent>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
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
                              flexShrink: 0,
                            }}
                          >
                            <DeviceTypeIcon deviceType={d.deviceType} />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                              {d.name || d.devId}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {DEVICE_TYPE_LABEL[d.deviceType] || d.deviceType || "Device"}
                            </Typography>
                          </Box>
                        </Stack>
                        <DeviceLifecycleChip status={d.status} size="small" />
                      </Stack>

                      {(d.status === "receiving" || d.status === "offline") && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                          last seen {formatAge(d.lastSeenAgeSec)}
                        </Typography>
                      )}

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
                            {showCoords ? <MapPin size={14} color="#8a94a6" /> : <MapPinOff size={14} color="#8a94a6" />}
                            <Typography variant="body2" color="text.secondary">
                              {showCoords ? `${d.location.lat.toFixed(4)}, ${d.location.lon.toFixed(4)}` : "coordinates hidden"}
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

                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" alignItems="baseline" spacing={1}>
                          <Typography variant="h4" sx={{ fontWeight: 700 }}>
                            {Number.isFinite(t?.k2u) ? `${t.k2u.toFixed(2)}%` : "—"}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            latest K₂U
                          </Typography>
                        </Stack>
                        <StatusBadge status={t?.status} />
                      </Stack>
                    </CardContent>
                  </CardActionArea>

                  <Divider />
                  <CardActions sx={{ px: 1.5, py: 0.5, justifyContent: "flex-end" }}>
                    <Tooltip title="Download firmware">
                      <IconButton size="small" onClick={() => handleDownloadFirmware(d)}>
                        <Download size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit device">
                      <IconButton size="small" onClick={() => openEditDialog(d)}>
                        <Pencil size={16} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete device">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(d)}>
                        <Trash2 size={16} />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      <DeviceDialog
        open={dialogOpen}
        mode={dialogMode}
        device={dialogDevice}
        onClose={() => setDialogOpen(false)}
        onSaved={(updated, mode) => {
          if (mode === "edit") {
            setDevices((prev) => prev.map((d) => (d.devId === updated.devId ? { ...d, ...updated } : d)));
            setNotice({ severity: "success", message: "Device updated." });
          } else {
            setNotice({ severity: "success", message: `Device "${updated?.name || updated?.devId}" created.` });
            refresh();
          }
        }}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)}>
        <DialogTitle>Delete this device?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove{" "}
            <strong>{deleteTarget?.name || deleteTarget?.devId}</strong> ({deleteTarget?.devId}) and stop
            it from appearing on the dashboard. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button color="error" variant="contained" onClick={handleDeleteConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete device"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

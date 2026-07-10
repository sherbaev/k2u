import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  MenuItem,
  Button,
  Alert,
  Divider,
  Typography,
} from "@mui/material";
import { api } from "../lib/api.js";
import { toDateInputValue, fromDateInputValue } from "../lib/format.js";

const PERIOD_OPTIONS = [
  { value: 10, label: "10 seconds" },
  { value: 30, label: "30 seconds" },
  { value: 60, label: "1 minute" },
  { value: 300, label: "5 minutes" },
  { value: 900, label: "15 minutes" },
  { value: 3600, label: "1 hour" },
];

function emptyForm() {
  return {
    name: "",
    devId: "",
    siteId: "",
    deviceType: "pv_inverter",
    ratedPower: "",
    energyKwh: "",
    serviceAge: "",
    lat: "",
    lon: "",
    address: "",
    telemetryPeriodSec: 3600,
    expiresAt: "",
  };
}

function formFromDevice(device) {
  return {
    name: device?.name || "",
    devId: device?.devId || "",
    siteId: device?.siteId || "",
    deviceType: device?.deviceType || "pv_inverter",
    ratedPower: Number.isFinite(device?.ratedPower) ? String(device.ratedPower) : "",
    energyKwh: Number.isFinite(device?.energyKwh) ? String(device.energyKwh) : "",
    serviceAge: Number.isFinite(device?.serviceAge) ? String(device.serviceAge) : "",
    lat: Number.isFinite(device?.location?.lat) ? String(device.location.lat) : "",
    lon: Number.isFinite(device?.location?.lon) ? String(device.location.lon) : "",
    address: device?.location?.address || "",
    telemetryPeriodSec: Number.isFinite(device?.telemetryPeriodSec) ? device.telemetryPeriodSec : 3600,
    expiresAt: toDateInputValue(device?.expiresAt),
  };
}

/**
 * Shared create/edit dialog for devices. In "create" mode it posts a new
 * device and navigates to its detail page; in "edit" mode it patches the
 * existing device and hands the updated record back via onSaved so the
 * caller can refresh in place (no navigation).
 *
 * Props:
 *   open, onClose()
 *   mode: "create" | "edit"
 *   device: existing device (required for edit — used to prefill + disable devId)
 *   onSaved(device, mode): called after a successful create/patch
 */
export default function DeviceDialog({ open, mode = "create", device, onClose, onSaved }) {
  const navigate = useNavigate();
  const isEdit = mode === "edit";
  const [form, setForm] = useState(isEdit ? formFromDevice(device) : emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(isEdit ? formFromDevice(device) : emptyForm());
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, device, isEdit]);

  function field(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function parseOptionalNumber(raw, label, errors) {
    if (raw === "" || raw === undefined || raw === null) return undefined;
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      errors.push(`${label} must be a number.`);
      return undefined;
    }
    return n;
  }

  async function handleSave() {
    setError("");
    const errors = [];

    if (!form.name.trim()) errors.push("Name is required.");
    if (!form.devId.trim()) errors.push("Device ID is required.");
    if (!form.siteId.trim()) errors.push("Site ID is required.");

    const ratedPower = parseOptionalNumber(form.ratedPower, "Rated power", errors);
    const energyKwh = parseOptionalNumber(form.energyKwh, "Energy", errors);
    const serviceAge = parseOptionalNumber(form.serviceAge, "Service age", errors);
    const lat = parseOptionalNumber(form.lat, "Latitude", errors);
    const lon = parseOptionalNumber(form.lon, "Longitude", errors);

    if (errors.length) {
      setError(errors.join(" "));
      return;
    }

    const hasLocation = lat !== undefined || lon !== undefined || Boolean(form.address.trim());
    const body = {
      devId: form.devId.trim(),
      siteId: form.siteId.trim(),
      name: form.name.trim(),
      deviceType: form.deviceType,
      ratedPower,
      energyKwh,
      serviceAge,
      telemetryPeriodSec: Number(form.telemetryPeriodSec) || 3600,
      expiresAt: fromDateInputValue(form.expiresAt),
      location: hasLocation
        ? { lat, lon, address: form.address.trim() || undefined }
        : undefined,
    };

    setSubmitting(true);
    try {
      if (isEdit) {
        const updated = await api.patchDevice(device.devId, body);
        setSubmitting(false);
        onSaved && onSaved(updated || { ...device, ...body }, "edit");
        onClose && onClose();
      } else {
        const created = await api.createDevice(body);
        setSubmitting(false);
        onSaved && onSaved(created || body, "create");
        onClose && onClose();
        navigate(`/devices/${encodeURIComponent(body.devId)}`);
      }
    } catch (err) {
      setSubmitting(false);
      setError(
        err?.response?.data?.message || err.message || `Could not ${isEdit ? "update" : "create"} device.`,
      );
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? "Edit device" : "Add device"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField label="Device name" fullWidth value={form.name} onChange={field("name")} autoFocus />

          <Stack direction="row" spacing={2}>
            <TextField
              label="Device ID"
              fullWidth
              value={form.devId}
              onChange={field("devId")}
              disabled={isEdit}
              helperText={isEdit ? "Device ID cannot be changed." : "Must match the ESP32's MQTT client / topic ID."}
            />
            <TextField label="Site ID" fullWidth value={form.siteId} onChange={field("siteId")} />
          </Stack>

          <TextField label="Device type" select fullWidth value={form.deviceType} onChange={field("deviceType")}>
            <MenuItem value="pv_inverter">PV inverter</MenuItem>
            <MenuItem value="telecom_rect">Telecom rectifier</MenuItem>
          </TextField>

          <Stack direction="row" spacing={2}>
            <TextField label="Rated power (kW)" fullWidth value={form.ratedPower} onChange={field("ratedPower")} />
            <TextField label="Energy delivered (kWh)" fullWidth value={form.energyKwh} onChange={field("energyKwh")} />
          </Stack>

          <Stack direction="row" spacing={2}>
            <TextField label="Service age (years)" fullWidth value={form.serviceAge} onChange={field("serviceAge")} />
            <TextField
              label="Telemetry period"
              select
              fullWidth
              value={form.telemetryPeriodSec}
              onChange={field("telemetryPeriodSec")}
            >
              {PERIOD_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              Location
            </Typography>
          </Divider>

          <Stack direction="row" spacing={2}>
            <TextField label="Latitude" fullWidth value={form.lat} onChange={field("lat")} />
            <TextField label="Longitude" fullWidth value={form.lon} onChange={field("lon")} />
          </Stack>
          <TextField
            label="Address / site description (optional)"
            fullWidth
            value={form.address}
            onChange={field("address")}
          />

          <Divider textAlign="left">
            <Typography variant="caption" color="text.secondary">
              Lifecycle
            </Typography>
          </Divider>

          <TextField
            label="Expiry date (optional)"
            type="date"
            fullWidth
            value={form.expiresAt}
            onChange={field("expiresAt")}
            InputLabelProps={{ shrink: true }}
            helperText="Leave empty for no expiry. After this date the device is archived automatically."
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={submitting}>
          {submitting ? "Saving…" : isEdit ? "Save changes" : "Create device"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

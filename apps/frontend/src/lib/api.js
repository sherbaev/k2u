import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || ""; // "" -> Vite dev proxy

const http = axios.create({ baseURL, timeout: 15000 });

export const api = {
  health: () => http.get("/api/health").then((r) => r.data),
  sites: () => http.get("/api/sites").then((r) => r.data),
  devices: (siteId) => http.get("/api/devices", { params: { siteId } }).then((r) => r.data),
  latest: (devId) => http.get("/api/latest", { params: { devId } }).then((r) => r.data),
  history: (params) => http.get("/api/history", { params }).then((r) => r.data),
  aggregates: (params) => http.get("/api/aggregates", { params }).then((r) => r.data),
  events: (params) => http.get("/api/events", { params }).then((r) => r.data),
  predictions: (params) => http.get("/api/predictions", { params }).then((r) => r.data),
  compliance: (params) => http.get("/api/compliance", { params }).then((r) => r.data),
  createDevice: (body) => http.post("/api/devices", body).then((r) => r.data),
  createSite: (body) => http.post("/api/sites", body).then((r) => r.data),
};

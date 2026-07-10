# @k2u/frontend

React 18 + Vite + MUI dashboard for the K₂U monitoring platform. Live data via
WebSocket (`/ws/live`), historical/config via REST (`/api`).

## Run

```bash
pnpm install
pnpm --filter @k2u/frontend dev      # http://localhost:5173
```

The Vite dev server proxies `/api` and `/ws` to the backend on `:3000`
(see `vite.config.js`), so run the backend + `docker compose up -d` first.
For production, set `VITE_API_URL` / `VITE_WS_URL` to the deployed backend.

## Layout

- `src/lib/k2u.js` — K₂U math (plain-JS mirror of the tested `@k2u/core`; kept in
  JS so the app + `node --test` need no TS toolchain). **Verified** against the
  same invariants in `src/lib/__tests__/k2u.test.js`.
- `src/lib/geometry.js` — nomogram SVG coordinate mapping + curve generation (pure, tested).
- `src/lib/api.js` — axios REST client. `src/lib/useLive.js` — WebSocket live hook (auto-reconnect).
- `src/components/Nomogram.jsx` — the polar nomogram (iso-K₂U curves, 2%/4% GOST zones,
  radial phase-angle lines, live operating point + trail, optional drag inverse mode).
- `src/components/` — `OperatingPointCard`, `VoltageChart` (recharts), `AlertsPanel`,
  `GostPanel`, `RulPanel`, `StatusBadge`.
- `src/pages/Dashboard.jsx` — composes the panels, fed by the live hook + REST.

## Tests

```bash
pnpm --filter @k2u/frontend test     # node --test on src/lib/__tests__
```

## Notes

- The original dependency list pinned some non-existent versions (`@mui/material@9`,
  `jspdf@4`, `lucide-react@1`, `react-day-picker@10`); these are pinned here to the
  real latest majors. `three` and `@dnd-kit/*` are deferred (no confirmed use yet;
  dnd-kit will drive draggable panels in a later pass).
- `jspdf` + `jszip` will back the GOST report export (Reports panel, later phase).

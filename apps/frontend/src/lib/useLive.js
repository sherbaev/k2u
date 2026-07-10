import { useEffect, useRef, useState } from "react";

/**
 * Subscribe to the backend WebSocket at /ws/live and expose the latest
 * telemetry per device plus a rolling history buffer and recent events.
 * Auto-reconnects with backoff.
 */
export function useLive({ historyLimit = 300 } = {}) {
  const [connected, setConnected] = useState(false);
  const [latest, setLatest] = useState({}); // devId -> telemetry
  const [history, setHistory] = useState([]); // recent telemetry (all devices)
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);
  const backoff = useRef(1000);

  useEffect(() => {
    let closed = false;

    function wsUrl() {
      const env = import.meta.env.VITE_WS_URL;
      if (env) return env;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      return `${proto}://${location.host}/ws/live`;
    }

    function connect() {
      if (closed) return;
      const ws = new WebSocket(wsUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        backoff.current = 1000;
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) setTimeout(connect, backoff.current);
        backoff.current = Math.min(backoff.current * 2, 30000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.kind === "telemetry") {
          const t = msg.data;
          const devId = t.meta?.devId ?? t.dev_id;
          setLatest((prev) => ({ ...prev, [devId]: t }));
          setHistory((prev) => {
            const next = [...prev, t];
            return next.length > historyLimit ? next.slice(-historyLimit) : next;
          });
        } else if (msg.kind === "event") {
          setEvents((prev) => [msg.data, ...prev].slice(0, 200));
        }
      };
    }

    connect();
    return () => {
      closed = true;
      wsRef.current?.close();
    };
  }, [historyLimit]);

  return { connected, latest, history, events };
}

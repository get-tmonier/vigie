import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '#shared/config/env';
import type { DaemonEvent } from '#shared/types/daemon-event';

export function useEventsWs() {
  const [events, setEvents] = useState<DaemonEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      if (!mountedRef.current) return;

      const apiUrl = env.VITE_API_URL;
      const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/ws/events`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.addEventListener('open', () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setEvents((prev) => [...prev, { type: 'daemon:connected' }]);
      });

      ws.addEventListener('message', (event) => {
        if (!mountedRef.current) return;
        if (typeof event.data !== 'string') return;
        try {
          const data = JSON.parse(event.data) as DaemonEvent;
          setEvents((prev) => [...prev, data]);
        } catch {}
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        if (wsRef.current === ws) {
          setConnected(false);
          setEvents((prev) => [...prev, { type: 'daemon:disconnected' }]);
          wsRef.current = null;
          // Reconnect after delay
          reconnectTimer.current = setTimeout(connect, 2000);
        }
      });

      ws.addEventListener('error', () => {
        if (!mountedRef.current) return;
        // error is followed by close, so reconnect happens in close handler
        setConnected(false);
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setConnected(false);
    };
  }, []);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, clear };
}

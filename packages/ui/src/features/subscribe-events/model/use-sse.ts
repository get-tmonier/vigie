import type { SSEEvent } from '@tmonier/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDaemonEventSource } from '../api/event-source';

export function useSSE(daemonId: string | null) {
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [daemonOnline, setDaemonOnline] = useState(true);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!daemonId) return;

    setEvents([]);
    const es = createDaemonEventSource(daemonId);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    const handleEvent = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as SSEEvent;
        if (data.type === 'daemon:connected') {
          setDaemonOnline(true);
        } else if (data.type === 'daemon:disconnected') {
          setDaemonOnline(false);
        }
        setEvents((prev) => [...prev, data]);
      } catch {
        // ignore invalid events
      }
    };

    es.addEventListener('command:output', handleEvent);
    es.addEventListener('command:done', handleEvent);
    es.addEventListener('command:error', handleEvent);
    es.addEventListener('daemon:connected', handleEvent);
    es.addEventListener('daemon:disconnected', handleEvent);
    es.addEventListener('session:started', handleEvent);
    es.addEventListener('session:output', handleEvent);
    es.addEventListener('session:ended', handleEvent);

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, [daemonId]);

  const clear = useCallback(() => setEvents([]), []);

  return { events, connected, daemonOnline, clear };
}

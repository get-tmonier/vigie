import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentSession } from '../api/session-api';
import { listSessions } from '../api/session-api';

export function useSessions(daemonId: string | null) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;

    if (!daemonId) {
      setSessions([]);
      return;
    }

    const fetchSessions = async () => {
      setLoading(true);
      try {
        const result = await listSessions(daemonId);
        if (active.current) setSessions(result);
      } catch {
        if (active.current) setSessions([]);
      } finally {
        if (active.current) setLoading(false);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);

    return () => {
      active.current = false;
      clearInterval(interval);
    };
  }, [daemonId]);

  const refresh = useCallback(async () => {
    if (!daemonId) return;
    try {
      const result = await listSessions(daemonId);
      setSessions(result);
    } catch {}
  }, [daemonId]);

  return { sessions, loading, refresh };
}

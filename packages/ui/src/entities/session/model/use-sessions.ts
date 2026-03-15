import type { SSEEvent } from '@tmonier/shared';
import { useEffect, useRef, useState } from 'react';
import type { AgentSession } from '../api/session-api';
import { listSessions } from '../api/session-api';

export function useSessions(daemonId: string | null, events: SSEEvent[]) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const processedCount = useRef(0);

  useEffect(() => {
    processedCount.current = 0;

    if (!daemonId) {
      setSessions([]);
      return;
    }

    let active = true;
    setLoading(true);

    listSessions(daemonId)
      .then((result) => {
        if (active) setSessions(result);
      })
      .catch(() => {
        if (active) setSessions([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [daemonId]);

  useEffect(() => {
    const newEvents = events.slice(processedCount.current);
    if (newEvents.length === 0) return;
    processedCount.current = events.length;

    for (const event of newEvents) {
      if (event.type === 'session:started') {
        const newSession: AgentSession = {
          id: event.sessionId,
          daemonId: event.daemonId,
          agentType: event.agentType,
          cwd: event.cwd,
          gitBranch: event.gitBranch,
          repoName: event.repoName,
          startedAt: event.timestamp,
          status: 'active',
        };
        setSessions((prev) => {
          if (prev.some((s) => s.id === event.sessionId)) return prev;
          return [...prev, newSession];
        });
      } else if (event.type === 'session:ended' || event.type === 'session:error') {
        setSessions((prev) =>
          prev.map((s) => (s.id === event.sessionId ? { ...s, status: 'ended' } : s))
        );
      }
    }
  }, [events]);

  return { sessions, loading };
}

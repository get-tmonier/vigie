import type { SSEEvent } from '@tmonier/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentSession } from '../api/session-api';
import { listSessions } from '../api/session-api';

export function useSessions(daemonId: string | null, events: SSEEvent[]) {
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [daemonReconnectCount, setDaemonReconnectCount] = useState(0);
  const processedCount = useRef(0);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch sessions from REST — runs on initial mount and after daemon reconnect.
  // Also bumps daemonReconnectCount so terminal WS connections re-establish
  // AFTER sync has populated the relay buffers (not before).
  const fetchSessions = useCallback((id: string) => {
    listSessions(id)
      .then((result) => {
        setSessions(result);
        setDaemonReconnectCount((c) => c + 1);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    processedCount.current = 0;
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

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
      // When daemon reconnects, re-fetch full session list from REST after a
      // short delay so daemon:sync has time to populate the API's sessionStore.
      // This gives us the same complete data as a fresh page load.
      if (event.type === 'daemon:connected' && daemonId) {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => fetchSessions(daemonId), 500);
        continue;
      }

      if (event.type === 'session:started') {
        const resumable =
          'resumable' in event && typeof event.resumable === 'boolean'
            ? event.resumable
            : undefined;
        const claudeSessionId =
          'claudeSessionId' in event && typeof event.claudeSessionId === 'string'
            ? event.claudeSessionId
            : undefined;
        const newSession: AgentSession = {
          id: event.sessionId,
          daemonId: event.daemonId,
          agentType: event.agentType,
          mode: event.mode ?? 'prompt',
          cwd: event.cwd,
          gitBranch: event.gitBranch,
          repoName: event.repoName,
          startedAt: event.timestamp,
          status: 'active',
          ...(resumable !== undefined && { resumable }),
          ...(claudeSessionId !== undefined && { claudeSessionId }),
        };
        setSessions((prev) => {
          const existing = prev.find((s) => s.id === event.sessionId);
          if (existing) {
            return prev.map((s) =>
              s.id === event.sessionId
                ? {
                    ...s,
                    ...newSession,
                    resumable: resumable ?? s.resumable,
                    status: 'active' as const,
                  }
                : s
            );
          }
          return [...prev, newSession];
        });
      } else if (event.type === 'session:ended') {
        const resumable = 'resumable' in event ? (event.resumable as boolean) : false;
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId
              ? { ...s, status: 'ended' as const, exitCode: event.exitCode, resumable }
              : s
          )
        );
      } else if (event.type === 'session:error' || event.type === 'session:spawn-failed') {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === event.sessionId ? { ...s, status: 'ended' as const, exitCode: -1 } : s
          )
        );
      } else if (event.type === 'session:claude-id-detected') {
        if ('sessionId' in event && 'claudeSessionId' in event) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === event.sessionId
                ? { ...s, claudeSessionId: event.claudeSessionId as string }
                : s
            )
          );
        }
      } else if (event.type === 'session:resumable-changed') {
        if ('sessionId' in event && 'resumable' in event) {
          setSessions((prev) =>
            prev.map((s) =>
              s.id === event.sessionId ? { ...s, resumable: event.resumable as boolean } : s
            )
          );
        }
      }
    }
  }, [events, daemonId, fetchSessions]);

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const removeEndedSessions = useCallback(() => {
    setSessions((prev) => prev.filter((s) => s.status !== 'ended'));
  }, []);

  return { sessions, loading, daemonReconnectCount, removeSession, removeEndedSessions };
}

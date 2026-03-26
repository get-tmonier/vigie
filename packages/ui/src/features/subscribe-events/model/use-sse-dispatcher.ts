import type { SSEEvent } from '@vigie/shared';
import { useEffect, useRef } from 'react';
import { useAppDispatch } from '#app/hooks';
import {
  daemonConnected,
  daemonDisconnected,
  eventAdded,
  eventsReset,
} from '#entities/connection/model/connection-slice';
import { inputEchoReceived } from '#entities/input-history/model/input-history-slice';
import { listSessions } from '#entities/session/api/session-api';
import {
  claudeIdDetected,
  daemonSessionsReset,
  resumableChanged,
  sessionEnded,
  sessionErrored,
  sessionStarted,
  sessionsLoaded,
  sessionsLoading,
} from '#entities/session/model/sessions-slice';

export function useSSEDispatcher(events: SSEEvent[], daemonId: string | null) {
  const dispatch = useAppDispatch();
  const processedCount = useRef(0);
  const prevDaemonIdRef = useRef<string | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const daemonIdRef = useRef(daemonId);
  daemonIdRef.current = daemonId;

  // Reset slices when daemonId changes, then do initial fetch
  useEffect(() => {
    const prev = prevDaemonIdRef.current;
    prevDaemonIdRef.current = daemonId;

    if (fetchTimerRef.current) {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = null;
    }

    processedCount.current = 0;
    dispatch(eventsReset());

    if (prev) {
      dispatch(daemonSessionsReset(prev));
    }

    if (!daemonId) return;

    dispatch(sessionsLoading(daemonId));
    listSessions(daemonId)
      .then((sessions) => {
        dispatch(sessionsLoaded({ daemonId, sessions }));
      })
      .catch(() => {
        dispatch(sessionsLoaded({ daemonId, sessions: [] }));
      });
  }, [daemonId, dispatch]);

  // Process new events and dispatch to slices
  useEffect(() => {
    const newEvents = events.slice(processedCount.current);
    if (newEvents.length === 0) return;
    processedCount.current = events.length;

    for (const event of newEvents) {
      dispatch(eventAdded(event));

      switch (event.type) {
        case 'daemon:connected':
          dispatch(daemonConnected(event));
          if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
          fetchTimerRef.current = setTimeout(() => {
            const id = daemonIdRef.current;
            if (id) {
              listSessions(id)
                .then((sessions) => {
                  dispatch(sessionsLoaded({ daemonId: id, sessions }));
                })
                .catch(() => {});
            }
          }, 500);
          break;
        case 'daemon:disconnected':
          dispatch(daemonDisconnected(event));
          break;
        case 'session:started':
          dispatch(sessionStarted(event));
          break;
        case 'session:ended':
          dispatch(sessionEnded(event));
          break;
        case 'session:error':
        case 'session:spawn-failed':
          dispatch(sessionErrored(event));
          break;
        case 'session:claude-id-detected':
          dispatch(claudeIdDetected(event));
          break;
        case 'session:resumable-changed':
          dispatch(resumableChanged(event));
          break;
        case 'terminal:input-echo':
          dispatch(inputEchoReceived(event));
          break;
        // command:output, command:done, command:error, session:output → raw events only
      }
    }
  }, [events, dispatch]);
}

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
  resumableChanged,
  sessionEnded,
  sessionErrored,
  sessionStarted,
  sessionsLoaded,
  sessionsLoading,
  sessionsReset,
} from '#entities/session/model/sessions-slice';
import type { DaemonEvent } from '#shared/types/daemon-event';

export function useSSEDispatcher(events: DaemonEvent[]) {
  const dispatch = useAppDispatch();
  const processedCount = useRef(0);
  const initializedRef = useRef(false);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initial fetch on mount
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    dispatch(eventsReset());
    dispatch(sessionsReset());
    dispatch(sessionsLoading());

    listSessions()
      .then((sessions) => {
        dispatch(sessionsLoaded({ sessions }));
      })
      .catch(() => {
        dispatch(sessionsLoaded({ sessions: [] }));
      });

    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
        fetchTimerRef.current = null;
      }
    };
  }, [dispatch]);

  // Process new events and dispatch to slices
  useEffect(() => {
    const newEvents = events.slice(processedCount.current);
    if (newEvents.length === 0) return;
    processedCount.current = events.length;

    for (const event of newEvents) {
      dispatch(eventAdded(event));

      switch (event.type) {
        case 'daemon:connected':
          dispatch(daemonConnected());
          if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
          fetchTimerRef.current = setTimeout(() => {
            listSessions()
              .then((sessions) => {
                dispatch(sessionsLoaded({ sessions }));
              })
              .catch(() => {});
          }, 500);
          break;
        case 'daemon:disconnected':
          dispatch(daemonDisconnected());
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

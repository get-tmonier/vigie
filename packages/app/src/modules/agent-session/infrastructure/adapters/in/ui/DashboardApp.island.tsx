import { useEffect, useRef } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { InteractiveTerminal } from '#modules/agent-session/infrastructure/adapters/in/ui/InteractiveTerminal.island';
import { cn } from '#shared/lib/cn';
import { DashboardLayout } from '#shared/ui/DashboardLayout';
import { Header } from '#shared/ui/Header';
import { SessionCard } from './SessionCard';
import { SessionDetailHeader } from './SessionDetailHeader';
import { SpawnSessionFormIsland } from './SpawnSessionForm.island';
import { sessionsSlice } from './sessions.slice';
import { type AppDispatch, homedir, type RootState, store } from './store';

type WsEvent =
  | { type: 'snapshot'; sessions: AgentSession[] }
  | { type: 'session:started'; sessionId: string; timestamp: number }
  | {
      type: 'session:ended';
      sessionId: string;
      exitCode?: number;
      resumable: boolean;
      timestamp: number;
    }
  | { type: 'session:deleted'; sessionId: string; timestamp: number }
  | { type: 'sessions:cleared'; timestamp: number }
  | { type: 'session:resumable-changed'; sessionId: string; resumable: boolean; timestamp: number }
  | { type: string };

function useSessionEvents(dispatch: AppDispatch) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      if (!mountedRef.current) return;
      const wsUrl = `${location.origin.replace(/^http/, 'ws')}/ws/events`;
      const ws = new WebSocket(wsUrl);

      ws.addEventListener('message', (e) => {
        if (!mountedRef.current || typeof e.data !== 'string') return;
        try {
          const event = JSON.parse(e.data) as WsEvent;
          if (event.type === 'snapshot') {
            const e = event as Extract<WsEvent, { type: 'snapshot' }>;
            dispatch(sessionsSlice.actions.snapshotReceived(e.sessions));
          } else if (event.type === 'session:started') {
            fetch('/api/sessions')
              .then((r) => r.json())
              .then((data: { sessions: AgentSession[] }) =>
                dispatch(sessionsSlice.actions.snapshotReceived(data.sessions))
              )
              .catch(() => {});
          } else if (event.type === 'session:ended') {
            const e = event as Extract<WsEvent, { type: 'session:ended' }>;
            dispatch(
              sessionsSlice.actions.sessionEnded({
                sessionId: e.sessionId,
                exitCode: e.exitCode,
                resumable: e.resumable,
              })
            );
          } else if (event.type === 'session:deleted') {
            const e = event as Extract<WsEvent, { type: 'session:deleted' }>;
            dispatch(sessionsSlice.actions.sessionRemoved(e.sessionId));
          } else if (event.type === 'sessions:cleared') {
            dispatch(sessionsSlice.actions.endedSessionsCleared());
          } else if (event.type === 'session:resumable-changed') {
            const e = event as Extract<WsEvent, { type: 'session:resumable-changed' }>;
            dispatch(
              sessionsSlice.actions.sessionResumableChanged({
                sessionId: e.sessionId,
                resumable: e.resumable,
              })
            );
          }
        } catch {}
      });

      ws.addEventListener('close', () => {
        if (!mountedRef.current) return;
        reconnectTimer = setTimeout(connect, 2000);
      });
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [dispatch]);
}

function DashboardAppInner() {
  const dispatch = useDispatch<AppDispatch>();
  const sessions = useSelector((s: RootState) => s.sessions.sessions);
  const selectedId = useSelector((s: RootState) => s.sessions.selectedId);

  useSessionEvents(dispatch);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const endedSessions = sessions.filter((s) => s.status !== 'active');
  const selectedSession =
    sessions.find((s) => s.id === selectedId) ?? activeSessions[0] ?? sessions[0];

  const selectSession = (id: string) => {
    dispatch(sessionsSlice.actions.sessionSelected(id));
    history.pushState(null, '', `/?session=${id}`);
  };

  const handleKill = async (sessionId: string) => {
    await fetch(`/api/sessions/${sessionId}/kill`, { method: 'POST' }).catch(() => {});
  };

  const handleResume = async (sessionId: string) => {
    const res = await fetch(`/api/sessions/${sessionId}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols: window.innerWidth > 0 ? 220 : 120, rows: 50 }),
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { sessionId: string };
      // WS session:started will update the store; select the resumed session
      dispatch(sessionsSlice.actions.sessionSelected(data.sessionId));
      history.pushState(null, '', `/?session=${data.sessionId}`);
    }
  };

  const handleDelete = async (sessionId: string) => {
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleKillAll = async () => {
    await fetch('/api/sessions/kill-all', { method: 'POST' }).catch(() => {});
  };

  const handleClearEnded = async () => {
    await fetch('/api/sessions/clear-ended', { method: 'POST' }).catch(() => {});
    dispatch(sessionsSlice.actions.endedSessionsCleared());
  };

  const handleSpawned = (sessionId: string) => {
    dispatch(sessionsSlice.actions.sessionSelected(sessionId));
    history.pushState(null, '', `/?session=${sessionId}`);
  };

  return (
    <DashboardLayout
      sidebar={
        <>
          <Header />

          <div className="flex items-center justify-between px-3 py-2 shadow-[0_1px_0_0_rgba(22,45,74,0.6)]">
            <span className="font-mono text-[0.65rem] text-cream-200/60 uppercase tracking-[0.1em]">
              Sessions
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sessions.length === 0 && (
              <p className="text-cream-200/50 text-xs text-center mt-8 font-body">
                No sessions yet
              </p>
            )}

            {activeSessions.length > 0 && (
              <>
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                    Active
                  </span>
                  <button
                    type="button"
                    onClick={handleKillAll}
                    className="text-[0.6rem] font-mono text-cream-200/50 hover:text-danger transition-colors cursor-pointer"
                  >
                    Kill all ({activeSessions.length})
                  </button>
                </div>
                {activeSessions.map((session, i) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className={cn(
                      'w-full text-left animate-[fadeIn_0.2s_ease-out_both] no-underline block'
                    )}
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <SessionCard session={session} selected={session.id === selectedSession?.id} />
                  </button>
                ))}
              </>
            )}

            {endedSessions.length > 0 && (
              <>
                <div className="flex items-center justify-between px-1 pt-2">
                  <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                    Ended
                  </span>
                  <button
                    type="button"
                    onClick={handleClearEnded}
                    className="text-[0.6rem] font-mono text-cream-200/50 hover:text-cream-200 transition-colors cursor-pointer"
                  >
                    Clear ({endedSessions.length})
                  </button>
                </div>
                {endedSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => selectSession(session.id)}
                    className="w-full text-left block"
                  >
                    <SessionCard session={session} selected={session.id === selectedSession?.id} />
                  </button>
                ))}
              </>
            )}
          </div>

          <SpawnSessionFormIsland
            defaultCwd={selectedSession?.cwd ?? homedir}
            onSpawned={handleSpawned}
          />
        </>
      }
      main={
        selectedSession ? (
          <>
            <SessionDetailHeader
              session={selectedSession}
              onKill={
                selectedSession.status === 'active'
                  ? () => handleKill(selectedSession.id)
                  : undefined
              }
              onResume={
                selectedSession.resumable && selectedSession.status !== 'active'
                  ? () => handleResume(selectedSession.id)
                  : undefined
              }
              onDelete={
                selectedSession.status !== 'active'
                  ? () => handleDelete(selectedSession.id)
                  : undefined
              }
            />
            <div className="flex-1 overflow-hidden">
              <SessionContent session={selectedSession} />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-cream-200/50 text-sm font-body">
            Select a session to view output
          </div>
        )
      }
    />
  );
}

function SessionContent({ session }: { session: AgentSession }) {
  if (session.mode !== 'interactive') {
    return (
      <div className="flex items-center justify-center h-full text-cream-200/50 text-sm font-body">
        Token stream not yet available
      </div>
    );
  }

  if (session.status === 'active') {
    return <InteractiveTerminal sessionId={session.id} />;
  }

  // Ended interactive session — show read-only terminal with chunk replay
  return <InteractiveTerminal sessionId={session.id} readOnly />;
}

export function DashboardApp() {
  return (
    <Provider store={store}>
      <DashboardAppInner />
    </Provider>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '#app/hooks';
import {
  selectDaemonOnline,
  selectEvents,
  selectReconnectCount,
} from '#entities/connection/model/connection-slice';
import { selectInputHistory } from '#entities/input-history/model/input-history-slice';
import { resumeSession } from '#entities/session/api/session-api';
import {
  endedSessionsCleared,
  selectActiveSessions,
  selectEndedSessions,
  selectLoading,
  selectSession,
  selectSessionResumeCount,
  sessionRemoved,
} from '#entities/session/model/sessions-slice';
import { SessionCard } from '#entities/session/ui/SessionCard';
import { ClearEndedButton } from '#features/clear-ended-sessions/ui/ClearEndedButton';
import { InputHistoryPanel } from '#features/input-history/ui/InputHistoryPanel';
import { InteractiveTerminal } from '#features/interactive-terminal/ui/InteractiveTerminal';
import { KillAllButton } from '#features/kill-all-sessions/ui/KillAllButton';
import { useSessionStream } from '#features/session-stream/model/use-session-stream';
import { TokenStream } from '#features/session-stream/ui/TokenStream';
import { SpawnSessionDialog } from '#features/spawn-session/ui/SpawnSessionDialog';
import { cn } from '#shared/lib/cn';
import { RadarIcon } from '#shared/ui/RadarIcon';
import { SessionDetailHeader } from './SessionDetailHeader';

interface DaemonSessionsPanelProps {
  daemonId: string | null;
}

export function DaemonSessionsPanel({ daemonId }: DaemonSessionsPanelProps) {
  const dispatch = useAppDispatch();
  const activeSessions = useAppSelector(selectActiveSessions(daemonId));
  const endedSessions = useAppSelector(selectEndedSessions(daemonId));
  const loading = useAppSelector(selectLoading(daemonId));
  const daemonOnline = useAppSelector(selectDaemonOnline);
  const reconnectCount = useAppSelector(selectReconnectCount);
  const events = useAppSelector(selectEvents);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const [resumeFailedSessions, setResumeFailedSessions] = useState<Map<string, string>>(new Map());
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const sessions = [...activeSessions, ...endedSessions];

  const selectedSession = useAppSelector(selectSession(selectedSessionId));
  const sessionResumeCount = useAppSelector(selectSessionResumeCount(selectedSessionId));
  const inputHistory = useAppSelector(selectInputHistory(selectedSessionId ?? '__none__'));
  const { chunks, accumulatedText } = useSessionStream(events, selectedSessionId);

  // Auto-select first active session on initial load
  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (
      hasAutoSelected.current ||
      selectedSessionId ||
      pendingSessionId ||
      activeSessions.length === 0
    )
      return;
    hasAutoSelected.current = true;
    setSelectedSessionId(activeSessions[0].id);
  }, [selectedSessionId, pendingSessionId, activeSessions]);

  useEffect(() => {
    if (!pendingSessionId) return;
    const found = activeSessions.find((s) => s.id === pendingSessionId);
    if (found) {
      setSelectedSessionId(pendingSessionId);
      setPendingSessionId(null);
    }
  }, [activeSessions, pendingSessionId]);

  useEffect(() => {
    for (const event of events) {
      if (event.type === 'session:spawn-failed' && event.sessionId === pendingSessionId) {
        setSpawnError(event.error);
        setPendingSessionId(null);
        const timer = setTimeout(() => setSpawnError(null), 8000);
        return () => clearTimeout(timer);
      }
    }
  }, [events, pendingSessionId]);

  const handleResume = useCallback(async () => {
    if (!daemonId || !selectedSession) return;
    try {
      const result = await resumeSession(daemonId, selectedSession.id);
      setPendingSessionId(result.sessionId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume session';
      setSpawnError(message);
      setResumeFailedSessions((prev) => new Map(prev).set(selectedSession.id, message));
      setTimeout(() => setSpawnError(null), 8000);
    }
  }, [daemonId, selectedSession]);

  const handleSpawned = useCallback((sessionId: string) => {
    setPendingSessionId(sessionId);
    setShowSpawnForm(false);
  }, []);

  if (!daemonId) {
    return (
      <div className="flex-1 flex items-center justify-center text-cream-200 text-sm font-body">
        Select a daemon to view sessions
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-cream-200 text-sm font-body">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0 && !showSpawnForm && !pendingSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-cream-200 text-sm font-body">
        <div>No sessions yet</div>
        <button
          type="button"
          onClick={() => setShowSpawnForm(true)}
          className="bg-vigie-400 text-navy-900 text-xs font-mono px-4 py-2 rounded-md shadow-[0_1px_2px_rgba(0,0,0,0.15),0_4px_8px_rgba(38,192,154,0.15)] hover:bg-vigie-500 transition-all duration-150"
        >
          Start your first session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Disconnection overlay */}
      {daemonId && !daemonOnline && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy-900/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="relative flex items-center justify-center">
              <RadarIcon size={40} className="opacity-60" />
            </div>
            <span className="text-cream-50 text-sm font-mono">Device disconnected</span>
            <span className="text-cream-200 text-xs font-body">Attempting to reconnect...</span>
            <div className="flex gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-vigie-400/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-vigie-400/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-vigie-400/60 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}

      {/* Sidebar — full panel or icon rail */}
      {sidebarOpen ? (
        <div className="shrink-0 w-64 flex flex-col shadow-[1px_0_0_0_rgba(22,45,74,0.8)]">
          <div className="flex items-center justify-between px-3 py-2 shadow-[0_1px_0_0_rgba(22,45,74,0.6)]">
            <span className="font-mono text-[0.65rem] text-cream-200/60 uppercase tracking-[0.1em]">
              Sessions
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSpawnForm(!showSpawnForm)}
                className={cn(
                  'w-6 h-6 rounded-md flex items-center justify-center text-sm transition-all duration-150',
                  showSpawnForm
                    ? 'bg-navy-700 text-cream-50'
                    : 'text-cream-200 hover:text-cream-50 hover:bg-navy-700'
                )}
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="w-6 h-6 rounded-md flex items-center justify-center transition-all duration-150 text-cream-200/40 hover:text-cream-50 hover:bg-navy-700"
                title="Collapse sidebar"
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect
                    x="3"
                    y="3"
                    width="5"
                    height="14"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <rect
                    x="12"
                    y="3"
                    width="5"
                    height="14"
                    rx="1.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    opacity="0.4"
                  />
                </svg>
              </button>
            </div>
          </div>

          {showSpawnForm && (
            <SpawnSessionDialog
              daemonId={daemonId}
              onSpawned={handleSpawned}
              onClose={() => setShowSpawnForm(false)}
            />
          )}

          {spawnError && (
            <div className="mx-2 mt-2 p-2 rounded-md bg-red-500/10 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.2)] text-xs text-red-400 font-mono">
              {spawnError}
            </div>
          )}

          {pendingSessionId && (
            <div className="mx-2 mt-2 p-3 rounded-md shadow-[inset_0_0_0_1px_rgba(38,192,154,0.25)] bg-navy-800 animate-[pulse_2s_ease-in-out_infinite]">
              <div className="text-xs text-vigie-400 font-mono">Starting...</div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {activeSessions.length > 0 && (
              <>
                <div className="flex items-center justify-between px-1 pt-1">
                  <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                    Active
                  </span>
                  <KillAllButton daemonId={daemonId} activeCount={activeSessions.length} />
                </div>
                {activeSessions.map((session, i) => (
                  <div
                    key={session.id}
                    style={{ animationDelay: `${i * 50}ms` }}
                    className="animate-[fadeIn_0.2s_ease-out_both]"
                  >
                    <SessionCard
                      session={session}
                      selected={session.id === selectedSessionId}
                      onClick={() => setSelectedSessionId(session.id)}
                    />
                  </div>
                ))}
              </>
            )}
            {endedSessions.length > 0 && (
              <>
                <div className="flex items-center justify-between px-1 pt-2">
                  <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                    Ended
                  </span>
                  <ClearEndedButton
                    daemonId={daemonId}
                    endedCount={endedSessions.length}
                    onCleared={() => {
                      dispatch(endedSessionsCleared(daemonId));
                      if (selectedSession && selectedSession.status === 'ended') {
                        setSelectedSessionId(null);
                      }
                    }}
                  />
                </div>
                {endedSessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    selected={session.id === selectedSessionId}
                    onClick={() => setSelectedSessionId(session.id)}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="shrink-0 w-12 flex flex-col items-center gap-1 shadow-[1px_0_0_0_rgba(22,45,74,0.8)]">
          <div className="w-full flex items-center justify-center py-2 shadow-[0_1px_0_0_rgba(22,45,74,0.6)]">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-all duration-150 text-cream-200/40 hover:text-cream-50 hover:bg-navy-700"
              title="Expand sidebar"
            >
              <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect
                  x="3"
                  y="3"
                  width="5"
                  height="14"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <rect
                  x="12"
                  y="3"
                  width="5"
                  height="14"
                  rx="1.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  opacity="0.4"
                />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto w-full flex flex-col items-center gap-1 py-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => setSelectedSessionId(session.id)}
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-150 relative',
                  session.id === selectedSessionId
                    ? 'bg-vigie-400 text-navy-900'
                    : session.status === 'active'
                      ? 'bg-navy-700 text-cream-50 hover:bg-navy-600'
                      : 'bg-navy-800 text-cream-200/50 hover:bg-navy-700'
                )}
                title={`${session.id.slice(0, 8)} · ${session.status}`}
              >
                {session.agentType === 'claude'
                  ? 'C'
                  : session.agentType === 'opencode'
                    ? 'O'
                    : 'G'}
                {session.status === 'active' && session.id !== selectedSessionId && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success" />
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSidebarOpen(true);
                setShowSpawnForm(true);
              }}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg text-cream-200/30 hover:text-cream-50 hover:bg-navy-700 transition-all duration-150"
              title="New session"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedSession ? (
          <>
            <SessionDetailHeader
              session={selectedSession}
              connected={terminalConnected}
              historyOpen={historyOpen}
              onToggleHistory={() => setHistoryOpen(!historyOpen)}
              onResume={handleResume}
              onDelete={() => {
                dispatch(sessionRemoved(selectedSession.id));
                setSelectedSessionId(null);
              }}
              resumeError={resumeFailedSessions.get(selectedSession.id) ?? null}
            />
            <div className="flex-1 flex overflow-hidden">
              {selectedSession.mode === 'interactive' && selectedSession.status === 'active' ? (
                <InteractiveTerminal
                  key={`${selectedSession.id}-${reconnectCount}-${sessionResumeCount}`}
                  sessionId={selectedSession.id}
                  onConnectionChange={setTerminalConnected}
                />
              ) : selectedSession.mode === 'interactive' && selectedSession.status === 'ended' ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 text-cream-200/50 font-body">
                  <span className="text-sm">Session ended — terminal output not available</span>
                  {selectedSession.resumable && (
                    <span className="text-xs">Resume the session to reconnect</span>
                  )}
                </div>
              ) : (
                <TokenStream chunks={chunks} accumulatedText={accumulatedText} />
              )}
              {historyOpen &&
                selectedSession.mode === 'interactive' &&
                selectedSession.status === 'active' && <InputHistoryPanel history={inputHistory} />}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-cream-200/50 text-sm font-body">
            Select a session to view output
          </div>
        )}
      </div>
    </div>
  );
}

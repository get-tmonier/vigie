import { useCallback, useEffect, useState } from 'react';
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

  const selectedSession = useAppSelector(selectSession(selectedSessionId));
  const inputHistory = useAppSelector(selectInputHistory(selectedSessionId ?? '__none__'));
  const { chunks, accumulatedText } = useSessionStream(events, selectedSessionId);

  const sessions = [...activeSessions, ...endedSessions];

  // Auto-select spawned session when it appears
  useEffect(() => {
    if (!pendingSessionId) return;
    const found = activeSessions.find((s) => s.id === pendingSessionId);
    if (found) {
      setSelectedSessionId(pendingSessionId);
      setPendingSessionId(null);
    }
  }, [activeSessions, pendingSessionId]);

  // Handle spawn-failed events
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
      <div className="flex-1 flex items-center justify-center text-slate text-sm">
        Select a daemon to view sessions
      </div>
    );
  }

  if (loading && sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate text-sm">
        Loading sessions...
      </div>
    );
  }

  if (sessions.length === 0 && !showSpawnForm && !pendingSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate text-sm">
        <div>No sessions yet</div>
        <button
          type="button"
          onClick={() => setShowSpawnForm(true)}
          className="bg-gold text-navy-deep text-xs font-mono px-4 py-2 rounded hover:bg-gold/90 transition-colors"
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-navy-deep/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 text-center px-6">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-10 h-10 rounded-full border-2 border-gold/40 animate-ping" />
              <span className="w-10 h-10 rounded-full border-2 border-gold/60 flex items-center justify-center text-gold text-lg">
                !
              </span>
            </div>
            <span className="text-cream text-sm font-mono">Device disconnected</span>
            <span className="text-slate text-xs">Attempting to reconnect...</span>
            <div className="flex gap-1 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/60 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        </div>
      )}
      {/* Sidebar */}
      <div className="w-64 border-r border-navy-light overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-navy-light">
          <span className="text-xs text-slate uppercase tracking-wider">Sessions</span>
          <button
            type="button"
            onClick={() => setShowSpawnForm(!showSpawnForm)}
            className={cn(
              'w-6 h-6 rounded flex items-center justify-center text-sm transition-colors',
              showSpawnForm
                ? 'bg-navy-light text-cream'
                : 'text-slate hover:text-cream hover:bg-navy-light'
            )}
          >
            +
          </button>
        </div>

        {showSpawnForm && (
          <SpawnSessionDialog
            daemonId={daemonId}
            onSpawned={handleSpawned}
            onClose={() => setShowSpawnForm(false)}
          />
        )}

        {spawnError && (
          <div className="mx-2 mt-2 p-2 rounded bg-red-500/10 border border-red-500/30 text-xs text-red-400">
            {spawnError}
          </div>
        )}

        {pendingSessionId && (
          <div className="mx-2 mt-2 p-3 rounded border border-gold/30 bg-navy-mid animate-pulse">
            <div className="text-xs text-gold font-mono">Starting...</div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {activeSessions.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="text-xs text-slate uppercase tracking-wider">Active</span>
                <KillAllButton daemonId={daemonId} activeCount={activeSessions.length} />
              </div>
              {activeSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  selected={session.id === selectedSessionId}
                  onClick={() => setSelectedSessionId(session.id)}
                />
              ))}
            </>
          )}
          {endedSessions.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pt-2">
                <span className="text-xs text-slate uppercase tracking-wider">Ended</span>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col">
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
              {selectedSession.mode === 'interactive' ? (
                <InteractiveTerminal
                  key={`${selectedSession.id}-${reconnectCount}`}
                  sessionId={selectedSession.id}
                  onConnectionChange={setTerminalConnected}
                />
              ) : (
                <TokenStream chunks={chunks} accumulatedText={accumulatedText} />
              )}
              {historyOpen && selectedSession.mode === 'interactive' && (
                <InputHistoryPanel history={inputHistory} />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate text-sm">
            Select a session to view output
          </div>
        )}
      </div>
    </div>
  );
}

import type { SSEEvent } from '@tmonier/shared';
import { useCallback, useEffect, useState } from 'react';
import { useSessions } from '#entities/session/model/use-sessions';
import { SessionCard } from '#entities/session/ui/SessionCard';
import { useInputHistory } from '#features/input-history/model/use-input-history';
import { InputHistoryPanel } from '#features/input-history/ui/InputHistoryPanel';
import { InteractiveTerminal } from '#features/interactive-terminal/ui/InteractiveTerminal';
import { useSessionStream } from '#features/session-stream/model/use-session-stream';
import { TokenStream } from '#features/session-stream/ui/TokenStream';
import { SpawnSessionDialog } from '#features/spawn-session/ui/SpawnSessionDialog';
import { cn } from '#shared/lib/cn';
import { SessionDetailHeader } from './SessionDetailHeader';

interface DaemonSessionsPanelProps {
  daemonId: string | null;
  events: SSEEvent[];
}

export function DaemonSessionsPanel({ daemonId, events }: DaemonSessionsPanelProps) {
  const { sessions, loading } = useSessions(daemonId, events);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showSpawnForm, setShowSpawnForm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [spawnError, setSpawnError] = useState<string | null>(null);
  const { chunks, accumulatedText } = useSessionStream(events, selectedSessionId);
  const { history, trackInput } = useInputHistory();

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const endedSessions = sessions.filter((s) => s.status === 'ended');
  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? null;

  // Auto-select spawned session when it appears via SSE
  useEffect(() => {
    if (!pendingSessionId) return;
    const found = sessions.find((s) => s.id === pendingSessionId);
    if (found) {
      setSelectedSessionId(pendingSessionId);
      setPendingSessionId(null);
    }
  }, [sessions, pendingSessionId]);

  // Handle spawn-failed events
  useEffect(() => {
    for (const event of events) {
      if (event.type === 'session:spawn-failed' && event.sessionId === pendingSessionId) {
        setSpawnError(event.error);
        setPendingSessionId(null);
        const timer = setTimeout(() => setSpawnError(null), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [events, pendingSessionId]);

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
    <div className="flex flex-1 overflow-hidden">
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
              <div className="text-xs text-slate uppercase tracking-wider px-1 pt-1">Active</div>
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
              <div className="text-xs text-slate uppercase tracking-wider px-1 pt-2">Ended</div>
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
            />
            <div className="flex-1 flex overflow-hidden">
              {selectedSession.mode === 'interactive' ? (
                <InteractiveTerminal
                  sessionId={selectedSession.id}
                  onConnectionChange={setTerminalConnected}
                  onInput={trackInput}
                />
              ) : (
                <TokenStream chunks={chunks} accumulatedText={accumulatedText} />
              )}
              {historyOpen && selectedSession.mode === 'interactive' && (
                <InputHistoryPanel history={history} />
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

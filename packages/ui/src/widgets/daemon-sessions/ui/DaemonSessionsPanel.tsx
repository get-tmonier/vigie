import type { SSEEvent } from '@tmonier/shared';
import { useState } from 'react';
import { useSessions } from '#entities/session/model/use-sessions';
import { SessionCard } from '#entities/session/ui/SessionCard';
import { InteractiveTerminal } from '#features/interactive-terminal/ui/InteractiveTerminal';
import { useSessionStream } from '#features/session-stream/model/use-session-stream';
import { TokenStream } from '#features/session-stream/ui/TokenStream';

interface DaemonSessionsPanelProps {
  daemonId: string | null;
  events: SSEEvent[];
}

export function DaemonSessionsPanel({ daemonId, events }: DaemonSessionsPanelProps) {
  const { sessions, loading } = useSessions(daemonId, events);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const { chunks, accumulatedText } = useSessionStream(events, selectedSessionId);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const endedSessions = sessions.filter((s) => s.status === 'ended');

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

  if (sessions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate text-sm">
        No sessions. Run <code className="text-gold mx-1">tmonier claude -p &quot;...&quot;</code>{' '}
        to start one.
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="w-64 border-r border-navy-light overflow-y-auto p-2 space-y-2">
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

      <div className="flex-1 flex flex-col">
        {selectedSessionId ? (
          (() => {
            const selectedSession = sessions.find((s) => s.id === selectedSessionId);
            if (selectedSession?.mode === 'interactive') {
              return <InteractiveTerminal sessionId={selectedSessionId} />;
            }
            return <TokenStream chunks={chunks} accumulatedText={accumulatedText} />;
          })()
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate text-sm">
            Select a session to view output
          </div>
        )}
      </div>
    </div>
  );
}

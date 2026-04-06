import { Header } from '#shared/ui/Header.js';
import type { AgentSession } from '../../schemas.js';
import { ClearEndedForm } from './ui/ClearEndedForm.js';
import { KillAllForm } from './ui/KillAllForm.js';
import { SessionCard } from './ui/SessionCard.js';
import { SessionDetailHeader } from './ui/SessionDetailHeader.js';
import { SpawnSessionForm } from './ui/SpawnSessionForm.js';

type Props = {
  sessions: AgentSession[];
  selectedSessionId?: string;
};

export function DashboardPage({ sessions, selectedSessionId }: Props) {
  const activeSessions = sessions.filter((s) => s.status === 'active');
  const endedSessions = sessions.filter((s) => s.status !== 'active');
  const selectedSession =
    sessions.find((s) => s.id === selectedSessionId) ?? activeSessions[0] ?? sessions[0];

  return (
    <div className="flex h-screen bg-navy-900 text-cream-50 overflow-hidden font-body">
      {/* Sidebar */}
      <aside className="shrink-0 w-64 flex flex-col shadow-[1px_0_0_0_rgba(22,45,74,0.8)] bg-navy-900">
        <Header />

        <div className="flex items-center justify-between px-3 py-2 shadow-[0_1px_0_0_rgba(22,45,74,0.6)]">
          <span className="font-mono text-[0.65rem] text-cream-200/60 uppercase tracking-[0.1em]">
            Sessions
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {sessions.length === 0 && (
            <p className="text-cream-200/50 text-xs text-center mt-8 font-body">No sessions yet</p>
          )}

          {activeSessions.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pt-1">
                <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                  Active
                </span>
                <KillAllForm count={activeSessions.length} />
              </div>
              {activeSessions.map((session, i) => (
                <a
                  key={session.id}
                  href={`/?session=${session.id}`}
                  className="block animate-[fadeIn_0.2s_ease-out_both] no-underline"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <SessionCard session={session} selected={session.id === selectedSession?.id} />
                </a>
              ))}
            </>
          )}

          {endedSessions.length > 0 && (
            <>
              <div className="flex items-center justify-between px-1 pt-2">
                <span className="font-mono text-[0.6rem] text-cream-200/50 uppercase tracking-[0.12em]">
                  Ended
                </span>
                <ClearEndedForm count={endedSessions.length} />
              </div>
              {endedSessions.map((session) => (
                <a key={session.id} href={`/?session=${session.id}`} className="block no-underline">
                  <SessionCard session={session} selected={session.id === selectedSession?.id} />
                </a>
              ))}
            </>
          )}
        </div>

        <SpawnSessionForm />
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0">
        {selectedSession ? (
          <>
            <SessionDetailHeader session={selectedSession} />
            <div className="flex-1 overflow-hidden">
              {selectedSession.mode === 'interactive' && selectedSession.status === 'active' ? (
                <div
                  data-island="terminal"
                  data-session-id={selectedSession.id}
                  className="h-full"
                />
              ) : selectedSession.mode === 'interactive' && selectedSession.status === 'ended' ? (
                <div className="flex flex-col items-center justify-center h-full gap-2 text-cream-200/50 font-body">
                  <span className="text-sm">Session ended — terminal output not available</span>
                  {selectedSession.resumable && (
                    <span className="text-xs">Use the Resume button above to reconnect</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-cream-200/50 text-sm font-body">
                  Token stream not yet available
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-cream-200/50 text-sm font-body">
            Select a session to view output
          </div>
        )}
      </main>

      {/* EventsSocket island — mounts client-side, no visual output */}
      <div id="events-socket" aria-hidden="true" />
    </div>
  );
}

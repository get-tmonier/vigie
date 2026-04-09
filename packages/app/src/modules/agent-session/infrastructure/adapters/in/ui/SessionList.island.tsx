import { useStore } from '@nanostores/react';
import { cn } from '#shared/lib/cn';
import { SessionCard } from './SessionCard';
import { $selectedId, $sessions } from './store';

export function SessionList() {
  const sessions = useStore($sessions);
  const selectedId = useStore($selectedId);

  const activeSessions = sessions.filter((s) => s.status === 'active');
  const endedSessions = sessions.filter((s) => s.status !== 'active');
  const selectedSession =
    sessions.find((s) => s.id === selectedId) ?? activeSessions[0] ?? sessions[0];

  const selectSession = (id: string) => {
    $selectedId.set(id);
    history.pushState(null, '', `/?session=${id}`);
  };

  const handleKillAll = async () => {
    await fetch('/api/sessions/kill-all', { method: 'POST' }).catch(() => {});
  };

  const handleClearEnded = async () => {
    await fetch('/api/sessions/clear-ended', { method: 'POST' }).catch(() => {});
    const active = $sessions.get().filter((s) => s.status === 'active');
    const sel = $selectedId.get();
    $sessions.set(active);
    if (sel !== null && !active.some((s) => s.id === sel)) {
      $selectedId.set(active[0]?.id ?? null);
    }
  };

  return (
    <>
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
    </>
  );
}

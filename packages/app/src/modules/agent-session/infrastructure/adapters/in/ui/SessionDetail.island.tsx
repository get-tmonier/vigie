import { useStore } from '@nanostores/react';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { InteractiveTerminal } from './InteractiveTerminal.island';
import { SessionDetailHeader } from './SessionDetailHeader';
import { $selectedId, $sessions } from './store';

export function SessionDetail() {
  const sessions = useStore($sessions);
  const selectedId = useStore($selectedId);

  const selectedSession =
    sessions.find((s) => s.id === selectedId) ??
    sessions.find((s) => s.status === 'active') ??
    sessions[0];

  const handleKill = async () => {
    if (!selectedSession) return;
    await fetch(`/api/sessions/${selectedSession.id}/kill`, { method: 'POST' }).catch(() => {});
  };

  const handleResume = async () => {
    if (!selectedSession) return;
    const res = await fetch(`/api/sessions/${selectedSession.id}/resume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cols: window.innerWidth > 0 ? 220 : 120, rows: 50 }),
    }).catch(() => null);
    if (res?.ok) {
      const data = (await res.json()) as { sessionId: string };
      $selectedId.set(data.sessionId);
      history.pushState(null, '', `/?session=${data.sessionId}`);
    }
  };

  const handleDelete = async () => {
    if (!selectedSession) return;
    await fetch(`/api/sessions/${selectedSession.id}`, { method: 'DELETE' }).catch(() => {});
  };

  if (!selectedSession) {
    return (
      <div className="flex items-center justify-center flex-1 text-cream-200/50 text-sm font-body">
        Select a session to view output
      </div>
    );
  }

  return (
    <>
      <SessionDetailHeader
        session={selectedSession}
        onKill={selectedSession.status === 'active' ? handleKill : undefined}
        onResume={
          selectedSession.resumable && selectedSession.status !== 'active'
            ? handleResume
            : undefined
        }
        onDelete={selectedSession.status !== 'active' ? handleDelete : undefined}
      />
      <div className="flex-1 overflow-hidden">
        <SessionContent session={selectedSession} />
      </div>
    </>
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
  return <InteractiveTerminal sessionId={session.id} readOnly={session.status !== 'active'} />;
}

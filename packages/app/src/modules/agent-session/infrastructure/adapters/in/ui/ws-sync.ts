import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { SessionEvent } from '#shared/kernel/session/events';
import { $homedir, $selectedId, $sessions } from './store';

type WsMessage = { type: 'snapshot'; sessions: AgentSession[] } | SessionEvent;

function pickId(sessions: AgentSession[], currentId: string | null): string | null {
  if (currentId !== null && sessions.some((s) => s.id === currentId)) return currentId;
  return sessions.find((s) => s.status === 'active')?.id ?? sessions[0]?.id ?? null;
}

export function applyWsMessage(raw: string): void {
  let msg: WsMessage;
  try {
    msg = JSON.parse(raw) as WsMessage;
  } catch {
    return;
  }

  if (msg.type === 'snapshot') {
    const incoming = (msg as Extract<WsMessage, { type: 'snapshot' }>).sessions;
    $sessions.set(incoming);
    $selectedId.set(pickId(incoming, $selectedId.get()));
  } else if (msg.type === 'session:started') {
    fetch('/api/sessions')
      .then((r) => r.json() as Promise<{ sessions: AgentSession[] }>)
      .then(({ sessions }) => {
        $sessions.set(sessions);
        $selectedId.set(pickId(sessions, $selectedId.get()));
      })
      .catch(() => {});
  } else if (msg.type === 'session:ended') {
    const e = msg as Extract<SessionEvent, { type: 'session:ended' }>;
    $sessions.set(
      $sessions.get().map((s) =>
        s.id === e.sessionId
          ? {
              ...s,
              status: 'ended' as const,
              resumable: e.resumable,
              ...(e.exitCode !== undefined ? { exitCode: e.exitCode } : {}),
            }
          : s
      )
    );
  } else if (msg.type === 'session:deleted') {
    const e = msg as Extract<SessionEvent, { type: 'session:deleted' }>;
    const remaining = $sessions.get().filter((s) => s.id !== e.sessionId);
    $sessions.set(remaining);
    if ($selectedId.get() === e.sessionId) {
      $selectedId.set(pickId(remaining, null));
    }
  } else if (msg.type === 'sessions:cleared') {
    const all = $sessions.get();
    const active = all.filter((s) => s.status === 'active');
    const removedIds = new Set(all.filter((s) => s.status !== 'active').map((s) => s.id));
    $sessions.set(active);
    const sel = $selectedId.get();
    if (sel !== null && removedIds.has(sel)) {
      $selectedId.set(active[0]?.id ?? null);
    }
  } else if (msg.type === 'session:resumable-changed') {
    const e = msg as Extract<SessionEvent, { type: 'session:resumable-changed' }>;
    $sessions.set(
      $sessions.get().map((s) => (s.id === e.sessionId ? { ...s, resumable: e.resumable } : s))
    );
  }
}

function connect(): void {
  const wsUrl = `${location.origin.replace(/^http/, 'ws')}/ws/events`;
  const ws = new WebSocket(wsUrl);
  ws.addEventListener('message', (e) => {
    if (typeof e.data === 'string') applyWsMessage(e.data);
  });
  ws.addEventListener('close', () => {
    setTimeout(connect, 2000);
  });
}

export function init(): void {
  const el = document.getElementById('vigie-initial-data');
  let sessions: AgentSession[] = [];
  let homedir = '/';
  try {
    sessions = JSON.parse(el?.dataset.sessions ?? '[]') as AgentSession[];
  } catch {}
  if (el?.dataset.homedir) homedir = el.dataset.homedir;

  $sessions.set(sessions);
  $homedir.set(homedir);
  $selectedId.set(new URL(location.href).searchParams.get('session') ?? pickId(sessions, null));

  connect();
}

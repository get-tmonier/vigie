import * as v from 'valibot';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import {
  type SessionEvent,
  SessionEventSchema,
  type StructuredEvent,
} from '#shared/kernel/session/events';
import { $homedir, $selectedId, $sessions, addEventToFeed } from './store';

function pickId(sessions: AgentSession[], currentId: string | null): string | null {
  if (currentId !== null && sessions.some((s) => s.id === currentId)) return currentId;
  return sessions.find((s) => s.status === 'active')?.id ?? sessions[0]?.id ?? null;
}

export function applyWsMessage(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }

  // Handle snapshot (not a SessionEvent)
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    (parsed as { type: string }).type === 'snapshot'
  ) {
    const incoming = (parsed as { sessions: AgentSession[] }).sessions;
    $sessions.set(incoming);
    $selectedId.set(pickId(incoming, $selectedId.get()));
    return;
  }

  // Inject timestamp default for schema validation (browser events may omit it)
  const withTimestamp =
    typeof parsed === 'object' && parsed !== null && !('timestamp' in parsed)
      ? { ...(parsed as Record<string, unknown>), timestamp: 0 }
      : parsed;

  // Validate against SessionEvent schema
  const result = v.safeParse(SessionEventSchema, withTimestamp);
  if (!result.success) return;

  const event = result.output;
  applyLifecycleEvent(event);
  applyStructuredEvent(event);
}

function applyLifecycleEvent(event: SessionEvent): void {
  switch (event.type) {
    case 'session:started':
      fetch('/api/sessions')
        .then((r) => r.json() as Promise<{ sessions: AgentSession[] }>)
        .then(({ sessions }) => {
          $sessions.set(sessions);
          $selectedId.set(pickId(sessions, $selectedId.get()));
        })
        .catch(() => {});
      break;

    case 'session:ended':
      $sessions.set(
        $sessions.get().map((s) =>
          s.id === event.sessionId
            ? {
                ...s,
                status: 'ended' as const,
                resumable: event.resumable,
                exitCode: event.exitCode,
              }
            : s
        )
      );
      break;

    case 'session:deleted': {
      const remaining = $sessions.get().filter((s) => s.id !== event.sessionId);
      $sessions.set(remaining);
      if ($selectedId.get() === event.sessionId) $selectedId.set(pickId(remaining, null));
      break;
    }

    case 'sessions:cleared': {
      const all = $sessions.get();
      const active = all.filter((s) => s.status === 'active');
      const removedIds = new Set(all.filter((s) => s.status !== 'active').map((s) => s.id));
      $sessions.set(active);
      const sel = $selectedId.get();
      if (sel !== null && removedIds.has(sel)) {
        $selectedId.set(active[0]?.id ?? null);
      }
      break;
    }

    case 'session:resumable-changed':
      $sessions.set(
        $sessions
          .get()
          .map((s) => (s.id === event.sessionId ? { ...s, resumable: event.resumable } : s))
      );
      break;
  }
}

function applyStructuredEvent(event: SessionEvent): void {
  if (
    event.type === 'agent:text-delta' ||
    event.type === 'agent:tool-call' ||
    event.type === 'agent:cost-update' ||
    event.type === 'agent:subagent-spawn' ||
    event.type === 'agent:turn-started' ||
    event.type === 'agent:turn-completed'
  ) {
    addEventToFeed(event.sessionId, event as StructuredEvent);

    // Update session cost in local state
    if (event.type === 'agent:cost-update') {
      $sessions.set(
        $sessions
          .get()
          .map((s) =>
            s.id === event.sessionId
              ? { ...s, totalCostUsd: (s.totalCostUsd ?? 0) + event.totalCostUsd }
              : s
          )
      );
    }
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

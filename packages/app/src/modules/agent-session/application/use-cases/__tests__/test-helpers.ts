import { Effect } from 'effect';
import type { DomainEventBusShape } from '#modules/agent-session/application/ports/out/domain-event-bus.port';
import type {
  ResumableSessionInfo,
  SessionRepositoryShape,
} from '#modules/agent-session/application/ports/out/session-repository.port';
import type { Session } from '#modules/agent-session/domain/session';
import type { SessionEvent } from '#shared/kernel/agent-session/events';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

export function makeSessionRepo(
  sessions: Session[] = [],
  opts?: {
    activeWithAgentId?: ResumableSessionInfo[];
    recentlyEnded?: ResumableSessionInfo[];
  }
): SessionRepositoryShape & {
  store: Map<SessionId, Session>;
  activeWithAgentId: ResumableSessionInfo[];
  recentlyEnded: ResumableSessionInfo[];
} {
  const store = new Map<SessionId, Session>();
  for (const s of sessions) store.set(s.id, s);

  const activeWithAgentId: ResumableSessionInfo[] = opts?.activeWithAgentId ?? [];
  const recentlyEnded: ResumableSessionInfo[] = opts?.recentlyEnded ?? [];

  return {
    store,
    activeWithAgentId,
    recentlyEnded,
    findById: (id) => store.get(id) ?? null,
    findAll: () => Array.from(store.values()),
    findActive: () => Array.from(store.values()).filter((s) => s.isActive),
    findActiveWithAgentId: () => activeWithAgentId,
    findRecentlyEnded: (_withinMs: number) => recentlyEnded,
    save: (session) => {
      store.set(session.id, session);
    },
    delete: (id) => {
      store.delete(id);
    },
    deleteAllEnded: () => {
      for (const [k, v] of store) {
        if (v.status === 'ended') store.delete(k);
      }
    },
    markOrphanedEnded: () => {},
    pruneOld: () => {},
  };
}

export function makeDomainEventBus(): DomainEventBusShape & { published: SessionEvent[] } {
  const published: SessionEvent[] = [];
  return {
    published,
    publish: (event) => {
      published.push(event);
      return Effect.void;
    },
    subscribe: (_listener) => () => {},
  };
}

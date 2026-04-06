import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { IpcServerShape } from '#modules/daemon/application/ports/out/ipc-server.port';
import type { AgentRegistryShape } from '#modules/session/application/ports/out/agent-adapter.port';
import type { ResumabilityCheckerShape } from '#modules/session/application/ports/out/resumability-checker.port';
import type {
  ClaudeSessionInfo,
  SessionRepositoryShape,
} from '#modules/session/application/ports/out/session-repository.port';
import { createSessionService } from '#modules/session/application/session.service';
import type { Session } from '#modules/session/domain/session';
import { SessionId } from '#modules/session/domain/session-id';
import type {
  DomainEvent,
  EventPublisherShape,
} from '#modules/terminal/application/ports/out/event-publisher.port';
import type { PtySpawnerShape } from '#modules/terminal/application/ports/out/pty-spawner.port';
import type { TerminalRepositoryShape } from '#modules/terminal/application/ports/out/terminal-repository.port';
import type { TerminalSubscribersShape } from '#modules/terminal/application/terminal-subscribers';

function makeRepo(): SessionRepositoryShape {
  const store = new Map<string, Session>();
  return {
    findById: (id) => store.get(id) ?? null,
    save: (s) => {
      store.set(s.id, s);
    },
    findAll: () => [...store.values()],
    findActive: () => [...store.values()].filter((s) => s.status === 'active'),
    findActiveClaudeWithId: (): ClaudeSessionInfo[] =>
      [...store.values()]
        .filter(
          (s) => s.status === 'active' && s.agentType === 'claude' && s.claudeSessionId != null
        )
        .map((s) => ({
          id: s.id,
          claudeSessionId: s.claudeSessionId!,
          cwd: s.cwd,
          resumable: s.resumable,
        })),
    findRecentlyEndedClaude: (): ClaudeSessionInfo[] => [],
    delete: (id) => {
      store.delete(id);
    },
    deleteAllEnded: () => {
      for (const [k, v] of store) if (v.status !== 'active') store.delete(k);
    },
    markOrphanedEnded: () => {},
    pruneOld: () => {},
  };
}

function makePublisher() {
  const events: DomainEvent[] = [];
  const publisher: EventPublisherShape & {
    getEventsOfType<T extends DomainEvent['type']>(type: T): Extract<DomainEvent, { type: T }>[];
    clear(): void;
  } = {
    publish: (e) => {
      events.push(e);
    },
    subscribe: () => () => {},
    getEventsOfType: <T extends DomainEvent['type']>(type: T) =>
      events.filter((e) => e.type === type) as Extract<DomainEvent, { type: T }>[],
    clear: () => {
      events.length = 0;
    },
  };
  return publisher;
}

function makeResumabilityChecker(
  returns = false
): ResumabilityCheckerShape & { setReturn(v: boolean): void } {
  let v = returns;
  return {
    isResumable: () => v,
    setReturn: (x) => {
      v = x;
    },
  };
}

const noopTerminalRepo: TerminalRepositoryShape = {
  appendChunk: () => {},
  getChunks: () => [],
  getAllChunks: () => [],
  appendInput: () => {},
  getInputHistory: () => [],
};

const noopPtySpawner: PtySpawnerShape = {
  spawn: () => Effect.die(new Error('unexpected spawn call')),
};

const noopAgentRegistry: AgentRegistryShape = {
  resolve: (agentType) => ({
    agentType,
    canResume: agentType === 'claude',
    detectSessionId: agentType === 'claude',
    buildSpawnArgs: () => ({ command: agentType, args: [agentType] }),
  }),
};

const noopIpcServer: IpcServerShape = {
  start: () => Effect.void,
  sendTo: () => Effect.void,
  shutdown: () => Effect.void,
};

const noopTerminalSubs: TerminalSubscribersShape = {
  subscribe: () => () => {},
  publish: () => {},
  hasSubscribers: () => false,
};

function makeService() {
  const sessionRepo = makeRepo();
  const eventPublisher = makePublisher();
  const resumabilityChecker = makeResumabilityChecker(false);
  const service = createSessionService({
    sessionRepo,
    terminalRepo: noopTerminalRepo,
    ptySpawner: noopPtySpawner,
    eventPublisher,
    resumabilityChecker,
    agentRegistry: noopAgentRegistry,
    ipcServer: noopIpcServer,
    terminalSubs: noopTerminalSubs,
  });
  return { service, sessionRepo, eventPublisher, resumabilityChecker };
}

describe('SessionService', () => {
  describe('register', () => {
    it('saves session and publishes session:started', () => {
      const { service, sessionRepo, eventPublisher } = makeService();
      service.register({
        sessionId: 'sess-1',
        agentType: 'claude',
        cwd: '/tmp',
        connId: 'conn-1',
      });
      expect(sessionRepo.findById(SessionId('sess-1'))).not.toBeNull();
      const events = eventPublisher.getEventsOfType('session:started');
      expect(events).toHaveLength(1);
      expect(events[0].sessionId).toBe(SessionId('sess-1'));
    });

    it('tracks connection mappings', () => {
      const { service } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      expect(service.sessionConnections.get('sess-1')).toBe('conn-1');
      expect(service.connSessions.get('conn-1')).toBe('sess-1');
    });
  });

  describe('markEnded', () => {
    it('marks session ended, checks resumability via port, publishes session:ended', () => {
      const { service, sessionRepo, eventPublisher, resumabilityChecker } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      eventPublisher.clear();

      // Seed a claudeSessionId so resumability check runs
      const session = sessionRepo.findById(SessionId('sess-1'))!;
      session.setClaudeSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();

      resumabilityChecker.setReturn(true);
      service.markEnded(SessionId('sess-1'), 0);

      const saved = sessionRepo.findById(SessionId('sess-1'))!;
      expect(saved.status).toBe('ended');
      expect(saved.resumable).toBe(true);

      const events = eventPublisher.getEventsOfType('session:ended');
      expect(events).toHaveLength(1);
    });

    it('is a no-op for non-existent session', () => {
      const { service } = makeService();
      expect(() => service.markEnded(SessionId('no-such'), 0)).not.toThrow();
    });
  });

  describe('markError', () => {
    it('marks session in error state and publishes session:error', () => {
      const { service, sessionRepo, eventPublisher } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      eventPublisher.clear();
      service.markError(SessionId('sess-1'), 'something broke');
      const saved = sessionRepo.findById(SessionId('sess-1'))!;
      expect(saved.status).toBe('error');
      const events = eventPublisher.getEventsOfType('session:error');
      expect(events).toHaveLength(1);
      if (events[0].type === 'session:error') {
        expect(events[0].error).toBe('something broke');
      }
    });
  });

  describe('delete', () => {
    it('removes ended session from repo and publishes session:deleted', () => {
      const { service, sessionRepo, eventPublisher } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.markEnded(SessionId('sess-1'), 0);
      eventPublisher.clear();

      service.delete(SessionId('sess-1'));
      expect(sessionRepo.findById(SessionId('sess-1'))).toBeNull();
      const events = eventPublisher.getEventsOfType('session:deleted');
      expect(events).toHaveLength(1);
    });

    it('is a no-op for non-existent session', () => {
      const { service } = makeService();
      expect(() => service.delete(SessionId('no-such'))).not.toThrow();
    });
  });

  describe('deleteAllEnded', () => {
    it('delegates to repo and publishes sessions:cleared', () => {
      const { service, sessionRepo, eventPublisher } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.markEnded(SessionId('sess-1'), 0);
      eventPublisher.clear();

      service.deleteAllEnded();
      expect(sessionRepo.findAll()).toHaveLength(0);
      const events = eventPublisher.getEventsOfType('sessions:cleared');
      expect(events).toHaveLength(1);
    });
  });

  describe('setClaudeSessionId', () => {
    it('sets id on session, saves, and publishes session:claude-id-detected', () => {
      const { service, sessionRepo, eventPublisher } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      eventPublisher.clear();

      service.setClaudeSessionId(SessionId('sess-1'), 'cid-123');
      const saved = sessionRepo.findById(SessionId('sess-1'))!;
      expect(saved.claudeSessionId).toBe('cid-123');
      const events = eventPublisher.getEventsOfType('session:claude-id-detected');
      expect(events).toHaveLength(1);
    });
  });

  describe('deregister', () => {
    it('marks session ended and cleans up connection mappings', () => {
      const { service, sessionRepo } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.deregister(SessionId('sess-1'));
      const saved = sessionRepo.findById(SessionId('sess-1'))!;
      expect(saved.status).toBe('ended');
      expect(service.sessionConnections.has('sess-1')).toBe(false);
      expect(service.connSessions.has('conn-1')).toBe(false);
    });
  });

  describe('listAll', () => {
    it('returns all sessions from repo', () => {
      const { service } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      service.register({ sessionId: 'sess-2', agentType: 'aider', cwd: '/tmp', connId: 'c2' });
      expect(service.listAll()).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('returns session from repo', () => {
      const { service } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      expect(service.findById(SessionId('sess-1'))).not.toBeNull();
    });

    it('returns null for unknown session', () => {
      const { service } = makeService();
      expect(service.findById(SessionId('unknown'))).toBeNull();
    });
  });

  describe('checkResumableForActive', () => {
    it('updates session and publishes session:resumable-changed when value changes', () => {
      const { service, sessionRepo, eventPublisher, resumabilityChecker } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      const session = sessionRepo.findById(SessionId('sess-1'))!;
      session.setClaudeSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();
      eventPublisher.clear();

      resumabilityChecker.setReturn(true);
      service.checkResumableForActive();

      const saved = sessionRepo.findById(SessionId('sess-1'))!;
      expect(saved.resumable).toBe(true);
      const events = eventPublisher.getEventsOfType('session:resumable-changed');
      expect(events).toHaveLength(1);
    });

    it('does not emit event when resumable value is unchanged', () => {
      const { service, sessionRepo, eventPublisher, resumabilityChecker } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      const session = sessionRepo.findById(SessionId('sess-1'))!;
      session.setClaudeSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();
      eventPublisher.clear();

      // resumabilityChecker returns false (default), session.resumable is already false
      service.checkResumableForActive();
      const events = eventPublisher.getEventsOfType('session:resumable-changed');
      expect(events).toHaveLength(0);
    });
  });
});

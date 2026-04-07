import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import type { AgentRegistryShape } from '#modules/session/application/ports/out/agent-adapter.port';
import type { ResumabilityCheckerShape } from '#modules/session/application/ports/out/resumability-checker.port';
import type {
  ResumableSessionInfo,
  SessionRepositoryShape,
} from '#modules/session/application/ports/out/session-repository.port';
import type { TerminalGatewayShape } from '#modules/session/application/ports/out/terminal-gateway.port';
import { createSessionService } from '#modules/session/application/session.service';
import type { Session } from '#modules/session/domain/session';
import type { DomainEvent } from '#shared/kernel/domain-events';
import { SessionId } from '#shared/kernel/session-id';

function makeRepo(): SessionRepositoryShape {
  const store = new Map<string, Session>();
  return {
    findById: (id) => store.get(id) ?? null,
    save: (s) => {
      store.set(s.id, s);
    },
    findAll: () => [...store.values()],
    findActive: () => [...store.values()].filter((s) => s.status === 'active'),
    findActiveWithAgentId: (): ResumableSessionInfo[] =>
      [...store.values()]
        .filter(
          (s) => s.status === 'active' && s.agentType === 'claude' && s.agentSessionId != null
        )
        .map((s) => ({
          id: s.id,
          agentSessionId: s.agentSessionId as string,
          cwd: s.cwd,
          resumable: s.resumable,
        })),
    findRecentlyEnded: (): ResumableSessionInfo[] => [],
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

function makeGateway() {
  const events: DomainEvent[] = [];
  const chunks = new Map<string, Array<{ data: string }>>();

  const gateway: TerminalGatewayShape & {
    getEventsOfType<T extends DomainEvent['type']>(type: T): Extract<DomainEvent, { type: T }>[];
    clearEvents(): void;
  } = {
    spawnPty: () => Effect.die(new Error('unexpected spawnPty call')),
    appendChunk: (sessionId, base64) => {
      if (!chunks.has(sessionId)) chunks.set(sessionId, []);
      chunks.get(sessionId)!.push({ data: base64 });
    },
    getAllChunks: (sessionId) => chunks.get(sessionId) ?? [],
    appendInput: () => {},
    getInputHistory: () => [],
    broadcastOutput: () => {},
    sendToCliClient: () => {},
    bufferInput: () => {},
    publishEvent: (e) => {
      events.push(e);
      return Effect.void;
    },
    getEventsOfType: <T extends DomainEvent['type']>(type: T) =>
      events.filter((e) => e.type === type) as Extract<DomainEvent, { type: T }>[],
    clearEvents: () => {
      events.length = 0;
    },
  };
  return gateway;
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

const noopAgentRegistry: AgentRegistryShape = {
  resolve: (agentType) => ({
    agentType,
    canResume: agentType === 'claude',
    detectSessionId: agentType === 'claude',
    buildSpawnArgs: () => ({ command: agentType, args: [agentType] }),
  }),
};

function makeService() {
  const sessionRepo = makeRepo();
  const gateway = makeGateway();
  const resumabilityChecker = makeResumabilityChecker(false);
  const service = createSessionService({
    sessionRepo,
    gateway,
    resumabilityChecker,
    agentRegistry: noopAgentRegistry,
  });
  return { service, sessionRepo, gateway, resumabilityChecker };
}

describe('SessionService', () => {
  describe('register', () => {
    it('saves session and publishes session:started', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({
        sessionId: 'sess-1',
        agentType: 'claude',
        cwd: '/tmp',
        connId: 'conn-1',
      });
      expect(sessionRepo.findById(SessionId('sess-1'))).not.toBeNull();
      const events = gateway.getEventsOfType('session:started');
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
      const { service, sessionRepo, gateway, resumabilityChecker } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      gateway.clearEvents();

      // Seed a agentSessionId so resumability check runs
      const session = sessionRepo.findById(SessionId('sess-1'));
      if (!session) throw new Error('session not found');
      session.setAgentSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();

      resumabilityChecker.setReturn(true);
      service.markEnded(SessionId('sess-1'), 0);

      const saved = sessionRepo.findById(SessionId('sess-1'));
      if (!saved) throw new Error('session not found');
      expect(saved.status).toBe('ended');
      expect(saved.resumable).toBe(true);

      const events = gateway.getEventsOfType('session:ended');
      expect(events).toHaveLength(1);
    });

    it('is a no-op for non-existent session', () => {
      const { service } = makeService();
      expect(() => service.markEnded(SessionId('no-such'), 0)).not.toThrow();
    });
  });

  describe('markError', () => {
    it('marks session in error state and publishes session:error', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      gateway.clearEvents();
      service.markError(SessionId('sess-1'), 'something broke');
      const saved = sessionRepo.findById(SessionId('sess-1'));
      if (!saved) throw new Error('session not found');
      expect(saved.status).toBe('error');
      const events = gateway.getEventsOfType('session:error');
      expect(events).toHaveLength(1);
      if (events[0].type === 'session:error') {
        expect(events[0].error).toBe('something broke');
      }
    });
  });

  describe('delete', () => {
    it('removes ended session from repo and publishes session:deleted', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.markEnded(SessionId('sess-1'), 0);
      gateway.clearEvents();

      service.delete(SessionId('sess-1'));
      expect(sessionRepo.findById(SessionId('sess-1'))).toBeNull();
      const events = gateway.getEventsOfType('session:deleted');
      expect(events).toHaveLength(1);
    });

    it('is a no-op for non-existent session', () => {
      const { service } = makeService();
      expect(() => service.delete(SessionId('no-such'))).not.toThrow();
    });
  });

  describe('deleteAllEnded', () => {
    it('delegates to repo and publishes sessions:cleared', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.markEnded(SessionId('sess-1'), 0);
      gateway.clearEvents();

      service.deleteAllEnded();
      expect(sessionRepo.findAll()).toHaveLength(0);
      const events = gateway.getEventsOfType('sessions:cleared');
      expect(events).toHaveLength(1);
    });
  });

  describe('setAgentSessionId', () => {
    it('sets id on session, saves, and publishes session:agent-id-detected', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      gateway.clearEvents();

      service.setAgentSessionId(SessionId('sess-1'), 'cid-123');
      const saved = sessionRepo.findById(SessionId('sess-1'));
      if (!saved) throw new Error('session not found');
      expect(saved.agentSessionId).toBe('cid-123');
      const events = gateway.getEventsOfType('session:agent-id-detected');
      expect(events).toHaveLength(1);
    });
  });

  describe('deregister', () => {
    it('marks session ended and cleans up connection mappings', () => {
      const { service, sessionRepo } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'conn-1' });
      service.deregister(SessionId('sess-1'));
      const saved = sessionRepo.findById(SessionId('sess-1'));
      if (!saved) throw new Error('session not found');
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
      const { service, sessionRepo, gateway, resumabilityChecker } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      const session = sessionRepo.findById(SessionId('sess-1'));
      if (!session) throw new Error('session not found');
      session.setAgentSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();
      gateway.clearEvents();

      resumabilityChecker.setReturn(true);
      service.checkResumableForActive();

      const saved = sessionRepo.findById(SessionId('sess-1'));
      if (!saved) throw new Error('session not found');
      expect(saved.resumable).toBe(true);
      const events = gateway.getEventsOfType('session:resumable-changed');
      expect(events).toHaveLength(1);
    });

    it('does not emit event when resumable value is unchanged', () => {
      const { service, sessionRepo, gateway } = makeService();
      service.register({ sessionId: 'sess-1', agentType: 'claude', cwd: '/tmp', connId: 'c1' });
      const session = sessionRepo.findById(SessionId('sess-1'));
      if (!session) throw new Error('session not found');
      session.setAgentSessionId('cid');
      sessionRepo.save(session);
      session.pullEvents();
      gateway.clearEvents();

      // resumabilityChecker returns false (default), session.resumable is already false
      service.checkResumableForActive();
      const events = gateway.getEventsOfType('session:resumable-changed');
      expect(events).toHaveLength(0);
    });
  });
});

import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@tmonier/shared';
import type { AgentSession } from '#entities/session/api/session-api';

/**
 * Pure-function extraction of the useSessions event processing logic
 * so we can unit-test the state transitions without React hooks.
 */
function processEvents(initialSessions: AgentSession[], events: SSEEvent[]): AgentSession[] {
  let sessions = [...initialSessions];

  for (const event of events) {
    if (event.type === 'session:started') {
      const resumable =
        'resumable' in event && typeof event.resumable === 'boolean' ? event.resumable : undefined;
      const claudeSessionId =
        'claudeSessionId' in event && typeof event.claudeSessionId === 'string'
          ? event.claudeSessionId
          : undefined;

      const newSession: AgentSession = {
        id: event.sessionId,
        daemonId: event.daemonId,
        agentType: event.agentType,
        mode: event.mode ?? 'prompt',
        cwd: event.cwd,
        gitBranch: event.gitBranch,
        repoName: event.repoName,
        startedAt: event.timestamp,
        status: 'active',
        ...(resumable !== undefined && { resumable }),
        ...(claudeSessionId !== undefined && { claudeSessionId }),
      };

      const existing = sessions.find((s) => s.id === event.sessionId);
      if (existing) {
        sessions = sessions.map((s) =>
          s.id === event.sessionId
            ? {
                ...s,
                ...newSession,
                resumable: resumable ?? s.resumable,
                status: 'active' as const,
              }
            : s
        );
      } else {
        sessions = [...sessions, newSession];
      }
    } else if (event.type === 'session:ended') {
      const resumable = 'resumable' in event ? (event.resumable as boolean) : false;
      sessions = sessions.map((s) =>
        s.id === event.sessionId
          ? { ...s, status: 'ended' as const, exitCode: event.exitCode, resumable }
          : s
      );
    } else if (event.type === 'session:error' || event.type === 'session:spawn-failed') {
      sessions = sessions.map((s) =>
        s.id === event.sessionId ? { ...s, status: 'ended' as const, exitCode: -1 } : s
      );
    } else if (event.type === 'session:claude-id-detected') {
      if ('sessionId' in event && 'claudeSessionId' in event) {
        sessions = sessions.map((s) =>
          s.id === event.sessionId ? { ...s, claudeSessionId: event.claudeSessionId as string } : s
        );
      }
    } else if (event.type === 'session:resumable-changed') {
      if ('sessionId' in event && 'resumable' in event) {
        sessions = sessions.map((s) =>
          s.id === event.sessionId ? { ...s, resumable: event.resumable as boolean } : s
        );
      }
    }
  }

  return sessions;
}

// Helper to create typed SSE events (runtime objects, no Valibot parsing)
function sseStarted(
  overrides: Partial<{
    daemonId: string;
    sessionId: string;
    agentType: 'claude' | 'opencode' | 'generic';
    mode: 'prompt' | 'interactive';
    cwd: string;
    gitBranch: string;
    repoName: string;
    resumable: boolean;
    claudeSessionId: string;
    timestamp: number;
  }> = {}
): SSEEvent {
  return {
    type: 'session:started',
    daemonId: 'd-1',
    sessionId: 's-1',
    agentType: 'claude',
    mode: 'interactive',
    cwd: '/home/user',
    timestamp: 1000,
    ...overrides,
  } as SSEEvent;
}

function sseEnded(
  overrides: Partial<{
    daemonId: string;
    sessionId: string;
    exitCode: number;
    resumable: boolean;
    timestamp: number;
  }> = {}
): SSEEvent {
  return {
    type: 'session:ended',
    daemonId: 'd-1',
    sessionId: 's-1',
    exitCode: 0,
    resumable: false,
    timestamp: 2000,
    ...overrides,
  } as SSEEvent;
}

function sseResumableChanged(sessionId: string, resumable: boolean): SSEEvent {
  return {
    type: 'session:resumable-changed',
    daemonId: 'd-1',
    sessionId,
    resumable,
    timestamp: Date.now(),
  } as SSEEvent;
}

describe('useSessions event processing', () => {
  describe('basic lifecycle', () => {
    it('session:started creates a new session', () => {
      const result = processEvents([], [sseStarted()]);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s-1');
      expect(result[0].status).toBe('active');
    });

    it('session:ended marks session as ended', () => {
      const initial: AgentSession[] = [
        {
          id: 's-1',
          daemonId: 'd-1',
          agentType: 'claude',
          mode: 'interactive',
          cwd: '/home/user',
          startedAt: 1000,
          status: 'active',
        },
      ];
      const result = processEvents(initial, [sseEnded({ resumable: true })]);
      expect(result[0].status).toBe('ended');
      expect(result[0].resumable).toBe(true);
    });
  });

  describe('disconnect/reconnect — sync replay carries resumable', () => {
    const activeResumableSession: AgentSession = {
      id: 's-1',
      daemonId: 'd-1',
      agentType: 'claude',
      mode: 'interactive',
      cwd: '/home/user',
      startedAt: 1000,
      status: 'active',
      claudeSessionId: 'cs-abc',
      resumable: true,
    };

    it('sync session:started with resumable preserves resumable:true after disconnect', () => {
      // 1. Disconnect: session:ended with resumable:false
      // 2. Sync: session:started with resumable:true
      const events: SSEEvent[] = [
        sseEnded({ resumable: false }),
        sseStarted({ resumable: true, claudeSessionId: 'cs-abc' }),
      ];
      const result = processEvents([activeResumableSession], events);
      expect(result[0].resumable).toBe(true);
      expect(result[0].claudeSessionId).toBe('cs-abc');
      expect(result[0].status).toBe('active');
    });

    it('sync session:started without resumable preserves existing resumable', () => {
      // Normal session:started (not from sync) shouldn't overwrite resumable
      const events: SSEEvent[] = [sseStarted()]; // no resumable field
      const result = processEvents([activeResumableSession], events);
      expect(result[0].resumable).toBe(true);
    });

    it('full disconnect/reconnect cycle for ended resumable session', () => {
      const endedResumable: AgentSession = {
        ...activeResumableSession,
        status: 'ended',
        exitCode: 0,
        resumable: true,
      };
      // Disconnect: session:ended with resumable:false (from onClose)
      // Sync: session:started with resumable:true, then session:ended with resumable:true
      const events: SSEEvent[] = [
        sseEnded({ resumable: false }),
        sseStarted({ resumable: true, claudeSessionId: 'cs-abc' }),
        sseEnded({ resumable: true }),
      ];
      const result = processEvents([endedResumable], events);
      expect(result[0].status).toBe('ended');
      expect(result[0].resumable).toBe(true);
    });

    it('full disconnect/reconnect with fast reconnect (no disconnect events)', () => {
      // When daemon reconnects instantly, onClose skips SSE publishes.
      // Only sync events arrive.
      const events: SSEEvent[] = [sseStarted({ resumable: true, claudeSessionId: 'cs-abc' })];
      const result = processEvents([activeResumableSession], events);
      expect(result[0].resumable).toBe(true);
      expect(result[0].status).toBe('active');
    });

    it('session:resumable-changed also works as fallback', () => {
      // Even if session:started doesn't carry resumable, the follow-up event fixes it
      const sessionWithFalseResumable: AgentSession = {
        ...activeResumableSession,
        resumable: false,
      };
      const events: SSEEvent[] = [sseResumableChanged('s-1', true)];
      const result = processEvents([sessionWithFalseResumable], events);
      expect(result[0].resumable).toBe(true);
    });
  });

  describe('multiple sessions in sync', () => {
    it('handles multiple sessions with different resumable states', () => {
      const events: SSEEvent[] = [
        sseStarted({ sessionId: 's-1', resumable: true, claudeSessionId: 'cs-1' }),
        sseStarted({ sessionId: 's-2', resumable: false }),
        sseStarted({
          sessionId: 's-3',
          resumable: true,
          claudeSessionId: 'cs-3',
          agentType: 'claude',
        }),
        sseEnded({ sessionId: 's-1', resumable: true }),
        sseEnded({ sessionId: 's-2', resumable: false }),
      ];
      const result = processEvents([], events);
      expect(result).toHaveLength(3);
      expect(result.find((s) => s.id === 's-1')?.resumable).toBe(true);
      expect(result.find((s) => s.id === 's-2')?.resumable).toBe(false);
      expect(result.find((s) => s.id === 's-3')?.resumable).toBe(true);
      expect(result.find((s) => s.id === 's-3')?.status).toBe('active');
    });
  });
});

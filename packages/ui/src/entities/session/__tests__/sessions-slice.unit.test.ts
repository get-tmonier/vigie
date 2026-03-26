import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@vigie/shared';
import {
  daemonSessionsReset,
  sessionEnded,
  sessionStarted,
  sessionsLoaded,
  sessionsReducer,
} from '../model/sessions-slice';

const initialState = { byId: {}, allIds: [], loadingByDaemonId: {}, resumeCountById: {} };

function sseEnded(
  overrides: Partial<{ sessionId: string; exitCode: number; resumable: boolean }> = {}
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

function sseStarted(
  overrides: Partial<{
    daemonId: string;
    sessionId: string;
    agentType: 'claude' | 'opencode' | 'generic';
    mode: 'prompt' | 'interactive';
    cwd: string;
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

describe('sessionsSlice', () => {
  describe('sessionStarted idempotent', () => {
    it('creates session on first event', () => {
      const state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      expect(state.allIds).toHaveLength(1);
      expect(state.byId['s-1']?.status).toBe('active');
    });

    it('same event twice → only 1 session', () => {
      const event = sessionStarted(sseStarted() as never);
      let state = sessionsReducer(initialState, event);
      state = sessionsReducer(state, event);
      expect(state.allIds).toHaveLength(1);
      expect(state.allIds.filter((id) => id === 's-1')).toHaveLength(1);
    });

    it('upsert preserves existing resumable when new event has no resumable', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ resumable: true }) as never)
      );
      // Second started event without resumable field
      state = sessionsReducer(state, sessionStarted(sseStarted({ timestamp: 2000 }) as never));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('upsert with new resumable value updates it', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ resumable: false }) as never)
      );
      state = sessionsReducer(state, sessionStarted(sseStarted({ resumable: true }) as never));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });
  });

  describe('daemonSessionsReset', () => {
    it('clears only sessions of the specified daemon', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ sessionId: 's-1', daemonId: 'd-1' }) as never)
      );
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ sessionId: 's-2', daemonId: 'd-2' }) as never)
      );
      expect(state.allIds).toHaveLength(2);

      state = sessionsReducer(state, daemonSessionsReset('d-1'));
      expect(state.allIds).toHaveLength(1);
      expect(state.byId['s-1']).toBeUndefined();
      expect(state.byId['s-2']?.daemonId).toBe('d-2');
    });

    it('resetting unknown daemon leaves state unchanged', () => {
      const state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      const next = sessionsReducer(state, daemonSessionsReset('d-unknown'));
      expect(next.allIds).toHaveLength(1);
    });

    it('clears resumeCountById for sessions of the reset daemon', () => {
      // Start session, end it, then resume it to build up a resumeCount
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ sessionId: 's-1', daemonId: 'd-1' }) as never)
      );
      state = sessionsReducer(state, sessionEnded(sseEnded({ sessionId: 's-1' }) as never));
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ sessionId: 's-1', daemonId: 'd-1', timestamp: 3000 }) as never)
      );
      expect(state.resumeCountById['s-1']).toBe(1);

      state = sessionsReducer(state, daemonSessionsReset('d-1'));
      expect(state.resumeCountById['s-1']).toBeUndefined();
    });
  });

  describe('resumeCountById', () => {
    it('does not increment on first session:started', () => {
      const state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      expect(state.resumeCountById['s-1']).toBeUndefined();
    });

    it('increments when session:started fires for an ended session (resume)', () => {
      let state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      state = sessionsReducer(state, sessionEnded(sseEnded() as never));
      expect(state.byId['s-1']?.status).toBe('ended');

      state = sessionsReducer(state, sessionStarted(sseStarted({ timestamp: 3000 }) as never));
      expect(state.resumeCountById['s-1']).toBe(1);
      expect(state.byId['s-1']?.status).toBe('active');
    });

    it('increments again on a second resume', () => {
      let state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      state = sessionsReducer(state, sessionEnded(sseEnded() as never));
      state = sessionsReducer(state, sessionStarted(sseStarted({ timestamp: 3000 }) as never));
      state = sessionsReducer(
        state,
        sessionEnded(sseEnded({ exitCode: 143, resumable: true }) as never)
      );
      state = sessionsReducer(state, sessionStarted(sseStarted({ timestamp: 5000 }) as never));
      expect(state.resumeCountById['s-1']).toBe(2);
    });

    it('does not affect other sessions', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ sessionId: 's-1' }) as never)
      );
      state = sessionsReducer(state, sessionStarted(sseStarted({ sessionId: 's-2' }) as never));
      state = sessionsReducer(state, sessionEnded(sseEnded({ sessionId: 's-1' }) as never));
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ sessionId: 's-1', timestamp: 3000 }) as never)
      );
      expect(state.resumeCountById['s-1']).toBe(1);
      expect(state.resumeCountById['s-2']).toBeUndefined();
    });

    it('session:started for active session (new spawn) does not increment', () => {
      // Start s-1 and s-2, end s-1, resume s-1, then start s-3 fresh
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ sessionId: 's-1' }) as never)
      );
      state = sessionsReducer(state, sessionEnded(sseEnded({ sessionId: 's-1' }) as never));
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ sessionId: 's-1', timestamp: 3000 }) as never)
      );
      // s-1 resumeCount is now 1
      // Start a brand new s-3
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ sessionId: 's-3', daemonId: 'd-1', timestamp: 4000 }) as never)
      );
      expect(state.resumeCountById['s-3']).toBeUndefined();
      expect(state.resumeCountById['s-1']).toBe(1);
    });
  });

  describe('sessionsLoaded', () => {
    it('replaces existing sessions for daemon and marks loading false', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(sseStarted({ sessionId: 's-old' }) as never)
      );
      state = sessionsReducer(
        state,
        sessionsLoaded({
          daemonId: 'd-1',
          sessions: [
            {
              id: 's-new',
              daemonId: 'd-1',
              agentType: 'claude',
              mode: 'interactive',
              cwd: '/home',
              startedAt: 2000,
              status: 'active',
            },
          ],
        })
      );
      expect(state.byId['s-old']).toBeUndefined();
      expect(state.byId['s-new']?.id).toBe('s-new');
      expect(state.loadingByDaemonId['d-1']).toBe(false);
    });

    it('stores resumable: true when API returns it', () => {
      const state = sessionsReducer(
        initialState,
        sessionsLoaded({
          daemonId: 'd-1',
          sessions: [
            {
              id: 's-1',
              daemonId: 'd-1',
              agentType: 'claude',
              mode: 'interactive',
              cwd: '/home',
              startedAt: 1000,
              status: 'active',
              resumable: true,
            },
          ],
        })
      );
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('stores resumable: undefined when API omits it (sessionStore not yet updated)', () => {
      const state = sessionsReducer(
        initialState,
        sessionsLoaded({
          daemonId: 'd-1',
          sessions: [
            {
              id: 's-1',
              daemonId: 'd-1',
              agentType: 'claude',
              mode: 'interactive',
              cwd: '/home',
              startedAt: 1000,
              status: 'active',
            },
          ],
        })
      );
      // resumable is undefined — the SSE session:resumable-changed or session:started
      // with resumable will set it once received.
      expect(state.byId['s-1']?.resumable).toBeUndefined();
    });
  });

  describe('page-refresh resumable scenarios', () => {
    it('sessionStarted with resumable: true after sessionsLoaded with undefined keeps true', () => {
      // Simulates: listSessions returns resumable: undefined, then SSE snapshot
      // session:started arrives with resumable: true (carry-forward from sessionStore)
      let state = sessionsReducer(
        initialState,
        sessionsLoaded({
          daemonId: 'd-1',
          sessions: [
            {
              id: 's-1',
              daemonId: 'd-1',
              agentType: 'claude',
              mode: 'interactive',
              cwd: '/home',
              startedAt: 1000,
              status: 'active',
            },
          ],
        })
      );
      expect(state.byId['s-1']?.resumable).toBeUndefined();

      state = sessionsReducer(state, sessionStarted(sseStarted({ resumable: true }) as never));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('sessionStarted with resumable: undefined preserves existing resumable from sessionsLoaded', () => {
      // Simulates: listSessions returns resumable: true, then SSE session:started
      // arrives without resumable (e.g. snapshot has no resumable field)
      let state = sessionsReducer(
        initialState,
        sessionsLoaded({
          daemonId: 'd-1',
          sessions: [
            {
              id: 's-1',
              daemonId: 'd-1',
              agentType: 'claude',
              mode: 'interactive',
              cwd: '/home',
              startedAt: 1000,
              status: 'active',
              resumable: true,
            },
          ],
        })
      );

      // session:started without resumable field should not overwrite existing resumable: true
      state = sessionsReducer(state, sessionStarted(sseStarted() as never));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('resumed session: sessionStarted for ended session preserves resumable: true', () => {
      // Simulates the SSE snapshot session:started for a resumed session where
      // the API correctly carries forward resumable from the ended session.
      // The snapshot session:started includes resumable: true.
      let state = sessionsReducer(initialState, sessionStarted(sseStarted() as never));
      state = sessionsReducer(state, sessionEnded(sseEnded({ resumable: true }) as never));
      expect(state.byId['s-1']?.resumable).toBe(true);

      // Resume: session:started arrives (from SSE snapshot) with resumable: true
      state = sessionsReducer(
        state,
        sessionStarted(sseStarted({ timestamp: 3000, resumable: true }) as never)
      );
      expect(state.byId['s-1']?.status).toBe('active');
      expect(state.byId['s-1']?.resumable).toBe(true);
    });
  });
});

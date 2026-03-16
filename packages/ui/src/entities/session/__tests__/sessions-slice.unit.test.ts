import { describe, expect, it } from 'bun:test';
import type { SSEEvent } from '@tmonier/shared';
import {
  daemonSessionsReset,
  sessionStarted,
  sessionsLoaded,
  sessionsReducer,
} from '../model/sessions-slice';

const initialState = { byId: {}, allIds: [], loadingByDaemonId: {} };

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
  });
});

import { describe, expect, it } from 'bun:test';
import type { SessionEnded, SessionStarted } from '@vigie/shared';
import {
  endedSessionsCleared,
  resumableChanged,
  sessionEnded,
  sessionStarted,
  sessionsLoaded,
  sessionsReducer,
  sessionsReset,
} from '../model/sessions-slice';

const initialState = { byId: {}, allIds: [], loading: false, resumeCountById: {} };

function makeStarted(overrides: Partial<Omit<SessionStarted, 'type'>> = {}): SessionStarted {
  return {
    type: 'session:started',
    sessionId: 's-1',
    agentType: 'claude',
    mode: 'interactive',
    cwd: '/home/user',
    timestamp: 1000,
    ...overrides,
  };
}

function makeEnded(overrides: Partial<Omit<SessionEnded, 'type'>> = {}): SessionEnded {
  return {
    type: 'session:ended',
    sessionId: 's-1',
    exitCode: 0,
    resumable: false,
    timestamp: 2000,
    ...overrides,
  };
}

describe('sessionsSlice', () => {
  describe('sessionStarted idempotent', () => {
    it('creates session on first event', () => {
      const state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      expect(state.allIds).toHaveLength(1);
      expect(state.byId['s-1']?.status).toBe('active');
    });

    it('same event twice → only 1 session', () => {
      const event = sessionStarted(makeStarted());
      let state = sessionsReducer(initialState, event);
      state = sessionsReducer(state, event);
      expect(state.allIds).toHaveLength(1);
      expect(state.allIds.filter((id) => id === 's-1')).toHaveLength(1);
    });

    it('upsert preserves existing resumable when new sessionStarted arrives', () => {
      // Set up session with resumable via sessionsLoaded (the REST API source of truth)
      let state = sessionsReducer(
        initialState,
        sessionsLoaded({
          sessions: [
            {
              id: 's-1',
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
      // sessionStarted arrives (e.g., from WS sync) — should not clear resumable
      state = sessionsReducer(state, sessionStarted(makeStarted({ timestamp: 2000 })));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('upsert with resumableChanged updates resumable', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      // resumable comes from session:resumable-changed, not session:started
      state = sessionsReducer(
        state,
        resumableChanged({
          type: 'session:resumable-changed',
          sessionId: 's-1',
          resumable: true,
          timestamp: 2000,
        })
      );
      expect(state.byId['s-1']?.resumable).toBe(true);
    });
  });

  describe('sessionsReset', () => {
    it('clears all sessions', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted({ sessionId: 's-1' })));
      state = sessionsReducer(state, sessionStarted(makeStarted({ sessionId: 's-2' })));
      expect(state.allIds).toHaveLength(2);

      state = sessionsReducer(state, sessionsReset());
      expect(state.allIds).toHaveLength(0);
      expect(state.byId).toEqual({});
    });

    it('clears resumeCountById', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted({ sessionId: 's-1' })));
      state = sessionsReducer(state, sessionEnded(makeEnded({ sessionId: 's-1' })));
      state = sessionsReducer(
        state,
        sessionStarted(makeStarted({ sessionId: 's-1', timestamp: 3000 }))
      );
      expect(state.resumeCountById['s-1']).toBe(1);

      state = sessionsReducer(state, sessionsReset());
      expect(state.resumeCountById['s-1']).toBeUndefined();
    });
  });

  describe('endedSessionsCleared', () => {
    it('clears only ended sessions', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted({ sessionId: 's-1' })));
      state = sessionsReducer(state, sessionStarted(makeStarted({ sessionId: 's-2' })));
      state = sessionsReducer(state, sessionEnded(makeEnded({ sessionId: 's-1' })));

      state = sessionsReducer(state, endedSessionsCleared());
      expect(state.allIds).toHaveLength(1);
      expect(state.byId['s-1']).toBeUndefined();
      expect(state.byId['s-2']?.status).toBe('active');
    });
  });

  describe('resumeCountById', () => {
    it('does not increment on first session:started', () => {
      const state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      expect(state.resumeCountById['s-1']).toBeUndefined();
    });

    it('increments when session:started fires for an ended session (resume)', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      state = sessionsReducer(state, sessionEnded(makeEnded()));
      expect(state.byId['s-1']?.status).toBe('ended');

      state = sessionsReducer(state, sessionStarted(makeStarted({ timestamp: 3000 })));
      expect(state.resumeCountById['s-1']).toBe(1);
      expect(state.byId['s-1']?.status).toBe('active');
    });

    it('increments again on a second resume', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      state = sessionsReducer(state, sessionEnded(makeEnded()));
      state = sessionsReducer(state, sessionStarted(makeStarted({ timestamp: 3000 })));
      state = sessionsReducer(state, sessionEnded(makeEnded({ exitCode: 143, resumable: true })));
      state = sessionsReducer(state, sessionStarted(makeStarted({ timestamp: 5000 })));
      expect(state.resumeCountById['s-1']).toBe(2);
    });

    it('does not affect other sessions', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted({ sessionId: 's-1' })));
      state = sessionsReducer(state, sessionStarted(makeStarted({ sessionId: 's-2' })));
      state = sessionsReducer(state, sessionEnded(makeEnded({ sessionId: 's-1' })));
      state = sessionsReducer(
        state,
        sessionStarted(makeStarted({ sessionId: 's-1', timestamp: 3000 }))
      );
      expect(state.resumeCountById['s-1']).toBe(1);
      expect(state.resumeCountById['s-2']).toBeUndefined();
    });

    it('session:started for active session (new spawn) does not increment', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted({ sessionId: 's-1' })));
      state = sessionsReducer(state, sessionEnded(makeEnded({ sessionId: 's-1' })));
      state = sessionsReducer(
        state,
        sessionStarted(makeStarted({ sessionId: 's-1', timestamp: 3000 }))
      );
      state = sessionsReducer(
        state,
        sessionStarted(makeStarted({ sessionId: 's-3', timestamp: 4000 }))
      );
      expect(state.resumeCountById['s-3']).toBeUndefined();
      expect(state.resumeCountById['s-1']).toBe(1);
    });
  });

  describe('sessionsLoaded', () => {
    it('replaces existing sessions and marks loading false', () => {
      let state = sessionsReducer(
        initialState,
        sessionStarted(makeStarted({ sessionId: 's-old' }))
      );
      state = sessionsReducer(
        state,
        sessionsLoaded({
          sessions: [
            {
              id: 's-new',
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
      expect(state.loading).toBe(false);
    });

    it('stores resumable: true when API returns it', () => {
      const state = sessionsReducer(
        initialState,
        sessionsLoaded({
          sessions: [
            {
              id: 's-1',
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
          sessions: [
            {
              id: 's-1',
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
    });
  });

  describe('page-refresh resumable scenarios', () => {
    it('sessionStarted after sessionsLoaded preserves existing resumable', () => {
      let state = sessionsReducer(
        initialState,
        sessionsLoaded({
          sessions: [
            {
              id: 's-1',
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

      // session:started WS event should not overwrite existing resumable
      state = sessionsReducer(state, sessionStarted(makeStarted()));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('sessionStarted with resumable: undefined preserves existing resumable from sessionsLoaded', () => {
      let state = sessionsReducer(
        initialState,
        sessionsLoaded({
          sessions: [
            {
              id: 's-1',
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

      state = sessionsReducer(state, sessionStarted(makeStarted()));
      expect(state.byId['s-1']?.resumable).toBe(true);
    });

    it('resumed session: sessionStarted for ended session preserves resumable: true', () => {
      let state = sessionsReducer(initialState, sessionStarted(makeStarted()));
      state = sessionsReducer(state, sessionEnded(makeEnded({ resumable: true })));
      expect(state.byId['s-1']?.resumable).toBe(true);

      state = sessionsReducer(state, sessionStarted(makeStarted({ timestamp: 3000 })));
      expect(state.byId['s-1']?.status).toBe('active');
      expect(state.byId['s-1']?.resumable).toBe(true);
    });
  });
});

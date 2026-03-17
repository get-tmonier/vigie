import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  SSEEvent,
  SSESessionClaudeIdDetected,
  SSESessionEnded,
  SSESessionError,
  SSESessionSpawnFailed,
  SSESessionStarted,
} from '@tmonier/shared';
import type { RootState } from '#app/store';
import type { AgentSession } from '../api/session-api';

type SSESessionResumableChanged = Extract<SSEEvent, { type: 'session:resumable-changed' }>;

export interface SessionsState {
  byId: Record<string, AgentSession>;
  allIds: string[];
  loadingByDaemonId: Record<string, boolean>;
  resumeCountById: Record<string, number>;
}

const initialState: SessionsState = {
  byId: {},
  allIds: [],
  loadingByDaemonId: {},
  resumeCountById: {},
};

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    sessionsLoading: (state, action: PayloadAction<string>) => {
      state.loadingByDaemonId[action.payload] = true;
    },

    sessionsLoaded: (
      state,
      action: PayloadAction<{ daemonId: string; sessions: AgentSession[] }>
    ) => {
      const { daemonId, sessions } = action.payload;
      const toRemove = state.allIds.filter((id) => state.byId[id]?.daemonId === daemonId);
      for (const id of toRemove) {
        delete state.byId[id];
      }
      state.allIds = state.allIds.filter((id) => !toRemove.includes(id));
      for (const session of sessions) {
        state.byId[session.id] = session;
        state.allIds.push(session.id);
      }
      state.loadingByDaemonId[daemonId] = false;
    },

    sessionStarted: (state, action: PayloadAction<SSESessionStarted>) => {
      const event = action.payload;
      const existing = state.byId[event.sessionId];
      const isResume = existing?.status === 'ended';
      const session: AgentSession = {
        id: event.sessionId,
        daemonId: event.daemonId,
        agentType: event.agentType,
        mode: event.mode ?? 'prompt',
        cwd: event.cwd,
        gitBranch: event.gitBranch,
        repoName: event.repoName,
        startedAt: event.timestamp,
        status: 'active',
        ...(event.resumable !== undefined && { resumable: event.resumable }),
        ...(event.claudeSessionId !== undefined && { claudeSessionId: event.claudeSessionId }),
      };
      if (existing) {
        state.byId[event.sessionId] = {
          ...existing,
          ...session,
          resumable: event.resumable ?? existing.resumable,
        };
      } else {
        state.byId[event.sessionId] = session;
        state.allIds.push(event.sessionId);
      }
      if (isResume) {
        state.resumeCountById[event.sessionId] = (state.resumeCountById[event.sessionId] ?? 0) + 1;
      }
    },

    sessionEnded: (state, action: PayloadAction<SSESessionEnded>) => {
      const session = state.byId[action.payload.sessionId];
      if (session) {
        session.status = 'ended';
        session.exitCode = action.payload.exitCode;
        session.resumable = action.payload.resumable ?? false;
      }
    },

    sessionErrored: (state, action: PayloadAction<SSESessionError | SSESessionSpawnFailed>) => {
      const session = state.byId[action.payload.sessionId];
      if (session) {
        session.status = 'ended';
        session.exitCode = -1;
      }
    },

    claudeIdDetected: (state, action: PayloadAction<SSESessionClaudeIdDetected>) => {
      const session = state.byId[action.payload.sessionId];
      if (session) {
        session.claudeSessionId = action.payload.claudeSessionId;
      }
    },

    resumableChanged: (state, action: PayloadAction<SSESessionResumableChanged>) => {
      const session = state.byId[action.payload.sessionId];
      if (session) {
        session.resumable = action.payload.resumable;
      }
    },

    sessionRemoved: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.byId[id];
      state.allIds = state.allIds.filter((existingId) => existingId !== id);
    },

    endedSessionsCleared: (state, action: PayloadAction<string>) => {
      const daemonId = action.payload;
      const toRemove = state.allIds.filter(
        (id) => state.byId[id]?.daemonId === daemonId && state.byId[id]?.status === 'ended'
      );
      for (const id of toRemove) {
        delete state.byId[id];
      }
      state.allIds = state.allIds.filter((id) => !toRemove.includes(id));
    },

    daemonSessionsReset: (state, action: PayloadAction<string>) => {
      const daemonId = action.payload;
      const toRemove = state.allIds.filter((id) => state.byId[id]?.daemonId === daemonId);
      for (const id of toRemove) {
        delete state.byId[id];
        delete state.resumeCountById[id];
      }
      state.allIds = state.allIds.filter((id) => !toRemove.includes(id));
      delete state.loadingByDaemonId[daemonId];
    },
  },
});

export const {
  sessionsLoading,
  sessionsLoaded,
  sessionStarted,
  sessionEnded,
  sessionErrored,
  claudeIdDetected,
  resumableChanged,
  sessionRemoved,
  endedSessionsCleared,
  daemonSessionsReset,
} = sessionsSlice.actions;

export const sessionsReducer = sessionsSlice.reducer;

export const selectActiveSessions =
  (daemonId: string | null) =>
  (state: RootState): AgentSession[] =>
    daemonId
      ? state.sessions.allIds
          .map((id) => state.sessions.byId[id])
          .filter(
            (s): s is AgentSession =>
              s !== undefined && s.daemonId === daemonId && s.status === 'active'
          )
      : [];

export const selectEndedSessions =
  (daemonId: string | null) =>
  (state: RootState): AgentSession[] =>
    daemonId
      ? state.sessions.allIds
          .map((id) => state.sessions.byId[id])
          .filter(
            (s): s is AgentSession =>
              s !== undefined && s.daemonId === daemonId && s.status === 'ended'
          )
      : [];

export const selectSession =
  (sessionId: string | null) =>
  (state: RootState): AgentSession | null =>
    sessionId ? (state.sessions.byId[sessionId] ?? null) : null;

export const selectLoading =
  (daemonId: string | null) =>
  (state: RootState): boolean =>
    daemonId ? (state.sessions.loadingByDaemonId[daemonId] ?? false) : false;

export const selectSessionResumeCount =
  (sessionId: string | null) =>
  (state: RootState): number =>
    sessionId ? (state.sessions.resumeCountById[sessionId] ?? 0) : 0;

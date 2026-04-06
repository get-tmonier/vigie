import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#app/store';
import type { DaemonEvent } from '#shared/types/daemon-event';
import type { AgentSession } from '../api/session-api';

export interface SessionsState {
  byId: Record<string, AgentSession>;
  allIds: string[];
  loading: boolean;
  resumeCountById: Record<string, number>;
}

const initialState: SessionsState = {
  byId: {},
  allIds: [],
  loading: false,
  resumeCountById: {},
};

const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    sessionsLoading: (state) => {
      state.loading = true;
    },

    sessionsLoaded: (state, action: PayloadAction<{ sessions: AgentSession[] }>) => {
      const { sessions } = action.payload;
      state.byId = {};
      state.allIds = [];
      for (const session of sessions) {
        state.byId[session.id] = session;
        state.allIds.push(session.id);
      }
      state.loading = false;
    },

    sessionStarted: (state, action: PayloadAction<DaemonEvent>) => {
      const event = action.payload;
      const sessionId = event.sessionId as string;
      const existing = state.byId[sessionId];
      const isResume = existing?.status === 'ended';
      const session: AgentSession = {
        id: sessionId,
        agentType: (event.agentType as string) ?? 'claude',
        mode: (event.mode as string) ?? 'prompt',
        cwd: (event.cwd as string) ?? '',
        gitBranch: event.gitBranch as string | undefined,
        repoName: event.repoName as string | undefined,
        startedAt: (event.timestamp as number) ?? Date.now(),
        status: 'active',
        ...(event.resumable !== undefined && { resumable: event.resumable as boolean }),
        ...(event.claudeSessionId !== undefined && {
          claudeSessionId: event.claudeSessionId as string,
        }),
      };
      if (existing) {
        state.byId[sessionId] = {
          ...existing,
          ...session,
          resumable: (event.resumable as boolean) ?? existing.resumable,
        };
      } else {
        state.byId[sessionId] = session;
        state.allIds.push(sessionId);
      }
      if (isResume) {
        state.resumeCountById[sessionId] = (state.resumeCountById[sessionId] ?? 0) + 1;
      }
    },

    sessionEnded: (state, action: PayloadAction<DaemonEvent>) => {
      const sessionId = action.payload.sessionId as string;
      const session = state.byId[sessionId];
      if (session) {
        session.status = 'ended';
        session.exitCode = action.payload.exitCode as number | undefined;
        session.resumable = (action.payload.resumable as boolean) ?? false;
      }
    },

    sessionErrored: (state, action: PayloadAction<DaemonEvent>) => {
      const sessionId = action.payload.sessionId as string;
      const session = state.byId[sessionId];
      if (session) {
        session.status = 'ended';
        session.exitCode = -1;
      }
    },

    claudeIdDetected: (state, action: PayloadAction<DaemonEvent>) => {
      const sessionId = action.payload.sessionId as string;
      const session = state.byId[sessionId];
      if (session) {
        session.claudeSessionId = action.payload.claudeSessionId as string;
      }
    },

    resumableChanged: (state, action: PayloadAction<DaemonEvent>) => {
      const sessionId = action.payload.sessionId as string;
      const session = state.byId[sessionId];
      if (session) {
        session.resumable = action.payload.resumable as boolean;
      }
    },

    sessionRemoved: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      delete state.byId[id];
      state.allIds = state.allIds.filter((existingId) => existingId !== id);
    },

    endedSessionsCleared: (state) => {
      const toRemove = state.allIds.filter((id) => state.byId[id]?.status === 'ended');
      for (const id of toRemove) {
        delete state.byId[id];
      }
      state.allIds = state.allIds.filter((id) => !toRemove.includes(id));
    },

    sessionsReset: (state) => {
      state.byId = {};
      state.allIds = [];
      state.loading = false;
      state.resumeCountById = {};
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
  sessionsReset,
} = sessionsSlice.actions;

export const sessionsReducer = sessionsSlice.reducer;

export const selectActiveSessions = (state: RootState): AgentSession[] =>
  state.sessions.allIds
    .map((id) => state.sessions.byId[id])
    .filter((s): s is AgentSession => s !== undefined && s.status === 'active');

export const selectEndedSessions = (state: RootState): AgentSession[] =>
  state.sessions.allIds
    .map((id) => state.sessions.byId[id])
    .filter((s): s is AgentSession => s !== undefined && s.status === 'ended');

export const selectSession =
  (sessionId: string | null) =>
  (state: RootState): AgentSession | null =>
    sessionId ? (state.sessions.byId[sessionId] ?? null) : null;

export const selectLoading = (state: RootState): boolean => state.sessions.loading;

export const selectSessionResumeCount =
  (sessionId: string | null) =>
  (state: RootState): number =>
    sessionId ? (state.sessions.resumeCountById[sessionId] ?? 0) : 0;

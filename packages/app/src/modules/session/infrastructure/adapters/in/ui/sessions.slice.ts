import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AgentSession } from '#modules/session/infrastructure/adapters/in/session.dto';

interface SessionsState {
  sessions: AgentSession[];
  selectedId: string | null;
}

const initialState: SessionsState = {
  sessions: [],
  selectedId: null,
};

export const sessionsSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    snapshotReceived(state, action: PayloadAction<AgentSession[]>) {
      state.sessions = action.payload;
      if (state.selectedId && !action.payload.find((s) => s.id === state.selectedId)) {
        state.selectedId =
          action.payload.find((s) => s.status === 'active')?.id ?? action.payload[0]?.id ?? null;
      }
    },
    sessionEnded(
      state,
      action: PayloadAction<{ sessionId: string; exitCode?: number; resumable: boolean }>
    ) {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) {
        session.status = 'ended';
        session.resumable = action.payload.resumable;
        if (action.payload.exitCode !== undefined) session.exitCode = action.payload.exitCode;
      }
    },
    sessionRemoved(state, action: PayloadAction<string>) {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.selectedId === action.payload) {
        state.selectedId =
          state.sessions.find((s) => s.status === 'active')?.id ?? state.sessions[0]?.id ?? null;
      }
    },
    endedSessionsCleared(state) {
      const removedIds = new Set(
        state.sessions.filter((s) => s.status !== 'active').map((s) => s.id)
      );
      state.sessions = state.sessions.filter((s) => s.status === 'active');
      if (state.selectedId && removedIds.has(state.selectedId)) {
        state.selectedId = state.sessions[0]?.id ?? null;
      }
    },
    sessionResumableChanged(
      state,
      action: PayloadAction<{ sessionId: string; resumable: boolean }>
    ) {
      const session = state.sessions.find((s) => s.id === action.payload.sessionId);
      if (session) session.resumable = action.payload.resumable;
    },
    sessionSelected(state, action: PayloadAction<string>) {
      state.selectedId = action.payload;
    },
  },
});

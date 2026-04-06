import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#app/store';
import type { DaemonEvent } from '#shared/types/daemon-event';

export interface HistoryEntry {
  text: string;
  timestamp: number;
  source?: 'cli' | 'browser';
}

export interface InputHistoryState {
  entriesBySessionId: Record<string, HistoryEntry[]>;
  seenKeysBySessionId: Record<string, string[]>;
}

const initialState: InputHistoryState = {
  entriesBySessionId: {},
  seenKeysBySessionId: {},
};

const inputHistorySlice = createSlice({
  name: 'inputHistory',
  initialState,
  reducers: {
    inputEchoReceived: (state, action: PayloadAction<DaemonEvent>) => {
      const { sessionId, text, source, timestamp } = action.payload as DaemonEvent & {
        sessionId: string;
        text: string;
        source?: 'cli' | 'browser';
        timestamp: number;
      };
      const key = `${timestamp}:${text}`;
      const seenKeys = state.seenKeysBySessionId[sessionId] ?? [];
      if (seenKeys.includes(key)) return;
      state.seenKeysBySessionId[sessionId] = [...seenKeys, key];
      const entries = state.entriesBySessionId[sessionId] ?? [];
      state.entriesBySessionId[sessionId] = [...entries, { text, source, timestamp }];
    },
  },
});

export const { inputEchoReceived } = inputHistorySlice.actions;

export const inputHistoryReducer = inputHistorySlice.reducer;

export const selectInputHistory =
  (sessionId: string) =>
  (state: RootState): HistoryEntry[] =>
    state.inputHistory.entriesBySessionId[sessionId] ?? [];

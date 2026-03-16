import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SSETerminalInputEcho } from '@tmonier/shared';
import type { RootState } from '#app/store';

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
    inputEchoReceived: (state, action: PayloadAction<SSETerminalInputEcho>) => {
      const { sessionId, text, source, timestamp } = action.payload;
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

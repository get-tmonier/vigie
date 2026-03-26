import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { SSEDaemonConnected, SSEDaemonDisconnected, SSEEvent } from '@vigie/shared';
import type { RootState } from '#app/store';

export interface ConnectionState {
  daemonOnline: boolean;
  hostname: string | null;
  reconnectCount: number;
  events: SSEEvent[];
}

const initialState: ConnectionState = {
  daemonOnline: true,
  hostname: null,
  reconnectCount: 0,
  events: [],
};

const connectionSlice = createSlice({
  name: 'connection',
  initialState,
  reducers: {
    daemonConnected: (state, action: PayloadAction<SSEDaemonConnected>) => {
      state.daemonOnline = true;
      state.hostname = action.payload.hostname;
      state.reconnectCount += 1;
    },

    daemonDisconnected: (state, action: PayloadAction<SSEDaemonDisconnected>) => {
      state.daemonOnline = false;
      state.hostname = action.payload.hostname;
    },

    eventAdded: (state, action: PayloadAction<SSEEvent>) => {
      state.events.push(action.payload);
    },

    eventsReset: (state) => {
      state.events = [];
      state.daemonOnline = true;
      state.hostname = null;
    },
  },
});

export const { daemonConnected, daemonDisconnected, eventAdded, eventsReset } =
  connectionSlice.actions;

export const connectionReducer = connectionSlice.reducer;

export const selectDaemonOnline = (state: RootState): boolean => state.connection.daemonOnline;

export const selectReconnectCount = (state: RootState): number => state.connection.reconnectCount;

export const selectEvents = (state: RootState): SSEEvent[] => state.connection.events;

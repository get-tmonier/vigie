import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '#app/store';
import type { DaemonEvent } from '#shared/types/daemon-event';

export interface ConnectionState {
  daemonOnline: boolean;
  hostname: string | null;
  reconnectCount: number;
  events: DaemonEvent[];
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
    daemonConnected: (state) => {
      state.daemonOnline = true;
      state.reconnectCount += 1;
    },

    daemonDisconnected: (state) => {
      state.daemonOnline = false;
    },

    eventAdded: (state, action: PayloadAction<DaemonEvent>) => {
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

export const selectEvents = (state: RootState): DaemonEvent[] => state.connection.events;

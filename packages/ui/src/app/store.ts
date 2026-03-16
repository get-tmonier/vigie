import { configureStore } from '@reduxjs/toolkit';
import type { ConnectionState } from '#entities/connection/model/connection-slice';
import { connectionReducer } from '#entities/connection/model/connection-slice';
import type { InputHistoryState } from '#entities/input-history/model/input-history-slice';
import { inputHistoryReducer } from '#entities/input-history/model/input-history-slice';
import type { SessionsState } from '#entities/session/model/sessions-slice';
import { sessionsReducer } from '#entities/session/model/sessions-slice';

export const store = configureStore({
  reducer: {
    sessions: sessionsReducer,
    inputHistory: inputHistoryReducer,
    connection: connectionReducer,
  },
});

export type RootState = {
  sessions: SessionsState;
  inputHistory: InputHistoryState;
  connection: ConnectionState;
};
export type AppDispatch = typeof store.dispatch;

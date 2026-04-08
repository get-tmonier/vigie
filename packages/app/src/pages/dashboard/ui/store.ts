import { configureStore } from '@reduxjs/toolkit';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { sessionsSlice } from './sessions.slice';

function readInitialData() {
  const el = document.getElementById('vigie-initial-data');
  let sessions: AgentSession[] = [];
  let homedir = '/';
  try {
    sessions = JSON.parse(el?.dataset.sessions ?? '[]') as AgentSession[];
  } catch {}
  if (el?.dataset.homedir) homedir = el.dataset.homedir;
  return { sessions, homedir };
}

const { sessions: initialSessionsData, homedir: initialHomedir } = readInitialData();
export const homedir = initialHomedir;

const urlSelectedId = new URL(location.href).searchParams.get('session');
const initialSelectedId =
  urlSelectedId ??
  initialSessionsData.find((s) => s.status === 'active')?.id ??
  initialSessionsData[0]?.id ??
  null;

export const store = configureStore({
  reducer: { sessions: sessionsSlice.reducer },
  preloadedState: {
    sessions: { sessions: initialSessionsData, selectedId: initialSelectedId },
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

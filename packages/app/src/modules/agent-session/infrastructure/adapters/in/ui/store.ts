import { atom } from 'nanostores';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';

export const $sessions = atom<AgentSession[]>([]);
export const $selectedId = atom<string | null>(null);
export const $homedir = atom<string>('/');

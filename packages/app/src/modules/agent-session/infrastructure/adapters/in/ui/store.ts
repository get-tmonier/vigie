import { atom, map } from 'nanostores';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { StructuredEvent } from '#shared/kernel/session/events';

export const $sessions = atom<AgentSession[]>([]);
export const $selectedId = atom<string | null>(null);
export const $homedir = atom<string>('/');
const $eventFeed = map<Record<string, StructuredEvent[]>>({});

export function addEventToFeed(sessionId: string, event: StructuredEvent): void {
  const current = $eventFeed.get();
  const existing = current[sessionId] ?? [];
  $eventFeed.setKey(sessionId, [...existing, event]);
}

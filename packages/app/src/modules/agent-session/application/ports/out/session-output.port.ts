import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { SessionId } from '#shared/kernel/session/session-id';

export interface SessionOutputShape {
  subscribe(sessionId: SessionId, callback: (data: string) => void): () => void;
  publish(sessionId: SessionId, data: string): Effect.Effect<void>;
  hasSubscribers(sessionId: SessionId): boolean;
}

export class SessionOutput extends ServiceMap.Service<SessionOutput, SessionOutputShape>()(
  '@vigie/SessionOutput'
) {}

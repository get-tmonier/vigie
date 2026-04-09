import { ServiceMap } from 'effect';
import type { SessionId } from '#shared/kernel/session/session-id';

export interface TerminalChunk {
  readonly data: string;
  readonly timestamp: number;
  readonly seq: number;
}

export interface InputEntry {
  readonly text: string;
  readonly source: string;
  readonly timestamp: number;
}

export interface SessionLogShape {
  appendChunk(sessionId: SessionId, data: string, timestamp: number): void;
  getChunks(sessionId: SessionId, limit?: number): TerminalChunk[];
  getAllChunks(sessionId: SessionId): TerminalChunk[];
  appendInput(sessionId: SessionId, text: string, source: string, timestamp: number): void;
  getInputHistory(sessionId: SessionId, limit?: number): InputEntry[];
}

export class SessionLog extends ServiceMap.Service<SessionLog, SessionLogShape>()(
  '@vigie/SessionLog'
) {}

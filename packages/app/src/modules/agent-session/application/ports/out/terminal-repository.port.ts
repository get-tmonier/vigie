import { ServiceMap } from 'effect';

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

export interface TerminalRepositoryShape {
  appendChunk(sessionId: string, data: string, timestamp: number): void;
  getChunks(sessionId: string, limit?: number): TerminalChunk[];
  getAllChunks(sessionId: string): TerminalChunk[];
  appendInput(sessionId: string, text: string, source: string, timestamp: number): void;
  getInputHistory(sessionId: string, limit?: number): InputEntry[];
}

export class TerminalRepository extends ServiceMap.Service<
  TerminalRepository,
  TerminalRepositoryShape
>()('@vigie/TerminalRepository') {}

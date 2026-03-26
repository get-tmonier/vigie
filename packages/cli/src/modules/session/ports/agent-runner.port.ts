import type { Stream } from 'effect';
import type { AgentRunnerError } from '../domain/errors.js';

export type ChunkType = 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error';

export interface AgentChunk {
  readonly chunkType: ChunkType;
  readonly data: string;
  readonly timestamp: number;
}

export interface AgentRunnerShape {
  readonly spawn: (options: {
    prompt: string;
    cwd: string;
    onSessionId?: (sessionId: string) => void;
  }) => Stream.Stream<AgentChunk, AgentRunnerError>;
}

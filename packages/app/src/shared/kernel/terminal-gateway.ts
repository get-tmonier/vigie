import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { DomainEvent } from '#shared/kernel/domain-events';
import type { AgentRunnerError } from '#shared/kernel/errors';
import type { PtyHandle } from '#shared/kernel/pty';

export type { PtyHandle } from '#shared/kernel/pty';

export interface TerminalGatewayShape {
  // PTY spawning
  spawnPty(
    command: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number
  ): Effect.Effect<PtyHandle, AgentRunnerError>;

  // Terminal chunks
  appendChunk(sessionId: string, base64: string, ts: number): void;
  getAllChunks(sessionId: string): Array<{ data: string }>;

  // Input history
  appendInput(sessionId: string, text: string, source: 'cli' | 'browser', ts: number): void;
  getInputHistory(
    sessionId: string,
    limit?: number
  ): Array<{ text: string; source: string; timestamp: number }>;

  // Broadcasting PTY output to WebSocket subscribers
  broadcastOutput(sessionId: string, base64: string): void;

  // Send message to a specific CLI client connection
  sendToCliClient(connId: string, msg: string): void;

  // Input line buffering (stateful — gateway holds the buffers)
  bufferInput(
    sessionId: string,
    base64: string,
    source: 'cli' | 'browser',
    onLine: (text: string, source: 'cli' | 'browser', ts: number) => void
  ): void;

  // Domain events
  publishEvent(event: DomainEvent): Effect.Effect<void>;
}

export class TerminalGateway extends ServiceMap.Service<TerminalGateway, TerminalGatewayShape>()(
  '@vigie/TerminalGateway'
) {}

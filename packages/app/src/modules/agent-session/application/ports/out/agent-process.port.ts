// Manages live PTY process instances: spawn/kill, I/O, and viewer channel multiplexing
// for both the vigie CLI client (attach) and browser WebSocket viewers.
import type { Effect } from 'effect';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type { SessionId } from '#shared/kernel/session/session-id';

export interface AgentProcessShape {
  // Spawn & lifecycle
  spawn(opts: {
    sessionId: SessionId;
    command: string;
    args: string[];
    cwd: string;
    cols: number;
    rows: number;
    connId?: string;
  }): Effect.Effect<{ pid: number }, AgentRunnerError>;
  kill(sessionId: SessionId): void;
  killAll(): void;
  getActivePid(sessionId: SessionId): number | null;

  // CLI viewer channels
  attach(
    sessionId: SessionId,
    connId: string,
    dims: { cols: number; rows: number }
  ): { chunks: Array<{ data: string }>; pid: number } | null;
  detach(sessionId: SessionId, connId: string): void;
  updateCliResize(sessionId: SessionId, connId: string, cols: number, rows: number): void;
  handleDisconnect(connId: string): void;

  // Browser viewer channels
  addBrowserChannel(
    sessionId: SessionId,
    connId: string,
    dims: { cols: number; rows: number }
  ): number | null;
  updateBrowserChannel(
    sessionId: SessionId,
    connId: string,
    dims: { cols: number; rows: number }
  ): void;
  removeBrowserChannel(sessionId: SessionId, connId: string): void;

  // I/O
  writeInput(sessionId: SessionId, data: string, source: 'cli' | 'browser'): void;
  writeBinaryInput(sessionId: SessionId, data: Uint8Array): void;

  // Connection tracking (prompt-mode sessions)
  trackConnection(sessionId: SessionId, connId: string): void;
  getConnId(sessionId: SessionId): string | undefined;
  clearConnection(connId: string): void;
}

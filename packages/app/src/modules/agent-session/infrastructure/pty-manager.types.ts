import type { Effect } from 'effect';
import type { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type { SessionId } from '#shared/kernel/session/session-id';

// --- Internal types (not exported from module boundary) ---

export interface PtyHandle {
  readonly pid: number;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onOutput(callback: (data: Uint8Array) => void): void;
  wait(): Promise<number>;
}

export interface PtyEntry {
  readonly handle: PtyHandle;
  cliChannels: Map<string, { cols: number; rows: number }>;
  browserChannels: Map<string, { cols: number; rows: number }>;
  ptyDimensions: { cols: number; rows: number };
}

// --- Injected spawn function ---

export type PtySpawnFn = (
  command: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number
) => Effect.Effect<PtyHandle, AgentRunnerError>;

// --- Callbacks for domain notifications ---

export interface PtyManagerCallbacks {
  onOutput(sessionId: SessionId, base64: string, ts: number): void;
  onProcessExited(sessionId: SessionId, exitCode: number): void;
  onResized(sessionId: SessionId, cols: number, rows: number): void;
  onInputEcho(sessionId: SessionId, text: string, source: 'cli' | 'browser', ts: number): void;
  sendToCliClient(connId: string, msg: string): void;
}

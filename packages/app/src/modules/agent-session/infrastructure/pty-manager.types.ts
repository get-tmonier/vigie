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

type PtySpawnFn = (
  command: string,
  args: string[],
  cwd: string,
  cols: number,
  rows: number
) => Effect.Effect<PtyHandle, AgentRunnerError>;

// --- Callbacks for domain notifications ---

interface PtyManagerCallbacks {
  onOutput(sessionId: SessionId, base64: string, ts: number): void;
  onProcessExited(sessionId: SessionId, exitCode: number): void;
  onResized(sessionId: SessionId, cols: number, rows: number): void;
  sendToCliClient(connId: string, msg: string): void;
}

// --- Public shape ---

interface PtyManagerShape {
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

  // CLI channels
  attach(
    sessionId: SessionId,
    connId: string,
    dims: { cols: number; rows: number }
  ): { chunks: Array<{ data: string }>; pid: number } | null;
  detach(sessionId: SessionId, connId: string): void;
  updateCliResize(sessionId: SessionId, connId: string, cols: number, rows: number): void;
  handleDisconnect(connId: string): void;

  // Browser channels
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

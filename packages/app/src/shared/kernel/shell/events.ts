import type { TerminalChunk } from '#shared/kernel/agent-session/events';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

export type DaemonHelloEvent = {
  readonly type: 'daemon:hello';
  readonly hostname: string;
  readonly pid: number;
  readonly version: string;
};

export type CommandOutputEvent = {
  readonly type: 'command:output';
  readonly id: string;
  readonly stream: 'stdout' | 'stderr';
  readonly data: string;
  readonly timestamp: number;
};

export type CommandDoneEvent = {
  readonly type: 'command:done';
  readonly id: string;
  readonly exitCode: number;
  readonly timestamp: number;
};

export type CommandErrorEvent = {
  readonly type: 'command:error';
  readonly id: string;
  readonly error: string;
  readonly timestamp: number;
};

export type PongEvent = {
  readonly type: 'pong';
};

export type FsListDirResponseEvent = {
  readonly type: 'fs:list-dir-response';
  readonly requestId: string;
  readonly entries: Array<{ readonly name: string; readonly isDirectory: boolean }>;
  readonly error?: string;
};

export type DaemonSyncSession = {
  readonly sessionId: string;
  readonly agentType: string;
  readonly mode: 'prompt' | 'interactive';
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly repoName?: string;
  readonly startedAt: number;
  readonly status: 'active' | 'ended' | 'error';
  readonly exitCode?: number;
  readonly agentSessionId?: string;
  readonly resumable: boolean;
  readonly terminalChunks: TerminalChunk[];
  readonly inputHistory?: Array<{
    readonly text: string;
    readonly source: 'cli' | 'browser';
    readonly timestamp: number;
  }>;
};

export type DaemonSyncEvent = {
  readonly type: 'daemon:sync';
  readonly sessions: DaemonSyncSession[];
};

export type SessionOutputEvent = {
  readonly type: 'session:output';
  readonly sessionId: SessionId;
  readonly data: string;
  readonly chunkType: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error';
  readonly timestamp: number;
};

export type SessionSpawnFailedEvent = {
  readonly type: 'session:spawn-failed';
  readonly sessionId: SessionId;
  readonly error: string;
  readonly timestamp: number;
};

export type ShellEvent =
  | DaemonHelloEvent
  | CommandOutputEvent
  | CommandDoneEvent
  | CommandErrorEvent
  | PongEvent
  | FsListDirResponseEvent
  | DaemonSyncEvent
  | SessionOutputEvent
  | SessionSpawnFailedEvent;

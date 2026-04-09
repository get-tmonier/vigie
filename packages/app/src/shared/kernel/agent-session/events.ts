import type { SessionId } from '#shared/kernel/agent-session/session-id';

export type SessionStarted = {
  readonly type: 'session:started';
  readonly sessionId: SessionId;
  readonly agentType: string;
  readonly mode: 'prompt' | 'interactive';
  readonly cwd: string;
  readonly gitBranch?: string;
  readonly repoName?: string;
  readonly timestamp: number;
};

export type SessionEnded = {
  readonly type: 'session:ended';
  readonly sessionId: SessionId;
  readonly exitCode: number;
  readonly resumable: boolean;
  readonly timestamp: number;
};

export type SessionError = {
  readonly type: 'session:error';
  readonly sessionId: SessionId;
  readonly error: string;
  readonly timestamp: number;
};

export type SessionDeleted = {
  readonly type: 'session:deleted';
  readonly sessionId: SessionId;
  readonly timestamp: number;
};

export type SessionsCleared = {
  readonly type: 'sessions:cleared';
  readonly timestamp: number;
};

export type AgentSessionIdDetected = {
  readonly type: 'session:agent-id-detected';
  readonly sessionId: SessionId;
  readonly agentSessionId: string;
  readonly timestamp: number;
};

export type ResumableChanged = {
  readonly type: 'session:resumable-changed';
  readonly sessionId: SessionId;
  readonly resumable: boolean;
  readonly timestamp: number;
};

export type SessionLifecycleEvent =
  | SessionStarted
  | SessionEnded
  | SessionError
  | SessionDeleted
  | SessionsCleared
  | AgentSessionIdDetected
  | ResumableChanged;

export type TerminalOutputEvent = {
  readonly type: 'terminal:output';
  readonly sessionId: string;
  readonly data: string;
  readonly timestamp: number;
};

export type TerminalInputEchoEvent = {
  readonly type: 'terminal:input-echo';
  readonly sessionId: string;
  readonly text: string;
  readonly source: 'cli' | 'browser';
  readonly timestamp: number;
};

export type TerminalResizedEvent = {
  readonly type: 'terminal:pty-resized';
  readonly sessionId: string;
  readonly cols: number;
  readonly rows: number;
};

export type TerminalChunk = {
  readonly data: string;
  readonly timestamp: number;
  readonly seq: number;
};

export type SessionEvent =
  | SessionLifecycleEvent
  | TerminalOutputEvent
  | TerminalInputEchoEvent
  | TerminalResizedEvent;

import type { SessionId } from './session-id';

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

export type SessionDomainEvent =
  | SessionStarted
  | SessionEnded
  | SessionError
  | SessionDeleted
  | SessionsCleared
  | AgentSessionIdDetected
  | ResumableChanged;

import type { Effect } from 'effect';
import type { AgentRunnerError } from '#shared/kernel/errors';
import type { SessionId } from '#shared/kernel/session-id';

export interface SpawnResult {
  sessionId: SessionId;
  pid: number;
}

export interface AttachResult {
  chunks: Array<{ data: string }>;
  pid: number;
}

export interface SessionCommandShape {
  register(props: {
    sessionId: string;
    agentType: string;
    cwd: string;
    mode?: 'prompt' | 'interactive';
    gitBranch?: string;
    gitRemoteUrl?: string;
    repoName?: string;
    connId: string;
  }): void;

  spawnInteractive(props: {
    sessionId?: string;
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
    connId?: string;
    agentSessionId?: string;
    resume?: boolean;
    gitBranch?: string;
    repoName?: string;
  }): Effect.Effect<SpawnResult, AgentRunnerError>;

  resume(
    sessionId: SessionId,
    opts: {
      cols: number;
      rows: number;
      connId?: string;
      gitBranch?: string;
      repoName?: string;
    }
  ): Effect.Effect<SpawnResult, AgentRunnerError | Error>;

  kill(sessionId: SessionId): void;
  markEnded(sessionId: SessionId, exitCode: number): void;
  markError(sessionId: SessionId, error: string): void;
  setAgentSessionId(sessionId: SessionId, agentSessionId: string): void;
  deregister(sessionId: SessionId): void;

  attach(
    sessionId: SessionId,
    connId: string,
    dims: { cols: number; rows: number }
  ): AttachResult | null;

  detach(sessionId: SessionId, connId: string): void;
  updateCliResize(sessionId: string, connId: string, cols: number, rows: number): void;
  writeInput(sessionId: string, data: string, source: 'cli' | 'browser'): void;
  applyResizePriority(sessionId: string): { cols: number; rows: number } | null;
}

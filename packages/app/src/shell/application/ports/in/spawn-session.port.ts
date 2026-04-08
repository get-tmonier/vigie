import type { Effect } from 'effect';

export interface SpawnResult {
  sessionId: string;
  pid: number;
}

export interface SpawnSessionShape {
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
  }): Effect.Effect<SpawnResult, Error>;

  resume(
    sessionId: string,
    opts: { cols: number; rows: number; connId?: string; gitBranch?: string; repoName?: string }
  ): Effect.Effect<SpawnResult, Error>;
}

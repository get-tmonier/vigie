import type { Effect } from 'effect';
import type { AgentConfig } from '#modules/session/domain/agent-config';
import type { AgentRunnerError } from '#modules/session/domain/errors';

export interface PtyHandle {
  readonly pid: number;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onOutput(callback: (data: Uint8Array) => void): void;
  wait(): Promise<number>;
}

export interface SpawnOpts {
  readonly resume?: boolean;
  readonly claudeSessionId?: string;
}

export interface PtySpawner {
  spawn(
    agent: AgentConfig,
    cwd: string,
    cols: number,
    rows: number,
    opts?: SpawnOpts
  ): Effect.Effect<PtyHandle, AgentRunnerError>;
}

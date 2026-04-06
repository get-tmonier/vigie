import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { AgentRunnerError } from '#modules/session/domain/errors';

export interface PtyHandle {
  readonly pid: number;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  kill(): void;
  onOutput(callback: (data: Uint8Array) => void): void;
  wait(): Promise<number>;
}

export interface PtySpawnerShape {
  spawn(
    command: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number
  ): Effect.Effect<PtyHandle, AgentRunnerError>;
}

export class PtySpawner extends ServiceMap.Service<PtySpawner, PtySpawnerShape>()(
  '@vigie/PtySpawner'
) {}

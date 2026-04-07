import type { Effect } from 'effect';
import { ServiceMap } from 'effect';
import type { AgentRunnerError } from '#shared/kernel/errors';
import type { PtyHandle } from '#shared/kernel/pty';

export type { PtyHandle } from '#shared/kernel/pty';

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

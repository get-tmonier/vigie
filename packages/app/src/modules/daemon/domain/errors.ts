import { Data } from 'effect';

export { DaemonNotRunningError } from '#shared/kernel/errors';

export class DaemonAlreadyRunningError extends Data.TaggedError('DaemonAlreadyRunningError')<{
  readonly pid: number;
}> {}

export class DaemonStartError extends Data.TaggedError('DaemonStartError')<{
  readonly message: string;
}> {}

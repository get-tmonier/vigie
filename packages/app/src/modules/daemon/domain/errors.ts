import { Data } from 'effect';

export class DaemonNotRunningError extends Data.TaggedError('DaemonNotRunningError')<{
  readonly message: string;
}> {}

export class DaemonAlreadyRunningError extends Data.TaggedError('DaemonAlreadyRunningError')<{
  readonly pid: number;
}> {}

export class DaemonStartError extends Data.TaggedError('DaemonStartError')<{
  readonly message: string;
}> {}

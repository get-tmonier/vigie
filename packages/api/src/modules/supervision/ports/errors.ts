import { Data } from 'effect';

export class DaemonNotFoundError extends Data.TaggedError('DaemonNotFoundError')<{
  readonly id: string;
}> {}

export class DaemonDisconnectedError extends Data.TaggedError('DaemonDisconnectedError')<{
  readonly id: string;
}> {}

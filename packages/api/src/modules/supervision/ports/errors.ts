import { Data } from 'effect';

export class DaemonNotFoundError extends Data.TaggedError('DaemonNotFoundError')<{
  readonly id: string;
}> {}

export class DaemonDisconnectedError extends Data.TaggedError('DaemonDisconnectedError')<{
  readonly id: string;
}> {}

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly id: string;
}> {}

export class SessionStillActiveError extends Data.TaggedError('SessionStillActiveError')<{
  readonly id: string;
}> {}

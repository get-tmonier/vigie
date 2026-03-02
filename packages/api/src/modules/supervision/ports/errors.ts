import { Data } from 'effect';

export class DaemonNotFoundError extends Data.TaggedError('DaemonNotFoundError')<{
  readonly id: string;
}> {}

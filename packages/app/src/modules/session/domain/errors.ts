import { Data } from 'effect';

export class AgentRunnerError extends Data.TaggedError('AgentRunnerError')<{
  readonly message: string;
}> {}

export class IpcConnectionError extends Data.TaggedError('IpcConnectionError')<{
  readonly message: string;
}> {}

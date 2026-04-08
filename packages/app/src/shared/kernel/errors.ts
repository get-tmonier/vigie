import { Data } from 'effect';

export class AgentRunnerError extends Data.TaggedError('AgentRunnerError')<{
  readonly message: string;
}> {}

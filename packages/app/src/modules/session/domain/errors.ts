import { Data } from 'effect';

export class AgentRunnerError extends Data.TaggedError('AgentRunnerError')<{
  readonly message: string;
}> {}

export class IpcConnectionError extends Data.TaggedError('IpcConnectionError')<{
  readonly message: string;
}> {}

export class SessionNotFoundError extends Error {
  readonly _tag = 'SessionNotFoundError';
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`);
  }
}

export class InvalidStatusTransitionError extends Error {
  readonly _tag = 'InvalidStatusTransitionError';
  constructor(from: string, to: string) {
    super(`Cannot transition session from '${from}' to '${to}'`);
  }
}

export class CannotDeleteActiveSessionError extends Error {
  readonly _tag = 'CannotDeleteActiveSessionError';
  constructor(sessionId: string) {
    super(`Cannot delete active session: ${sessionId}`);
  }
}

export class CannotResumeSessionError extends Error {
  readonly _tag = 'CannotResumeSessionError';
  constructor(sessionId: string, reason: string) {
    super(`Cannot resume session ${sessionId}: ${reason}`);
  }
}

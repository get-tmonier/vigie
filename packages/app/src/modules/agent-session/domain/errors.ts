import { Data } from 'effect';

export { AgentRunnerError } from '#shared/kernel/errors';

export class SessionNotFoundError extends Data.TaggedError('SessionNotFoundError')<{
  readonly sessionId: string;
}> {
  constructor(sessionId: string) {
    super({ sessionId });
  }
  override get message(): string {
    return `Session not found: ${this.sessionId}`;
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

export class CannotResumeSessionError extends Data.TaggedError('CannotResumeSessionError')<{
  readonly sessionId: string;
  readonly reason: string;
}> {
  constructor(sessionId: string, reason: string) {
    super({ sessionId, reason });
  }
  override get message(): string {
    return `Cannot resume session ${this.sessionId}: ${this.reason}`;
  }
}

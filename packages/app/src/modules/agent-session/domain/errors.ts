import { Data } from 'effect';
import type { SessionStatus } from '#modules/agent-session/domain/session-status';

export class AgentRunnerError extends Data.TaggedError('AgentRunnerError')<{
  readonly message: string;
}> {}

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

export class InvalidStatusTransitionError extends Data.TaggedError('InvalidStatusTransitionError')<{
  readonly from: SessionStatus;
  readonly to: SessionStatus;
}> {
  override get message(): string {
    return `Cannot transition session from '${this.from}' to '${this.to}'`;
  }
}

export class CannotDeleteActiveSessionError extends Data.TaggedError(
  'CannotDeleteActiveSessionError'
)<{
  readonly sessionId: string;
}> {
  override get message(): string {
    return `Cannot delete active session: ${this.sessionId}`;
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

import { describe, expect, it } from 'bun:test';
import {
  CannotDeleteActiveSessionError,
  CannotResumeSessionError,
  InvalidStatusTransitionError,
  SessionNotFoundError,
} from '#modules/agent-session/domain/errors';

describe('SessionNotFoundError', () => {
  it('has correct _tag', () => {
    const err = new SessionNotFoundError('session-1');
    expect(err._tag).toBe('SessionNotFoundError');
  });

  it('carries sessionId', () => {
    const err = new SessionNotFoundError('session-1');
    expect(err.sessionId).toBe('session-1');
  });

  it('has descriptive message', () => {
    const err = new SessionNotFoundError('session-1');
    expect(err.message).toContain('session-1');
  });
});

describe('InvalidStatusTransitionError', () => {
  it('has correct _tag', () => {
    const err = new InvalidStatusTransitionError('active', 'registering');
    expect(err._tag).toBe('InvalidStatusTransitionError');
  });

  it('is an instance of Error', () => {
    const err = new InvalidStatusTransitionError('active', 'registering');
    expect(err).toBeInstanceOf(Error);
  });

  it('message contains from and to states', () => {
    const err = new InvalidStatusTransitionError('active', 'registering');
    expect(err.message).toContain('active');
    expect(err.message).toContain('registering');
  });
});

describe('CannotDeleteActiveSessionError', () => {
  it('has correct _tag', () => {
    const err = new CannotDeleteActiveSessionError('session-1');
    expect(err._tag).toBe('CannotDeleteActiveSessionError');
  });

  it('is an instance of Error', () => {
    const err = new CannotDeleteActiveSessionError('session-1');
    expect(err).toBeInstanceOf(Error);
  });

  it('message contains sessionId', () => {
    const err = new CannotDeleteActiveSessionError('session-1');
    expect(err.message).toContain('session-1');
  });
});

describe('CannotResumeSessionError', () => {
  it('has correct _tag', () => {
    const err = new CannotResumeSessionError('session-1', 'not resumable');
    expect(err._tag).toBe('CannotResumeSessionError');
  });

  it('carries sessionId and reason', () => {
    const err = new CannotResumeSessionError('session-1', 'not resumable');
    expect(err.sessionId).toBe('session-1');
    expect(err.reason).toBe('not resumable');
  });

  it('has descriptive message', () => {
    const err = new CannotResumeSessionError('session-1', 'not resumable');
    expect(err.message).toContain('session-1');
    expect(err.message).toContain('not resumable');
  });
});

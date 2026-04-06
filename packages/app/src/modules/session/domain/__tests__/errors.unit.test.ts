import { describe, expect, it } from 'bun:test';
import {
  AgentRunnerError,
  CannotDeleteActiveSessionError,
  CannotResumeSessionError,
  InvalidStatusTransitionError,
  IpcConnectionError,
  SessionNotFoundError,
} from '../errors';

describe('errors', () => {
  describe('AgentRunnerError', () => {
    it('has correct _tag and is an Error', () => {
      const err = new AgentRunnerError({ message: 'agent failed' });
      expect(err._tag).toBe('AgentRunnerError');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('IpcConnectionError', () => {
    it('has correct _tag and is an Error', () => {
      const err = new IpcConnectionError({ message: 'connection refused' });
      expect(err._tag).toBe('IpcConnectionError');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('SessionNotFoundError', () => {
    it('has correct _tag and message contains sessionId', () => {
      const err = new SessionNotFoundError('session-abc');
      expect(err._tag).toBe('SessionNotFoundError');
      expect(err.message).toContain('session-abc');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('InvalidStatusTransitionError', () => {
    it('has correct _tag and message contains from/to states', () => {
      const err = new InvalidStatusTransitionError('active', 'active');
      expect(err._tag).toBe('InvalidStatusTransitionError');
      expect(err.message).toContain('active');
      expect(err).toBeInstanceOf(Error);
    });

    it('message includes both from and to', () => {
      const err = new InvalidStatusTransitionError('error', 'active');
      expect(err.message).toContain('error');
      expect(err.message).toContain('active');
    });
  });

  describe('CannotDeleteActiveSessionError', () => {
    it('has correct _tag and message contains sessionId', () => {
      const err = new CannotDeleteActiveSessionError('sess-xyz');
      expect(err._tag).toBe('CannotDeleteActiveSessionError');
      expect(err.message).toContain('sess-xyz');
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe('CannotResumeSessionError', () => {
    it('has correct _tag and message contains sessionId and reason', () => {
      const err = new CannotResumeSessionError('sess-xyz', 'no Claude session ID');
      expect(err._tag).toBe('CannotResumeSessionError');
      expect(err.message).toContain('sess-xyz');
      expect(err.message).toContain('no Claude session ID');
      expect(err).toBeInstanceOf(Error);
    });
  });
});

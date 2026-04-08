import { describe, expect, it } from 'bun:test';
import { canTransition, type SessionStatus } from '#modules/agent-session/domain/session-status';

describe('canTransition', () => {
  const allStatuses: SessionStatus[] = ['registering', 'active', 'ended', 'error'];

  it('registering → active is valid', () => {
    expect(canTransition('registering', 'active')).toBe(true);
  });

  it('registering → ended is valid', () => {
    expect(canTransition('registering', 'ended')).toBe(true);
  });

  it('registering → error is valid', () => {
    expect(canTransition('registering', 'error')).toBe(true);
  });

  it('registering → registering is invalid', () => {
    expect(canTransition('registering', 'registering')).toBe(false);
  });

  it('active → ended is valid', () => {
    expect(canTransition('active', 'ended')).toBe(true);
  });

  it('active → error is valid', () => {
    expect(canTransition('active', 'error')).toBe(true);
  });

  it('active → active is invalid', () => {
    expect(canTransition('active', 'active')).toBe(false);
  });

  it('active → registering is invalid', () => {
    expect(canTransition('active', 'registering')).toBe(false);
  });

  it('ended → active is valid (resume)', () => {
    expect(canTransition('ended', 'active')).toBe(true);
  });

  it('ended → ended is invalid', () => {
    expect(canTransition('ended', 'ended')).toBe(false);
  });

  it('ended → error is invalid', () => {
    expect(canTransition('ended', 'error')).toBe(false);
  });

  it('ended → registering is invalid', () => {
    expect(canTransition('ended', 'registering')).toBe(false);
  });

  it('error → any status is invalid', () => {
    for (const to of allStatuses) {
      expect(canTransition('error', to)).toBe(false);
    }
  });
});

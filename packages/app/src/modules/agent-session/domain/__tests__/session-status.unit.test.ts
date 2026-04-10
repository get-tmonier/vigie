import { describe, expect, it } from 'bun:test';
import { canTransition, type SessionStatus } from '#modules/agent-session/domain/session-status';

describe('canTransition', () => {
  const allStatuses: SessionStatus[] = [
    'registering',
    'active',
    'paused',
    'ended',
    'error',
    'abandoned',
    'killed',
    'archived',
  ];

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

  it('active → paused is valid', () => {
    expect(canTransition('active', 'paused')).toBe(true);
  });

  it('active → abandoned is valid', () => {
    expect(canTransition('active', 'abandoned')).toBe(true);
  });

  it('active → killed is valid', () => {
    expect(canTransition('active', 'killed')).toBe(true);
  });

  it('active → active is invalid', () => {
    expect(canTransition('active', 'active')).toBe(false);
  });

  it('active → registering is invalid', () => {
    expect(canTransition('active', 'registering')).toBe(false);
  });

  it('paused → active is valid (resume)', () => {
    expect(canTransition('paused', 'active')).toBe(true);
  });

  it('paused → ended is valid', () => {
    expect(canTransition('paused', 'ended')).toBe(true);
  });

  it('paused → abandoned is valid', () => {
    expect(canTransition('paused', 'abandoned')).toBe(true);
  });

  it('paused → killed is valid', () => {
    expect(canTransition('paused', 'killed')).toBe(true);
  });

  it('ended → active is valid (resume)', () => {
    expect(canTransition('ended', 'active')).toBe(true);
  });

  it('ended → archived is valid', () => {
    expect(canTransition('ended', 'archived')).toBe(true);
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

  it('error → archived is valid', () => {
    expect(canTransition('error', 'archived')).toBe(true);
  });

  it('error → non-archived statuses are invalid', () => {
    const nonArchived = allStatuses.filter((s) => s !== 'archived');
    for (const to of nonArchived) {
      expect(canTransition('error', to)).toBe(false);
    }
  });

  it('abandoned → archived is valid', () => {
    expect(canTransition('abandoned', 'archived')).toBe(true);
  });

  it('killed → archived is valid', () => {
    expect(canTransition('killed', 'archived')).toBe(true);
  });

  it('archived → active is invalid', () => {
    expect(canTransition('archived', 'active')).toBe(false);
  });

  it('archived → any status is invalid', () => {
    for (const to of allStatuses) {
      expect(canTransition('archived', to)).toBe(false);
    }
  });
});

import { describe, expect, it } from 'bun:test';
import {
  CannotDeleteActiveSessionError,
  InvalidStatusTransitionError,
} from '#modules/agent-session/domain/errors';
import { Session } from '#modules/agent-session/domain/session';
import type { AgentType } from '#shared/kernel/agent-session/agent-type';
import { SessionId as makeSessionId } from '#shared/kernel/agent-session/session-id';

function makeActiveSession(overrides?: { agentType?: AgentType; cwd?: string }) {
  return Session.create({
    agentType: overrides?.agentType ?? 'claude',
    cwd: overrides?.cwd ?? '/tmp',
  });
}

describe('Session.create', () => {
  it('starts in active status', () => {
    const session = makeActiveSession();
    expect(session.status).toBe('active');
  });

  it('emits session:started event on creation', () => {
    const session = makeActiveSession();
    const events = session.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:started');
  });

  it('defaults mode to prompt', () => {
    const session = makeActiveSession();
    expect(session.mode).toBe('prompt');
  });

  it('uses provided id', () => {
    const session = Session.create({ id: 'my-id', agentType: 'claude', cwd: '/tmp' });
    expect(session.id).toBe(makeSessionId('my-id'));
  });
});

describe('Session state transitions', () => {
  it('active → ended via markEnded', () => {
    const session = makeActiveSession();
    session.pullEvents(); // drain create event
    session.markEnded(0, false);
    expect(session.status).toBe('ended');
  });

  it('active → error via markError', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markError('something went wrong');
    expect(session.status).toBe('error');
    const events = session.pullEvents();
    expect(events.some((e) => e.type === 'session:error')).toBe(true);
  });

  it('ended → active via reactivate', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.markEnded(0, true);
    session.pullEvents();
    session.reactivate();
    expect(session.status).toBe('active');
  });

  it('throws InvalidStatusTransitionError on invalid transition active → active', () => {
    const session = makeActiveSession();
    expect(() => session.markActive()).toThrow(InvalidStatusTransitionError);
  });

  it('throws InvalidStatusTransitionError on invalid transition error → ended', () => {
    const session = makeActiveSession();
    session.markError('err');
    expect(() => session.markEnded(0, false)).toThrow(InvalidStatusTransitionError);
  });

  it('throws InvalidStatusTransitionError on invalid transition ended → error', () => {
    const session = makeActiveSession();
    session.markEnded(0, false);
    expect(() => session.markError('err')).toThrow(InvalidStatusTransitionError);
  });
});

describe('Session.pullEvents', () => {
  it('drains all accumulated events', () => {
    const session = makeActiveSession();
    session.markEnded(0, false);
    const events = session.pullEvents();
    // session:started + session:ended
    expect(events.length).toBeGreaterThanOrEqual(2);
    const types = events.map((e) => e.type);
    expect(types).toContain('session:started');
    expect(types).toContain('session:ended');
  });

  it('returns empty array on second call', () => {
    const session = makeActiveSession();
    session.pullEvents(); // first drain
    const second = session.pullEvents();
    expect(second).toHaveLength(0);
  });

  it('accumulates events across multiple operations', () => {
    const session = makeActiveSession();
    session.setAgentSessionId('agent-abc');
    session.markEnded(1, true);
    const events = session.pullEvents();
    const types = events.map((e) => e.type);
    expect(types).toContain('session:started');
    expect(types).toContain('session:agent-id-detected');
    expect(types).toContain('session:ended');
  });
});

describe('Session.canResume', () => {
  it('is false when status is active', () => {
    const session = makeActiveSession();
    session.setAgentSessionId('abc');
    session.pullEvents();
    expect(session.canResume).toBe(false);
  });

  it('is false when ended but not resumable', () => {
    const session = makeActiveSession();
    session.setAgentSessionId('abc');
    session.markEnded(0, false);
    expect(session.canResume).toBe(false);
  });

  it('is false when ended and resumable but no agentSessionId', () => {
    const session = makeActiveSession();
    session.markEnded(0, true);
    expect(session.canResume).toBe(false);
  });

  it('is true when ended, resumable, and agentSessionId set', () => {
    const session = makeActiveSession();
    session.setAgentSessionId('abc');
    session.markEnded(0, true);
    expect(session.canResume).toBe(true);
  });

  it('is false when status is error', () => {
    const session = makeActiveSession();
    session.setAgentSessionId('abc');
    session.markError('fail');
    expect(session.canResume).toBe(false);
  });
});

describe('Session.setResumable', () => {
  it('emits session:resumable-changed when value changes from false to true', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.setResumable(true);
    const events = session.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:resumable-changed');
  });

  it('does not emit event when value does not change', () => {
    const session = makeActiveSession();
    session.pullEvents();
    // default resumable is false
    session.setResumable(false);
    const events = session.pullEvents();
    expect(events).toHaveLength(0);
  });

  it('emits session:resumable-changed when value changes from true to false', () => {
    const session = makeActiveSession();
    session.pullEvents();
    session.setResumable(true);
    session.pullEvents();
    session.setResumable(false);
    const events = session.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:resumable-changed');
  });
});

describe('Session.delete', () => {
  it('emits session:deleted event from ended status', () => {
    const session = makeActiveSession();
    session.markEnded(0, false);
    session.pullEvents();
    session.delete();
    const events = session.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:deleted');
  });

  it('emits session:deleted event from error status', () => {
    const session = makeActiveSession();
    session.markError('err');
    session.pullEvents();
    session.delete();
    const events = session.pullEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('session:deleted');
  });

  it('throws CannotDeleteActiveSessionError from active status', () => {
    const session = makeActiveSession();
    expect(() => session.delete()).toThrow(CannotDeleteActiveSessionError);
  });

  it('canDelete is false when active', () => {
    const session = makeActiveSession();
    expect(session.canDelete).toBe(false);
  });

  it('canDelete is true when ended', () => {
    const session = makeActiveSession();
    session.markEnded(0, false);
    expect(session.canDelete).toBe(true);
  });

  it('canDelete is true when error', () => {
    const session = makeActiveSession();
    session.markError('err');
    expect(session.canDelete).toBe(true);
  });
});

describe('Session.reactivate', () => {
  it('clears endedAt and exitCode', () => {
    const session = makeActiveSession();
    session.markEnded(1, true);
    session.pullEvents();
    session.reactivate();
    expect(session.endedAt).toBeUndefined();
    expect(session.exitCode).toBeUndefined();
  });

  it('emits session:started event', () => {
    const session = makeActiveSession();
    session.markEnded(0, true);
    session.pullEvents();
    session.reactivate();
    const events = session.pullEvents();
    expect(events.some((e) => e.type === 'session:started')).toBe(true);
  });
});

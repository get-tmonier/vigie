import { beforeEach, describe, expect, it } from 'bun:test';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { $selectedId, $sessions } from '../store';
import { applyWsMessage } from '../ws-sync';

const session = (id: string, status: AgentSession['status'] = 'active'): AgentSession => ({
  id,
  agentType: 'claude',
  mode: 'interactive',
  cwd: '/tmp',
  startedAt: 0,
  status,
  resumable: false,
});

beforeEach(() => {
  $sessions.set([]);
  $selectedId.set(null);
});

describe('applyWsMessage', () => {
  it('snapshot: sets sessions and preserves valid selectedId', () => {
    const sessions = [session('a'), session('b')];
    $selectedId.set('a');
    applyWsMessage(JSON.stringify({ type: 'snapshot', sessions }));
    expect($sessions.get()).toEqual(sessions);
    expect($selectedId.get()).toBe('a');
  });

  it('snapshot: re-selects when current selectedId no longer present', () => {
    $selectedId.set('a');
    applyWsMessage(JSON.stringify({ type: 'snapshot', sessions: [session('b')] }));
    expect($selectedId.get()).toBe('b');
  });

  it('session:ended: marks session ended with exitCode and resumable', () => {
    $sessions.set([session('a')]);
    applyWsMessage(
      JSON.stringify({ type: 'session:ended', sessionId: 'a', exitCode: 0, resumable: true })
    );
    const s = $sessions.get().find((s) => s.id === 'a');
    expect(s).toBeDefined();
    if (!s) return;
    expect(s.status).toBe('ended');
    expect(s.exitCode).toBe(0);
    expect(s.resumable).toBe(true);
  });

  it('session:deleted: removes session and re-selects', () => {
    $sessions.set([session('a'), session('b')]);
    $selectedId.set('a');
    applyWsMessage(JSON.stringify({ type: 'session:deleted', sessionId: 'a' }));
    expect($sessions.get().find((s) => s.id === 'a')).toBeUndefined();
    expect($selectedId.get()).toBe('b');
  });

  it('sessions:cleared: removes ended sessions and re-selects if needed', () => {
    $sessions.set([session('a', 'active'), session('b', 'ended')]);
    $selectedId.set('b');
    applyWsMessage(JSON.stringify({ type: 'sessions:cleared' }));
    expect($sessions.get()).toEqual([session('a', 'active')]);
    expect($selectedId.get()).toBe('a');
  });

  it('sessions:cleared: preserves selectedId if session is still active', () => {
    $sessions.set([session('a', 'active'), session('b', 'ended')]);
    $selectedId.set('a');
    applyWsMessage(JSON.stringify({ type: 'sessions:cleared' }));
    expect($selectedId.get()).toBe('a');
  });

  it('session:resumable-changed: updates resumable field', () => {
    $sessions.set([session('a')]);
    applyWsMessage(
      JSON.stringify({ type: 'session:resumable-changed', sessionId: 'a', resumable: true })
    );
    expect($sessions.get().find((s) => s.id === 'a')?.resumable).toBe(true);
  });

  it('ignores malformed JSON silently', () => {
    $sessions.set([session('a')]);
    applyWsMessage('not json');
    expect($sessions.get()).toEqual([session('a')]);
  });
});

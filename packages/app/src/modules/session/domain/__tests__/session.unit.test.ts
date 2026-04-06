import { describe, expect, it } from 'bun:test';
import { CannotDeleteActiveSessionError, InvalidStatusTransitionError } from '../errors';
import { Session } from '../session';
import { SessionId } from '../session-id';

describe('Session', () => {
  describe('create', () => {
    it('creates with status active and default mode prompt', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(s.status).toBe('active');
      expect(s.mode).toBe('prompt');
    });

    it('uses provided id', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp', id: 'my-id' });
      expect(s.id).toBe(SessionId('my-id'));
    });

    it('generates uuid when no id provided', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('emits a single session:started event', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp', mode: 'interactive' });
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:started');
      if (events[0].type === 'session:started') {
        expect(events[0].agentType).toBe('claude');
        expect(events[0].mode).toBe('interactive');
      }
    });

    it('sets all provided properties', () => {
      const s = Session.create({
        agentType: 'aider',
        cwd: '/home/user/project',
        gitBranch: 'main',
        repoName: 'my-repo',
        mode: 'prompt',
      });
      expect(s.agentType).toBe('aider');
      expect(s.cwd).toBe('/home/user/project');
      expect(s.gitBranch).toBe('main');
      expect(s.repoName).toBe('my-repo');
    });
  });

  describe('reconstitute', () => {
    it('round-trips all properties without emitting events', () => {
      const now = Date.now();
      const s = Session.reconstitute({
        id: 'abc',
        agentType: 'claude',
        cwd: '/tmp',
        gitBranch: 'feat/x',
        startedAt: now - 5000,
        endedAt: now,
        status: 'ended',
        exitCode: 0,
        claudeSessionId: 'claude-123',
        resumable: true,
        mode: 'interactive',
      });
      expect(s.id).toBe(SessionId('abc'));
      expect(s.status).toBe('ended');
      expect(s.exitCode).toBe(0);
      expect(s.claudeSessionId).toBe('claude-123');
      expect(s.resumable).toBe(true);
      expect(s.endedAt).toBe(now);
      expect(s.pullEvents()).toHaveLength(0);
    });
  });

  describe('markEnded', () => {
    it('transitions to ended with correct properties and emits session:ended', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.pullEvents();
      s.markEnded(0, true);
      expect(s.status).toBe('ended');
      expect(s.exitCode).toBe(0);
      expect(s.resumable).toBe(true);
      expect(s.endedAt).toBeDefined();
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:ended');
      if (events[0].type === 'session:ended') {
        expect(events[0].exitCode).toBe(0);
        expect(events[0].resumable).toBe(true);
      }
    });

    it('throws InvalidStatusTransitionError when called on ended session', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: false,
      });
      expect(() => s.markEnded(0, false)).toThrow(InvalidStatusTransitionError);
    });

    it('throws InvalidStatusTransitionError when called on error session', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'error',
        resumable: false,
      });
      expect(() => s.markEnded(0, false)).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('markError', () => {
    it('transitions to error with exitCode=-1 and emits session:error', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.pullEvents();
      s.markError('something broke');
      expect(s.status).toBe('error');
      expect(s.exitCode).toBe(-1);
      expect(s.resumable).toBe(false);
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:error');
      if (events[0].type === 'session:error') {
        expect(events[0].error).toBe('something broke');
      }
    });

    it('throws InvalidStatusTransitionError when called on error session', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'error',
        resumable: false,
      });
      expect(() => s.markError('again')).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('reactivate', () => {
    it('transitions ended session to active and clears endedAt/exitCode', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now() - 1000,
        endedAt: Date.now(),
        status: 'ended',
        exitCode: 0,
        resumable: true,
        claudeSessionId: 'cid',
      });
      s.reactivate();
      expect(s.status).toBe('active');
      expect(s.endedAt).toBeUndefined();
      expect(s.exitCode).toBeUndefined();
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:started');
    });

    it('throws InvalidStatusTransitionError when called on active session', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(() => s.reactivate()).toThrow(InvalidStatusTransitionError);
    });
  });

  describe('pullEvents', () => {
    it('returns events then clears on second call', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      const first = s.pullEvents();
      expect(first).toHaveLength(1);
      const second = s.pullEvents();
      expect(second).toHaveLength(0);
    });

    it('accumulates events from multiple operations', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.setClaudeSessionId('cid');
      s.markEnded(0, true);
      const events = s.pullEvents();
      expect(events.map((e) => e.type)).toEqual([
        'session:started',
        'session:claude-id-detected',
        'session:ended',
      ]);
    });
  });

  describe('canResume', () => {
    it('is true only when ended + resumable + claudeSessionId set', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: true,
        claudeSessionId: 'cid',
      });
      expect(s.canResume).toBe(true);
    });

    it('is false when ended but not resumable', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: false,
        claudeSessionId: 'cid',
      });
      expect(s.canResume).toBe(false);
    });

    it('is false when ended + resumable but no claudeSessionId', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: true,
      });
      expect(s.canResume).toBe(false);
    });

    it('is false when active', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(s.canResume).toBe(false);
    });
  });

  describe('canDelete', () => {
    it('is true when ended', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: false,
      });
      expect(s.canDelete).toBe(true);
    });

    it('is true when error', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'error',
        resumable: false,
      });
      expect(s.canDelete).toBe(true);
    });

    it('is false when active', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(s.canDelete).toBe(false);
    });
  });

  describe('setClaudeSessionId', () => {
    it('stores the id and emits session:claude-id-detected', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.pullEvents();
      s.setClaudeSessionId('my-claude-id');
      expect(s.claudeSessionId).toBe('my-claude-id');
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:claude-id-detected');
    });
  });

  describe('setResumable', () => {
    it('emits session:resumable-changed when value changes', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.pullEvents();
      s.setResumable(true);
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:resumable-changed');
    });

    it('does not emit when value is unchanged', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      s.pullEvents();
      s.setResumable(false); // already false
      expect(s.pullEvents()).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('emits session:deleted for non-active session', () => {
      const s = Session.reconstitute({
        id: 'x',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'ended',
        resumable: false,
      });
      s.delete();
      const events = s.pullEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('session:deleted');
    });

    it('throws CannotDeleteActiveSessionError for active session', () => {
      const s = Session.create({ agentType: 'claude', cwd: '/tmp' });
      expect(() => s.delete()).toThrow(CannotDeleteActiveSessionError);
    });
  });
});

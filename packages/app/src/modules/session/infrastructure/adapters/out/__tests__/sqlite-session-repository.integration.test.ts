import type { Database } from 'bun:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { openDatabase } from '#infra/database';
import { Session } from '#modules/session/domain/session';
import { SessionId } from '#shared/kernel/session-id';
import { createSqliteSessionRepository } from '../sqlite-session-repository';

let db: Database;

beforeEach(() => {
  db = openDatabase(':memory:');
});

afterEach(() => {
  db.close();
});

function makeActiveSession(
  id: string,
  overrides: { agentType?: string; agentSessionId?: string } = {}
) {
  const s = Session.create({ agentType: overrides.agentType ?? 'claude', cwd: '/tmp', id });
  s.pullEvents();
  if (overrides.agentSessionId) {
    s.setAgentSessionId(overrides.agentSessionId);
    s.pullEvents();
  }
  return s;
}

function makeEndedSession(id: string, resumable = false, agentSessionId?: string) {
  const s = makeActiveSession(id, { agentSessionId });
  s.markEnded(0, resumable);
  s.pullEvents();
  return s;
}

describe('SqliteSessionRepository', () => {
  describe('save + findById', () => {
    it('round-trips all Session fields', () => {
      const repo = createSqliteSessionRepository(db);
      const session = Session.reconstitute({
        id: 'abc',
        agentType: 'claude',
        cwd: '/home/user',
        gitBranch: 'main',
        gitRemoteUrl: 'https://github.com/foo/bar',
        repoName: 'bar',
        startedAt: 1000,
        endedAt: 2000,
        status: 'ended',
        exitCode: 0,
        agentSessionId: 'cid',
        resumable: true,
        mode: 'interactive',
      });
      repo.save(session);
      const found = repo.findById(SessionId('abc'));
      expect(found).not.toBeNull();
      if (!found) return;
      expect(found.id).toBe(SessionId('abc'));
      expect(found.agentType).toBe('claude');
      expect(found.cwd).toBe('/home/user');
      expect(found.gitBranch).toBe('main');
      expect(found.repoName).toBe('bar');
      expect(found.status).toBe('ended');
      expect(found.exitCode).toBe(0);
      expect(found.agentSessionId).toBe('cid');
      expect(found.resumable).toBe(true);
      expect(found.mode).toBe('interactive');
    });

    it('returns null for unknown id', () => {
      const repo = createSqliteSessionRepository(db);
      expect(repo.findById(SessionId('nope'))).toBeNull();
    });
  });

  describe('findAll', () => {
    it('returns active, ended, and error sessions', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s1'));
      const ended = makeEndedSession('s2');
      repo.save(ended);
      const errSession = Session.reconstitute({
        id: 's3',
        agentType: 'aider',
        cwd: '/tmp',
        startedAt: Date.now(),
        status: 'error',
        resumable: false,
      });
      repo.save(errSession);
      expect(repo.findAll()).toHaveLength(3);
    });
  });

  describe('findActive', () => {
    it('returns only active sessions', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s1'));
      repo.save(makeEndedSession('s2'));
      const active = repo.findActive();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe(SessionId('s1'));
    });
  });

  describe('findActiveWithAgentId', () => {
    it('returns all active sessions with agentSessionId set, regardless of agent type', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s1', { agentSessionId: 'cid1' }));
      repo.save(makeActiveSession('s2')); // no agentSessionId
      repo.save(makeActiveSession('s3', { agentType: 'aider', agentSessionId: 'cid3' }));
      const result = repo.findActiveWithAgentId();
      expect(result).toHaveLength(2);
      const ids = result.map((r) => r.agentSessionId).sort();
      expect(ids).toEqual(['cid1', 'cid3']);
    });
  });

  describe('findRecentlyEnded', () => {
    it('returns recently ended claude sessions with resumable=false', () => {
      const repo = createSqliteSessionRepository(db);
      const s1 = makeEndedSession('s1', false, 'cid1'); // ended, not resumable
      const s2 = makeEndedSession('s2', true, 'cid2'); // ended, resumable (excluded)
      repo.save(s1);
      repo.save(s2);
      const result = repo.findRecentlyEnded(60_000);
      expect(result).toHaveLength(1);
      expect(result[0].agentSessionId).toBe('cid1');
    });

    it('excludes sessions ended outside the time window', () => {
      const repo = createSqliteSessionRepository(db);
      const oldEnded = Session.reconstitute({
        id: 's1',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: 1000,
        endedAt: 1000, // very old
        status: 'ended',
        exitCode: 0,
        agentSessionId: 'cid',
        resumable: false,
      });
      repo.save(oldEnded);
      expect(repo.findRecentlyEnded(1000)).toHaveLength(0);
    });
  });

  describe('delete', () => {
    it('removes session and findById returns null', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeEndedSession('s1'));
      repo.delete(SessionId('s1'));
      expect(repo.findById(SessionId('s1'))).toBeNull();
    });
  });

  describe('deleteAllEnded', () => {
    it('removes ended/error sessions and preserves active', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s-active'));
      repo.save(makeEndedSession('s-ended'));
      repo.deleteAllEnded();
      expect(repo.findAll()).toHaveLength(1);
      expect(repo.findAll()[0].id).toBe(SessionId('s-active'));
    });
  });

  describe('markOrphanedEnded', () => {
    it('marks all active sessions as ended', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s1'));
      repo.save(makeActiveSession('s2'));
      repo.markOrphanedEnded();
      const all = repo.findAll();
      expect(all.every((s) => s.status === 'ended')).toBe(true);
    });
  });

  describe('pruneOld', () => {
    it('removes sessions older than cutoff', () => {
      const repo = createSqliteSessionRepository(db);
      const ancient = Session.reconstitute({
        id: 's-old',
        agentType: 'claude',
        cwd: '/tmp',
        startedAt: 1000,
        endedAt: 1000,
        status: 'ended',
        exitCode: 0,
        resumable: false,
      });
      repo.save(ancient);
      repo.save(makeEndedSession('s-new'));
      repo.pruneOld(1000); // cutoff = now - 1s, ancient session is way older
      const all = repo.findAll();
      expect(all.every((s) => s.id !== SessionId('s-old'))).toBe(true);
    });

    it('preserves active sessions regardless of age', () => {
      const repo = createSqliteSessionRepository(db);
      repo.save(makeActiveSession('s-active'));
      repo.pruneOld(0); // prune everything
      expect(repo.findAll()).toHaveLength(1);
    });
  });
});

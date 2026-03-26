import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { getGitContext } from '../modules/session/domain/git-context.js';

describe('getGitContext', () => {
  it('returns branch and remote for a git repo', async () => {
    const result = await Effect.runPromise(getGitContext(process.cwd()));
    expect(result.branch).toBeDefined();
    expect(typeof result.branch).toBe('string');
  });

  it('returns undefined for non-git directory', async () => {
    const result = await Effect.runPromise(getGitContext('/tmp'));
    expect(result.branch).toBeUndefined();
    expect(result.remoteUrl).toBeUndefined();
    expect(result.repoName).toBeUndefined();
  });

  it('derives repo name from remote URL', async () => {
    const result = await Effect.runPromise(getGitContext(process.cwd()));
    if (result.repoName) {
      expect(result.repoName).toContain('/');
    }
  });
});

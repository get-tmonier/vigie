import { describe, expect, it } from 'bun:test';
import type { FsEntry } from '#entities/session/api/session-api';

// Pure logic extracted from SpawnSessionDialog for unit testing

function filterSuggestions(cwd: string, suggestions: FsEntry[]): FsEntry[] {
  const typedSegment = cwd.endsWith('/') ? '' : cwd.substring(cwd.lastIndexOf('/') + 1);
  return typedSegment
    ? suggestions.filter((s) => s.name.toLowerCase().startsWith(typedSegment.toLowerCase()))
    : suggestions;
}

function buildNewPath(cwd: string, entryName: string): string {
  const parentDir = cwd.endsWith('/') ? cwd : cwd.substring(0, cwd.lastIndexOf('/') + 1);
  return `${parentDir}${entryName}/`;
}

function getParentDir(cwd: string): string {
  return cwd.endsWith('/') ? cwd : cwd.substring(0, cwd.lastIndexOf('/') + 1);
}

const dirs = (...names: string[]): FsEntry[] => names.map((name) => ({ name, isDirectory: true }));

describe('SpawnSessionDialog — filterSuggestions', () => {
  it('returns all suggestions when cwd ends with /', () => {
    const suggestions = dirs('projects', 'apps', 'work');
    expect(filterSuggestions('~/', suggestions)).toHaveLength(3);
  });

  it('filters by typed segment (case-insensitive)', () => {
    const suggestions = dirs('projects', 'apps', 'private', 'work');
    const result = filterSuggestions('~/pro', suggestions);
    expect(result.map((e) => e.name)).toEqual(['projects']);
  });

  it('matches multiple entries sharing a prefix', () => {
    const suggestions = dirs('projects', 'private', 'work');
    const result = filterSuggestions('~/pr', suggestions);
    expect(result.map((e) => e.name)).toEqual(['projects', 'private']);
  });

  it('is case-insensitive', () => {
    const suggestions = dirs('Projects', 'apps');
    expect(filterSuggestions('~/pro', suggestions)).toHaveLength(1);
    expect(filterSuggestions('~/PRO', suggestions)).toHaveLength(1);
  });

  it('returns empty array when no match', () => {
    const suggestions = dirs('apps', 'work');
    expect(filterSuggestions('~/xyz', suggestions)).toHaveLength(0);
  });

  it('returns all when typed segment is empty (path ends with /)', () => {
    const suggestions = dirs('a', 'b', 'c');
    expect(filterSuggestions('~/projects/', suggestions)).toHaveLength(3);
  });
});

describe('SpawnSessionDialog — buildNewPath', () => {
  it('appends entry name to parent dir when cwd has no trailing slash', () => {
    expect(buildNewPath('~/pro', 'projects')).toBe('~/projects/');
  });

  it('appends entry name when cwd already ends with /', () => {
    expect(buildNewPath('~/projects/', 'my-repo')).toBe('~/projects/my-repo/');
  });

  it('works from root-like path', () => {
    expect(buildNewPath('~/', 'projects')).toBe('~/projects/');
  });

  it('replaces the partial segment with the full entry name', () => {
    expect(buildNewPath('~/projects/cor', 'core')).toBe('~/projects/core/');
  });
});

describe('SpawnSessionDialog — getParentDir', () => {
  it('returns path as-is when it ends with /', () => {
    expect(getParentDir('~/projects/')).toBe('~/projects/');
  });

  it('strips the last segment when no trailing slash', () => {
    expect(getParentDir('~/projects/core')).toBe('~/projects/');
  });

  it('handles single-level path', () => {
    expect(getParentDir('~/pro')).toBe('~/');
  });
});

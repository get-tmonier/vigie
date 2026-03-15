import { describe, expect, it } from 'bun:test';
import { createInputHistoryStore } from '../input-history-store';

describe('createInputHistoryStore', () => {
  it('returns empty history for unknown session', () => {
    const store = createInputHistoryStore();
    expect(store.getHistory('unknown')).toEqual([]);
  });

  it('adds entries and retrieves them by session', () => {
    const store = createInputHistoryStore();
    store.addEntry('s1', 'ls -la', 'cli', 1000);
    store.addEntry('s1', 'pwd', 'browser', 2000);

    const history = store.getHistory('s1');
    expect(history).toHaveLength(2);
    expect(history[0]).toEqual({ text: 'ls -la', source: 'cli', timestamp: 1000 });
    expect(history[1]).toEqual({ text: 'pwd', source: 'browser', timestamp: 2000 });
  });

  it('keeps entries separate per session', () => {
    const store = createInputHistoryStore();
    store.addEntry('s1', 'echo hello', 'cli', 1000);
    store.addEntry('s2', 'cat file.txt', 'browser', 2000);
    store.addEntry('s1', 'exit', 'cli', 3000);

    expect(store.getHistory('s1')).toHaveLength(2);
    expect(store.getHistory('s1')[0].text).toBe('echo hello');
    expect(store.getHistory('s1')[1].text).toBe('exit');

    expect(store.getHistory('s2')).toHaveLength(1);
    expect(store.getHistory('s2')[0].text).toBe('cat file.txt');
  });

  it('does not mix sessions when querying', () => {
    const store = createInputHistoryStore();
    store.addEntry('s1', 'cmd1', 'cli', 1000);

    expect(store.getHistory('s2')).toEqual([]);
    expect(store.getHistory('s1')).toHaveLength(1);
  });

  it('preserves insertion order within a session', () => {
    const store = createInputHistoryStore();
    store.addEntry('s1', 'first', 'cli', 100);
    store.addEntry('s1', 'second', 'browser', 200);
    store.addEntry('s1', 'third', 'cli', 300);

    const texts = store.getHistory('s1').map((e) => e.text);
    expect(texts).toEqual(['first', 'second', 'third']);
  });

  it('tracks source correctly', () => {
    const store = createInputHistoryStore();
    store.addEntry('s1', 'from-cli', 'cli', 100);
    store.addEntry('s1', 'from-browser', 'browser', 200);

    expect(store.getHistory('s1')[0].source).toBe('cli');
    expect(store.getHistory('s1')[1].source).toBe('browser');
  });
});

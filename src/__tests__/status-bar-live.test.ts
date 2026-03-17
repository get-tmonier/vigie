import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { initStatusBar, resizeStatusBar, teardownStatusBar } from '../terminal/status-bar-live.js';

function createMockRenderer() {
  return {
    render: mock(() => {}),
    fullRender: mock(() => {}),
    resize: mock(() => {}),
    setRowOffset: mock((_n: number) => {}),
    setStatusBar: mock((_text: string) => {}),
    activate: mock(() => {}),
    deactivate: mock(() => {}),
  };
}

describe('status-bar-live', () => {
  let renderer: ReturnType<typeof createMockRenderer>;
  let stdoutWrites: string[];
  let originalWrite: typeof process.stdout.write;

  beforeEach(() => {
    renderer = createMockRenderer();
    stdoutWrites = [];
    originalWrite = process.stdout.write;
    process.stdout.write = mock((data: string | Uint8Array) => {
      stdoutWrites.push(String(data));
      return true;
    }) as typeof process.stdout.write;
  });

  afterEach(() => {
    teardownStatusBar(false);
    process.stdout.write = originalWrite;
  });

  it('calls renderer.setStatusBar on init', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    expect(renderer.setStatusBar).toHaveBeenCalledTimes(1);
    const text = renderer.setStatusBar.mock.calls[0][0] as string;
    expect(text).toContain('abcd1234');
    expect(text).toContain('^B d detach');
  });

  it('sets terminal title without detach hint', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    const titleWrite = stdoutWrites.find((w) => w.includes('\x1b]0;'));
    expect(titleWrite).toBeDefined();
    expect(titleWrite).not.toContain('^B d detach');
    expect(titleWrite).toContain('abcd1234');
  });

  it('shows elapsed time in bar', () => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    initStatusBar(renderer, 'abcd1234-5678', fiveMinutesAgo);
    const text = renderer.setStatusBar.mock.calls[0][0] as string;
    expect(text).toContain('5m');
  });

  it('resizeStatusBar re-renders the bar', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    renderer.setStatusBar.mockClear();
    resizeStatusBar();
    expect(renderer.setStatusBar).toHaveBeenCalledTimes(1);
  });

  it('teardownStatusBar clears interval and resets title', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    stdoutWrites = [];
    teardownStatusBar(false);
    const titleReset = stdoutWrites.find((w) => w.includes('Terminal'));
    expect(titleReset).toBeDefined();
  });

  it('teardownStatusBar with detach exits alt screen', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    stdoutWrites = [];
    teardownStatusBar(true);
    const altScreenExit = stdoutWrites.find((w) => w.includes('\x1b[?1049l'));
    expect(altScreenExit).toBeDefined();
  });

  it('teardownStatusBar without detach does not exit alt screen', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    stdoutWrites = [];
    teardownStatusBar(false);
    const altScreenExit = stdoutWrites.find((w) => w.includes('\x1b[?1049l'));
    expect(altScreenExit).toBeUndefined();
  });

  it('includes info line in status bar when provided', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now(), 'Resumed from deadbeef');
    const text = renderer.setStatusBar.mock.calls[0][0] as string;
    expect(text).toContain('Resumed from deadbeef');
    expect(text).toContain('^B d detach');
  });

  it('does not include info suffix when info is omitted', () => {
    initStatusBar(renderer, 'abcd1234-5678', Date.now());
    const text = renderer.setStatusBar.mock.calls[0][0] as string;
    expect(text).not.toContain('|  |');
    expect(text).toEndWith('^B d detach');
  });
});

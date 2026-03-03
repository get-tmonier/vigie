import { afterEach, describe, expect, it, mock } from 'bun:test';

mock.module('#shared/config/env', () => ({
  env: { VITE_API_URL: 'http://localhost:3001' },
}));

const OriginalEventSource = globalThis.EventSource;

describe('createDaemonEventSource', () => {
  afterEach(() => {
    globalThis.EventSource = OriginalEventSource;
  });

  it('passes withCredentials: true to EventSource', async () => {
    let capturedUrl = '';
    let capturedInit: EventSourceInit | undefined;

    globalThis.EventSource = class MockEventSource {
      constructor(url: string | URL, init?: EventSourceInit) {
        capturedUrl = String(url);
        capturedInit = init;
      }
    } as unknown as typeof EventSource;

    const { createDaemonEventSource } = await import('../event-source');
    createDaemonEventSource('d-1');

    expect(capturedUrl).toBe('http://localhost:3001/daemons/d-1/events');
    expect(capturedInit?.withCredentials).toBe(true);
  });
});

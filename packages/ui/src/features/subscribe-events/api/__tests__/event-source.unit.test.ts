import { afterEach, describe, expect, it, mock } from 'bun:test';

mock.module('#shared/config/env', () => ({
  env: { VITE_API_URL: 'http://localhost:3001' },
}));

const OriginalEventSource = globalThis.EventSource;

describe('createEventSource', () => {
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

    const { createEventSource } = await import('../event-source');
    createEventSource();

    expect(capturedUrl).toBe('http://localhost:3001/api/events');
    expect(capturedInit?.withCredentials).toBe(true);
  });
});

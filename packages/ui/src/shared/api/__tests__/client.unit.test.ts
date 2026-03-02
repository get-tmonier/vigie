import { afterEach, describe, expect, it, mock } from 'bun:test';

mock.module('#shared/config/env', () => ({
  env: { VITE_API_URL: 'http://localhost:3001' },
}));

const { apiFetch, API_BASE } = await import('../client');

const originalFetch = globalThis.fetch;

describe('apiFetch', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns parsed JSON on success', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ data: 'ok' }), { status: 200 }))
    ) as unknown as typeof fetch;

    const result = await apiFetch<{ data: string }>('/test');
    expect(result.data).toBe('ok');
  });

  it('sets credentials and content-type', async () => {
    let capturedInit: RequestInit | undefined;
    globalThis.fetch = mock((_url: string, init?: RequestInit) => {
      capturedInit = init;
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await apiFetch('/test');
    expect(capturedInit?.credentials).toBe('include');
    expect(new Headers(capturedInit?.headers).get('Content-Type')).toBe('application/json');
  });

  it('prepends API_BASE to path', async () => {
    let capturedUrl = '';
    globalThis.fetch = mock((url: string) => {
      capturedUrl = url;
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await apiFetch('/api/keys');
    expect(capturedUrl).toBe(`${API_BASE}/api/keys`);
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('', { status: 403, statusText: 'Forbidden' }))
    ) as unknown as typeof fetch;

    expect(apiFetch('/test')).rejects.toThrow('API error: 403 Forbidden');
  });
});

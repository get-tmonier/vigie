import { afterEach, describe, expect, it, mock } from 'bun:test';

mock.module('#shared/config/env', () => ({
  env: { VITE_API_URL: 'http://localhost:3001' },
}));

const originalFetch = globalThis.fetch;

const { listApiKeys, createApiKey, deleteApiKey } = await import('../api-keys-api');

describe('api-keys-api', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('listApiKeys calls GET /api/keys and extracts apiKeys', async () => {
    const keys = [{ id: 'k1', name: 'Key 1', prefix: 'tmonier_', createdAt: '2025-01-01' }];
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response(JSON.stringify({ apiKeys: keys }), { status: 200 }))
    ) as unknown as typeof fetch;

    const result = await listApiKeys();
    expect(result).toEqual(keys);
  });

  it('createApiKey calls POST /api/keys with body', async () => {
    let capturedBody = '';
    globalThis.fetch = mock((_url: string, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return Promise.resolve(
        new Response(JSON.stringify({ id: 'k1', name: 'test', key: 'tmonier_abc' }), {
          status: 200,
        })
      );
    }) as unknown as typeof fetch;

    const result = await createApiKey('test');
    expect(JSON.parse(capturedBody)).toEqual({ name: 'test' });
    expect(result.key).toBe('tmonier_abc');
  });

  it('deleteApiKey calls DELETE /api/keys/:id', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    globalThis.fetch = mock((url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method ?? '';
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await deleteApiKey('key-42');
    expect(capturedUrl).toContain('/api/keys/key-42');
    expect(capturedMethod).toBe('DELETE');
  });

  it('throws on non-ok response', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response('', { status: 500, statusText: 'Internal Server Error' }))
    ) as unknown as typeof fetch;

    expect(listApiKeys()).rejects.toThrow('API error: 500');
  });
});

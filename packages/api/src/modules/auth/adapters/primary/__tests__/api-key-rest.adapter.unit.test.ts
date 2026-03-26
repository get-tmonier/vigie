import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Hono } from 'hono';

const listApiKeys = mock();
const createApiKey = mock();
const deleteApiKey = mock();

let authenticatedUser: { id: string; name: string } | null = null;

mock.module('#modules/auth/auth-instance', () => ({
  auth: {
    api: {
      listApiKeys,
      createApiKey,
      deleteApiKey,
      getSession: mock(async () =>
        authenticatedUser ? { user: authenticatedUser, session: { id: 'session-1' } } : null
      ),
    },
  },
}));

const { apiKeyApp } = await import('../api-key-rest.adapter');

function createApp() {
  const app = new Hono();
  app.route('/', apiKeyApp);
  return app;
}

describe('api-key-rest adapter', () => {
  afterEach(() => {
    listApiKeys.mockReset();
    createApiKey.mockReset();
    deleteApiKey.mockReset();
    authenticatedUser = null;
  });

  describe('unauthenticated', () => {
    it('returns 401 for all endpoints when not authenticated', async () => {
      authenticatedUser = null;
      const app = createApp();

      const getRes = await app.request('/api/keys');
      expect(getRes.status).toBe(401);

      const postRes = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'test' }),
      });
      expect(postRes.status).toBe(401);

      const deleteRes = await app.request('/api/keys/key-1', {
        method: 'DELETE',
      });
      expect(deleteRes.status).toBe(401);
    });
  });

  describe('authenticated', () => {
    it('GET /api/keys returns key list', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      listApiKeys.mockResolvedValue({ apiKeys: [{ id: 'k1', name: 'My Key' }] });
      const app = createApp();

      const res = await app.request('/api/keys');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.apiKeys).toHaveLength(1);
    });

    it('POST /api/keys with valid name returns 201', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      createApiKey.mockResolvedValue({ id: 'k1', name: 'My Key', key: 'vigie_abc' });
      const app = createApp();

      const res = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'My Key' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.key).toBe('vigie_abc');
    });

    it('POST /api/keys with empty name returns 400', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      const app = createApp();

      const res = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid request body');
    });

    it('POST /api/keys with name > 64 chars returns 400', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      const app = createApp();

      const res = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'a'.repeat(65) }),
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('Invalid request body');
    });

    it('POST /api/keys with missing body returns 400', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      const app = createApp();

      const res = await app.request('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('DELETE /api/keys/:keyId returns result', async () => {
      authenticatedUser = { id: 'user-1', name: 'Test' };
      deleteApiKey.mockResolvedValue({ success: true });
      const app = createApp();

      const res = await app.request('/api/keys/key-1', { method: 'DELETE' });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});

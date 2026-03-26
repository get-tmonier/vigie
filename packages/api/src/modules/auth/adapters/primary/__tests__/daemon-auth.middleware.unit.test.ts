import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Hono } from 'hono';

const verifyApiKey = mock();

mock.module('#modules/auth/auth-instance', () => ({
  auth: {
    api: {
      verifyApiKey,
    },
  },
}));

const { daemonAuthMiddleware, clearApiKeyCache } = await import('../daemon-auth.middleware');
type DaemonAuthEnv = import('../daemon-auth.middleware').DaemonAuthEnv;

function createApp() {
  const app = new Hono<DaemonAuthEnv>();
  app.use('*', daemonAuthMiddleware);
  app.get('/ws/daemon', (c) => c.json({ userId: c.get('daemonUserId') }));
  return app;
}

describe('daemonAuthMiddleware', () => {
  afterEach(() => {
    verifyApiKey.mockReset();
    clearApiKeyCache();
  });

  it('returns 401 when token query param is missing', async () => {
    const app = createApp();
    const res = await app.request('/ws/daemon');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing token query parameter');
  });

  it('returns 401 when API key is invalid', async () => {
    verifyApiKey.mockResolvedValue({ valid: false });
    const app = createApp();
    const res = await app.request('/ws/daemon?token=bad_token');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('sets daemonUserId and passes through when token is valid', async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { referenceId: 'user-123' },
    });
    const app = createApp();
    const res = await app.request('/ws/daemon?token=vigie_validkey');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
  });

  it('returns 401 when verifyApiKey throws', async () => {
    verifyApiKey.mockRejectedValue(new Error('DB connection failed'));
    const app = createApp();
    const res = await app.request('/ws/daemon?token=vigie_somekey');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Authentication failed');
  });

  it('uses cached result on second call instead of hitting Better Auth', async () => {
    verifyApiKey.mockResolvedValue({
      valid: true,
      key: { referenceId: 'user-456' },
    });
    const app = createApp();

    await app.request('/ws/daemon?token=vigie_cachedkey');
    expect(verifyApiKey).toHaveBeenCalledTimes(1);

    await app.request('/ws/daemon?token=vigie_cachedkey');
    expect(verifyApiKey).toHaveBeenCalledTimes(1);

    const res = await app.request('/ws/daemon?token=vigie_cachedkey');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-456');
  });

  it('does not cache invalid keys', async () => {
    verifyApiKey.mockResolvedValue({ valid: false });
    const app = createApp();

    await app.request('/ws/daemon?token=bad_token');
    expect(verifyApiKey).toHaveBeenCalledTimes(1);

    await app.request('/ws/daemon?token=bad_token');
    expect(verifyApiKey).toHaveBeenCalledTimes(2);
  });
});

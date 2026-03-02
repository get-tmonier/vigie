import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { DaemonAuthEnv } from '../daemon-auth.middleware';

function createMockDaemonAuthMiddleware(verifyResult: {
  valid: boolean;
  key?: { referenceId: string };
}) {
  return createMiddleware<DaemonAuthEnv>(async (c, next) => {
    const token = c.req.query('token');
    if (!token) {
      return c.json({ error: 'Missing token query parameter' }, 401);
    }

    if (!verifyResult.valid || !verifyResult.key) {
      return c.json({ error: 'Invalid API key' }, 401);
    }

    c.set('daemonUserId', verifyResult.key.referenceId);
    await next();
  });
}

describe('daemonAuthMiddleware', () => {
  it('returns 401 when token query param is missing', async () => {
    const middleware = createMockDaemonAuthMiddleware({ valid: false });
    const app = new Hono<DaemonAuthEnv>();
    app.use('*', middleware);
    app.get('/ws/daemon', (c) => c.text('ok'));

    const res = await app.request('/ws/daemon');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Missing token query parameter');
  });

  it('returns 401 when token is invalid', async () => {
    const middleware = createMockDaemonAuthMiddleware({ valid: false });
    const app = new Hono<DaemonAuthEnv>();
    app.use('*', middleware);
    app.get('/ws/daemon', (c) => c.text('ok'));

    const res = await app.request('/ws/daemon?token=bad_token');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Invalid API key');
  });

  it('sets daemonUserId and passes through when token is valid', async () => {
    const middleware = createMockDaemonAuthMiddleware({
      valid: true,
      key: { referenceId: 'user-123' },
    });
    const app = new Hono<DaemonAuthEnv>();
    app.use('*', middleware);
    app.get('/ws/daemon', (c) => {
      return c.json({ userId: c.get('daemonUserId') });
    });

    const res = await app.request('/ws/daemon?token=tmonier_validkey');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
  });
});

import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { requireAuth } from '../require-auth.middleware';
import type { AuthEnv } from '../session-middleware';

function createApp(user: { id: string; name: string } | null) {
  const app = new Hono<AuthEnv>();
  app.use('*', async (c, next) => {
    c.set('user', user as AuthEnv['Variables']['user']);
    c.set('session', null);
    await next();
  });
  app.use('*', requireAuth);
  app.get('/protected', (c) => c.json({ ok: true }));
  return app;
}

describe('requireAuth middleware', () => {
  it('returns 401 when user is null', async () => {
    const app = createApp(null);
    const res = await app.request('/protected');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('passes through when user is present', async () => {
    const app = createApp({ id: 'user-1', name: 'Test User' });
    const res = await app.request('/protected');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

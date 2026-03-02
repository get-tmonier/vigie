import { createMiddleware } from 'hono/factory';
import type { AuthEnv } from './session-middleware';

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

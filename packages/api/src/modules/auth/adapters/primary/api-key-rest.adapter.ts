import { Hono } from 'hono';
import * as v from 'valibot';
import { auth } from '#modules/auth/auth-instance';
import { requireAuth } from './require-auth.middleware';
import { type AuthEnv, sessionMiddleware } from './session-middleware';

const CreateApiKeyBody = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(64)),
});

export const apiKeyApp = new Hono<AuthEnv>();

apiKeyApp.use('*', sessionMiddleware, requireAuth);

apiKeyApp.get('/api/keys', async (c) => {
  const keys = await auth.api.listApiKeys({
    headers: c.req.raw.headers,
  });
  return c.json(keys);
});

apiKeyApp.post('/api/keys', async (c) => {
  const raw = await c.req.json();
  const result = v.safeParse(CreateApiKeyBody, raw);
  if (!result.success) {
    return c.json({ error: 'Invalid request body' }, 400);
  }

  const key = await auth.api.createApiKey({
    body: {
      name: result.output.name,
      prefix: 'vigie_',
    },
    headers: c.req.raw.headers,
  });

  return c.json(key, 201);
});

apiKeyApp.delete('/api/keys/:keyId', async (c) => {
  const { keyId } = c.req.param();

  const result = await auth.api.deleteApiKey({
    body: { keyId },
    headers: c.req.raw.headers,
  });

  return c.json(result);
});

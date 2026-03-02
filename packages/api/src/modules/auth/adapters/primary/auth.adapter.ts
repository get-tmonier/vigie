import { Hono } from 'hono';
import { auth } from '#modules/auth/auth-instance';

export const authApp = new Hono();

authApp.on(['POST', 'GET'], '/api/auth/*', (c) => {
  return auth.handler(c.req.raw);
});

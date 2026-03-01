import { Effect } from 'effect';
import { Hono } from 'hono';

const health = new Hono();

health.get('/health', async (c) => {
  const result = await Effect.runPromise(Effect.succeed({ status: 'ok' }));
  return c.json(result);
});

export { health };

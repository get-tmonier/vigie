import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { health } from './routes/health.js';

const app = new Hono();

app.get('/', (c) => {
  return c.json({ message: 'Hello from @tmonier/api' });
});

app.route('/', health);

const port = 3001;
console.log(`@tmonier/api listening on http://localhost:${port}`);
serve({ fetch: app.fetch, port });

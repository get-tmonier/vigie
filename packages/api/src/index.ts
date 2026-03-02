import { Effect } from 'effect';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config';
import { daemonRestApp } from './modules/supervision/adapters/primary/daemon-rest.adapter';
import { daemonSseApp } from './modules/supervision/adapters/primary/daemon-sse.adapter';
import { daemonWsApp, websocket } from './modules/supervision/adapters/primary/daemon-ws.adapter';
import { health } from './routes/health';

const { port, corsOrigin } = Effect.runSync(loadConfig);

const app = new Hono();

app.use('*', cors({ origin: corsOrigin }));

app.route('/', health);
app.route('/', daemonWsApp);
app.route('/', daemonSseApp);
app.route('/', daemonRestApp);

console.log(`@tmonier/api listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};

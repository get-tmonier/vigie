import { Effect } from 'effect';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig } from './config';
import { apiKeyApp } from './modules/auth/adapters/primary/api-key-rest.adapter';
import { authApp } from './modules/auth/adapters/primary/auth.adapter';
import { requireAuth } from './modules/auth/adapters/primary/require-auth.middleware';
import { sessionMiddleware } from './modules/auth/adapters/primary/session-middleware';
import { daemonRestApp } from './modules/supervision/adapters/primary/daemon-rest.adapter';
import { daemonSseApp } from './modules/supervision/adapters/primary/daemon-sse.adapter';
import { daemonWsApp, websocket } from './modules/supervision/adapters/primary/daemon-ws.adapter';
import { deviceRestApp } from './modules/supervision/adapters/primary/device-rest.adapter';
import { health } from './routes/health';

const { port, corsOrigin } = Effect.runSync(loadConfig);

const app = new Hono();

app.route('/', daemonWsApp);

app.use(
  '*',
  cors({
    origin: corsOrigin,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.route('/', health);
app.route('/', authApp);
app.route('/', apiKeyApp);

app.use('/daemons/*', sessionMiddleware, requireAuth);
app.route('/', daemonSseApp);
app.route('/', daemonRestApp);

app.route('/', deviceRestApp);

console.log(`@tmonier/api listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
  websocket,
};

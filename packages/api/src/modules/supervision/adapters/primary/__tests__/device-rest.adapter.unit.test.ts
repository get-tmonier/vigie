import { afterEach, describe, expect, it, mock } from 'bun:test';
import { Effect } from 'effect';
import { Hono } from 'hono';
import type { DaemonSession } from '#modules/supervision/domain/daemon-session';

const listApiKeys = mock();
let mockDaemons: DaemonSession[] = [];
let authenticatedUser: { id: string; name: string } | null = null;

mock.module('#modules/auth/auth-instance', () => ({
  auth: {
    api: {
      listApiKeys,
      getSession: mock(async () =>
        authenticatedUser ? { user: authenticatedUser, session: { id: 'session-1' } } : null
      ),
    },
  },
}));

mock.module('../../../queries/list-daemons.query', () => ({
  listDaemons: () => Effect.succeed(mockDaemons),
}));

const { deviceRestApp } = await import('../device-rest.adapter');

function createApp() {
  const app = new Hono();
  app.route('/', deviceRestApp);
  return app;
}

describe('device-rest adapter', () => {
  afterEach(() => {
    listApiKeys.mockReset();
    mockDaemons = [];
    authenticatedUser = null;
  });

  it('returns 401 when unauthenticated', async () => {
    authenticatedUser = null;
    const app = createApp();
    const res = await app.request('/devices');
    expect(res.status).toBe(401);
  });

  it('returns online status when daemon hostname matches CLI key name', async () => {
    authenticatedUser = { id: 'user-1', name: 'Test' };
    listApiKeys.mockResolvedValue({
      apiKeys: [{ id: 'k1', name: 'CLI (macbook)', createdAt: '2025-01-01T00:00:00Z' }],
    });
    mockDaemons = [
      {
        id: 'daemon-1',
        userId: 'user-1',
        hostname: 'macbook',
        pid: 1234,
        version: '0.1.0',
        connectedAt: Date.now(),
      },
    ];

    const app = createApp();
    const res = await app.request('/devices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].hostname).toBe('macbook');
    expect(body.devices[0].status).toBe('online');
    expect(body.devices[0].daemonId).toBe('daemon-1');
  });

  it('returns offline status when no daemon matches', async () => {
    authenticatedUser = { id: 'user-1', name: 'Test' };
    listApiKeys.mockResolvedValue({
      apiKeys: [{ id: 'k1', name: 'CLI (macbook)', createdAt: '2025-01-01T00:00:00Z' }],
    });
    mockDaemons = [];

    const app = createApp();
    const res = await app.request('/devices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].status).toBe('offline');
    expect(body.devices[0].daemonId).toBeNull();
  });

  it('filters out keys that do not match CLI pattern', async () => {
    authenticatedUser = { id: 'user-1', name: 'Test' };
    listApiKeys.mockResolvedValue({
      apiKeys: [
        { id: 'k1', name: 'My Key', createdAt: '2025-01-01T00:00:00Z' },
        { id: 'k2', name: 'CLI (workstation)', createdAt: '2025-01-01T00:00:00Z' },
      ],
    });
    mockDaemons = [];

    const app = createApp();
    const res = await app.request('/devices');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].hostname).toBe('workstation');
  });
});

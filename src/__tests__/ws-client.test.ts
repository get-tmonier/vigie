import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { connectWebSocket } from '../ws/client.js';

let server: ReturnType<typeof Bun.serve>;
let serverUrl: string;
const received: string[] = [];
const upgradeTokens: (string | null)[] = [];

beforeAll(() => {
  server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req, srv) {
      const url = new URL(req.url);
      upgradeTokens.push(url.searchParams.get('token'));
      if (srv.upgrade(req, { data: null })) return undefined;
      return new Response('Not found', { status: 404 });
    },
    websocket: {
      message(ws, msg) {
        const data = typeof msg === 'string' ? msg : new TextDecoder().decode(msg);
        received.push(data);
        ws.send(JSON.stringify({ type: 'echo', data }));
      },
    },
  });
  serverUrl = `ws://127.0.0.1:${server.port}`;
});

afterAll(() => {
  server.stop(true);
});

describe('connectWebSocket', () => {
  it('sends token as query parameter on upgrade request', async () => {
    const messages: string[] = [];
    const conn = connectWebSocket(serverUrl, 'tmonier_test', (data) => {
      messages.push(data);
    });

    // Wait for hello to arrive at server
    await pollUntil(() => received.length > 0, 3_000);

    expect(upgradeTokens[0]).toBe('tmonier_test');

    const hello = JSON.parse(received[0]);
    expect(hello.type).toBe('daemon:hello');
    expect(hello.token).toBe('tmonier_test');
    expect(hello.hostname).toBeTypeOf('string');
    expect(hello.pid).toBeTypeOf('number');

    // Wait for echo response
    await pollUntil(() => messages.length > 0, 3_000);
    const echo = JSON.parse(messages[0]);
    expect(echo.type).toBe('echo');

    conn.close();
  });
});

async function pollUntil(fn: () => boolean, timeout: number) {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error('pollUntil timed out');
    await Bun.sleep(20);
  }
}

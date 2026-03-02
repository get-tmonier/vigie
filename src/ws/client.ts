import { hostname } from 'node:os';
import type { DaemonHello } from '../schemas/messages.js';

const VERSION = '0.0.1';
const MAX_RECONNECT_DELAY = 30_000;

interface WsConnection {
  send: (msg: unknown) => void;
  close: () => void;
}

export function connectWebSocket(
  url: string,
  token: string,
  onMessage: (data: string, send: (msg: unknown) => void) => void
): WsConnection {
  let ws: WebSocket | null = null;
  let reconnectDelay = 1_000;
  let closed = false;

  const send = (msg: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  };

  function connect() {
    if (closed) return;

    const wsUrl = new URL(url);
    wsUrl.searchParams.set('token', token);
    ws = new WebSocket(wsUrl.toString());

    ws.addEventListener('open', () => {
      console.log(`Connected to ${url}`);
      reconnectDelay = 1_000;

      const hello: DaemonHello = {
        type: 'daemon:hello',
        hostname: hostname(),
        pid: process.pid,
        version: VERSION,
        token,
      };
      send(hello);
    });

    ws.addEventListener('message', (event) => {
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      onMessage(data, send);
    });

    ws.addEventListener('close', () => {
      if (closed) return;
      console.log(`Disconnected. Reconnecting in ${reconnectDelay}ms...`);
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    });

    ws.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
    });
  }

  connect();

  return {
    send,
    close: () => {
      closed = true;
      ws?.close();
    },
  };
}

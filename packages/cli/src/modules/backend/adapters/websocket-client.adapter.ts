import { hostname } from 'node:os';
import { Effect } from 'effect';
import type { BackendClientShape } from '../ports/backend-client.port.js';

const VERSION = '0.3.0';
const MAX_RECONNECT_DELAY = 30_000;
const RECEIVE_TIMEOUT_MS = 60_000;

interface DaemonHello {
  type: 'daemon:hello';
  hostname: string;
  pid: number;
  version: string;
  token: string;
}

interface WebSocketClientOptions {
  onOfflineSend?: (msg: unknown) => void;
  onConnect?: () => void;
  onReconnect?: () => void;
}

export function createWebSocketClient(options?: WebSocketClientOptions): BackendClientShape {
  let ws: WebSocket | null = null;
  let reconnectDelay = 1_000;
  let closed = false;
  let receiveTimer: ReturnType<typeof setTimeout> | null = null;
  let messageHandler: ((data: string) => void) | null = null;
  let currentUrl = '';
  let currentToken = '';
  let hasConnectedBefore = false;

  const clearReceiveTimer = () => {
    if (receiveTimer) {
      clearTimeout(receiveTimer);
      receiveTimer = null;
    }
  };

  const resetReceiveTimer = () => {
    clearReceiveTimer();
    receiveTimer = setTimeout(() => {
      console.log('[ws] Receive timeout — no message in 60s, closing connection');
      ws?.close();
    }, RECEIVE_TIMEOUT_MS);
  };

  const sendRaw = (msg: unknown) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else if (options?.onOfflineSend) {
      options.onOfflineSend(msg);
    }
  };

  function doConnect() {
    if (closed) return;

    const wsUrl = new URL(currentUrl);
    wsUrl.searchParams.set('token', currentToken);
    ws = new WebSocket(wsUrl.toString());

    ws.addEventListener('open', () => {
      console.log(`[ws] Connected to ${currentUrl}`);
      reconnectDelay = 1_000;
      resetReceiveTimer();

      const isReconnect = hasConnectedBefore;
      hasConnectedBefore = true;

      const hello: DaemonHello = {
        type: 'daemon:hello',
        hostname: hostname(),
        pid: process.pid,
        version: VERSION,
        token: currentToken,
      };
      sendRaw(hello);

      options?.onConnect?.();

      if (isReconnect && options?.onReconnect) {
        options.onReconnect();
      }
    });

    ws.addEventListener('message', (event) => {
      resetReceiveTimer();
      const data = typeof event.data === 'string' ? event.data : String(event.data);
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'ping') {
          sendRaw({ type: 'pong' });
          return;
        }
      } catch {}
      if (messageHandler) messageHandler(data);
    });

    ws.addEventListener('close', () => {
      clearReceiveTimer();
      if (closed) return;
      console.log(`[ws] Disconnected. Reconnecting in ${reconnectDelay}ms...`);
      setTimeout(doConnect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    });

    ws.addEventListener('error', (err) => {
      console.error('[ws] WebSocket error:', err);
    });
  }

  return {
    connect: (url, token) =>
      Effect.sync(() => {
        currentUrl = url;
        currentToken = token;
        closed = false;
        doConnect();
      }),

    send: (msg) =>
      Effect.sync(() => {
        sendRaw(msg);
      }),

    onMessage: (handler) => {
      messageHandler = handler;
    },

    close: () =>
      Effect.sync(() => {
        closed = true;
        clearReceiveTimer();
        ws?.close();
      }),
  };
}

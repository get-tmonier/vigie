import { useCallback, useEffect, useRef, useState } from 'react';
import { env } from '#shared/config/env';

interface UseTerminalWsOptions {
  sessionId: string;
  onData: (data: Uint8Array) => void;
  onConnected?: (helpers: { sendResizeNow: (cols: number, rows: number) => void }) => void;
  onPtyResized?: (cols: number, rows: number) => void;
  onClear?: () => void;
}

interface UseTerminalWsResult {
  connected: boolean;
  send: (data: string) => void;
  sendResize: (cols: number, rows: number) => void;
}

const RESIZE_DEBOUNCE_MS = 150;

export function useTerminalWs({
  sessionId,
  onData,
  onConnected,
  onPtyResized,
  onClear,
}: UseTerminalWsOptions): UseTerminalWsResult {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onDataRef = useRef(onData);
  onDataRef.current = onData;
  const onConnectedRef = useRef(onConnected);
  onConnectedRef.current = onConnected;
  const onPtyResizedRef = useRef(onPtyResized);
  onPtyResizedRef.current = onPtyResized;
  const onClearRef = useRef(onClear);
  onClearRef.current = onClear;

  useEffect(() => {
    const apiUrl = env.VITE_API_URL;
    const wsUrl = `${apiUrl.replace(/^http/, 'ws')}/ws/terminal/${sessionId}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setConnected(true);
      onConnectedRef.current?.({
        sendResizeNow: (cols: number, rows: number) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'resize', cols, rows }));
          }
        },
      });
    });

    ws.addEventListener('message', (event) => {
      if (event.data instanceof ArrayBuffer) {
        onDataRef.current(new Uint8Array(event.data));
      } else if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data) as { type: string; cols?: number; rows?: number };
          if (
            msg.type === 'pty-resized' &&
            typeof msg.cols === 'number' &&
            typeof msg.rows === 'number'
          ) {
            onPtyResizedRef.current?.(msg.cols, msg.rows);
          } else if (msg.type === 'terminal:clear') {
            onClearRef.current?.();
          }
        } catch {}
      }
    });

    ws.addEventListener('close', () => {
      if (wsRef.current === ws) {
        setConnected(false);
        wsRef.current = null;
      }
    });

    return () => {
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
        setConnected(false);
      }
    };
  }, [sessionId]);

  const send = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoder = new TextEncoder();
      ws.send(encoder.encode(data));
    }
  }, []);

  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    resizeTimerRef.current = setTimeout(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    }, RESIZE_DEBOUNCE_MS);
  }, []);

  return { connected, send, sendResize };
}

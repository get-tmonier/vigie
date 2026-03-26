import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useCallback, useEffect, useRef } from 'react';
import { useTerminalWs } from '../model/use-terminal-ws';

interface InteractiveTerminalProps {
  sessionId: string;
  onConnectionChange?: (connected: boolean) => void;
  onInput?: (data: string) => void;
}

export function InteractiveTerminal({
  sessionId,
  onConnectionChange,
  onInput,
}: InteractiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;
  const onInputRef = useRef(onInput);
  onInputRef.current = onInput;

  const onData = useCallback((data: Uint8Array) => {
    const terminal = terminalRef.current;
    if (!terminal || data.length === 0) return;

    terminal.write(data);
  }, []);

  const onConnected = useCallback(
    ({ sendResizeNow }: { sendResizeNow: (cols: number, rows: number) => void }) => {
      const terminal = terminalRef.current;
      const fitAddon = fitAddonRef.current;
      if (!terminal || !fitAddon) return;

      terminal.reset();
      fitAddon.fit();
      sendResizeNow(terminal.cols, terminal.rows);
    },
    []
  );

  const onPtyResized = useCallback((cols: number, rows: number) => {
    const terminal = terminalRef.current;
    if (!terminal || (terminal.cols === cols && terminal.rows === rows)) return;
    terminal.resize(cols, rows);
  }, []);

  const onClear = useCallback(() => {
    terminalRef.current?.reset();
  }, []);

  const { connected, send, sendResize } = useTerminalWs({
    sessionId,
    onData,
    onConnected,
    onPtyResized,
    onClear,
  });

  useEffect(() => {
    onConnectionChangeRef.current?.(connected);
  }, [connected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: '#0a0e1a',
        foreground: '#f5f0e8',
        cursor: '#26c09a',
        selectionBackground: '#26c09a33',
        black: '#0a0e1a',
        brightBlack: '#6b7280',
        white: '#f5f0e8',
        brightWhite: '#ffffff',
        yellow: '#4ecfb0',
        brightYellow: '#7dddc8',
      },
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    terminal.onData((data) => {
      send(data);
      onInputRef.current?.(data);
    });

    terminal.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [send, sendResize]);

  return <div ref={containerRef} className="flex-1 bg-navy-900 overflow-hidden" />;
}

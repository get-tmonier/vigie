import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useCallback, useEffect, useRef } from 'react';
import { cn } from '#shared/lib/cn';
import { useTerminalWs } from '../model/use-terminal-ws';

interface InteractiveTerminalProps {
  sessionId: string;
}

export function InteractiveTerminal({ sessionId }: InteractiveTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const onData = useCallback((data: Uint8Array) => {
    const terminal = terminalRef.current;
    if (!terminal || data.length === 0) return;

    terminal.write(data);
  }, []);

  const onConnected = useCallback(() => {
    const terminal = terminalRef.current;
    const fitAddon = fitAddonRef.current;
    if (!terminal || !fitAddon) return;

    // Clean slate — discard any stale local state
    terminal.reset();

    // Fit triggers onResize → sendResize → SIGWINCH → Claude Code re-renders at browser width
    fitAddon.fit();
  }, []);

  const { connected, send, sendResize } = useTerminalWs({ sessionId, onData, onConnected });

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
        cursor: '#d4a843',
        selectionBackground: '#d4a84333',
        black: '#0a0e1a',
        brightBlack: '#6b7280',
        white: '#f5f0e8',
        brightWhite: '#ffffff',
        yellow: '#d4a843',
        brightYellow: '#e5b954',
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

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-navy-light">
        <span
          className={cn(
            'w-2 h-2 rounded-full',
            connected ? 'bg-success animate-pulse' : 'bg-slate'
          )}
        />
        <span className="text-xs text-slate font-mono">
          {connected ? 'Connected' : 'Connecting...'}
        </span>
        <span className="text-xs text-slate font-mono ml-auto">interactive</span>
      </div>
      <div ref={containerRef} className="flex-1 bg-navy-deep" />
    </div>
  );
}

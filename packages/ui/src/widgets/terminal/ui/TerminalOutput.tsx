import type { SSEEvent } from '@vigie/shared';
import { useEffect, useRef } from 'react';
import { cn } from '#shared/lib/cn';

interface TerminalOutputProps {
  events: SSEEvent[];
}

function eventKey(event: SSEEvent, index: number): string {
  if ('id' in event) return `${event.type}-${event.id}-${index}`;
  return `${event.type}-${event.daemonId}-${index}`;
}

export function TerminalOutput({ events }: TerminalOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom when new events arrive
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [events.length]);

  return (
    <div
      ref={containerRef}
      className="flex-1 font-mono text-[0.8125rem] leading-relaxed bg-navy-900 p-4 overflow-y-auto"
    >
      {events.map((event, i) => {
        const key = eventKey(event, i);
        switch (event.type) {
          case 'command:output':
            return (
              <div key={key} className="flex gap-2">
                <span className="text-cream-50-200 text-[0.6875rem] shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={cn(
                    'whitespace-pre-wrap break-all',
                    event.stream === 'stderr' ? 'text-danger' : 'text-cream-50'
                  )}
                >
                  {event.data}
                </span>
              </div>
            );
          case 'command:done':
            return (
              <div
                key={key}
                className={cn(
                  'py-1 shadow-[0_-1px_0_0_rgba(22,45,74,0.6)] mt-1',
                  event.exitCode === 0 ? 'text-success' : 'text-danger'
                )}
              >
                Process exited with code {event.exitCode}
              </div>
            );
          case 'command:error':
            return (
              <div key={key} className="text-danger py-1">
                Error: {event.error}
              </div>
            );
          case 'daemon:connected':
            return (
              <div key={key} className="text-success py-1">
                Daemon connected: {event.hostname}
              </div>
            );
          case 'daemon:disconnected':
            return (
              <div key={key} className="text-danger py-1">
                Daemon disconnected: {event.hostname}
              </div>
            );
          case 'session:started':
            return (
              <div key={key} className="text-vigie-400 py-1">
                Session started: {event.sessionId.slice(0, 8)} ({event.agentType})
              </div>
            );
          case 'session:output':
            return (
              <div key={key} className="flex gap-2">
                <span className="text-cream-50-200 text-[0.6875rem] shrink-0">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="whitespace-pre-wrap break-all text-cream-50">{event.data}</span>
              </div>
            );
          case 'session:ended':
            return (
              <div
                key={key}
                className={cn(
                  'py-1 shadow-[0_-1px_0_0_rgba(22,45,74,0.6)] mt-1',
                  event.exitCode === 0 ? 'text-success' : 'text-danger'
                )}
              >
                Session {event.sessionId.slice(0, 8)} ended (code {event.exitCode})
              </div>
            );
          case 'session:error':
            return (
              <div key={key} className="text-danger py-1">
                Session {event.sessionId.slice(0, 8)} error: {event.error}
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

import { useMemo } from 'react';
import type { SessionOutput } from '#shared/types/api';
import type { DaemonEvent } from '#shared/types/daemon-event';

export type SessionChunk =
  | { type: 'text'; data: string; timestamp: number }
  | { type: 'thinking'; data: string; timestamp: number }
  | { type: 'tool_use'; data: string; timestamp: number }
  | { type: 'tool_result'; data: string; timestamp: number }
  | { type: 'status'; data: string; timestamp: number }
  | { type: 'error'; data: string; timestamp: number };

function isSessionOutput(e: DaemonEvent): e is SessionOutput {
  return e.type === 'session:output';
}

export function useSessionStream(events: DaemonEvent[], sessionId: string | null) {
  const chunks = useMemo(() => {
    if (!sessionId) return [];

    return events
      .filter(isSessionOutput)
      .filter((e) => e.sessionId === sessionId)
      .map(
        (e): SessionChunk => ({
          type: e.chunkType as SessionChunk['type'],
          data: e.data,
          timestamp: e.timestamp,
        })
      );
  }, [events, sessionId]);

  const accumulatedText = useMemo(() => {
    return chunks
      .filter((c) => c.type === 'text')
      .map((c) => c.data)
      .join('');
  }, [chunks]);

  const thinkingChunks = useMemo(() => {
    return chunks.filter((c) => c.type === 'thinking');
  }, [chunks]);

  const toolChunks = useMemo(() => {
    return chunks.filter((c) => c.type === 'tool_use' || c.type === 'tool_result');
  }, [chunks]);

  return { chunks, accumulatedText, thinkingChunks, toolChunks };
}

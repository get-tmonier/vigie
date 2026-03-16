import type { SSEEvent } from '@tmonier/shared';
import { useMemo } from 'react';

export type SessionChunk =
  | { type: 'text'; data: string; timestamp: number }
  | { type: 'thinking'; data: string; timestamp: number }
  | { type: 'tool_use'; data: string; timestamp: number }
  | { type: 'tool_result'; data: string; timestamp: number }
  | { type: 'status'; data: string; timestamp: number }
  | { type: 'error'; data: string; timestamp: number };

export function useSessionStream(events: SSEEvent[], sessionId: string | null) {
  const chunks = useMemo(() => {
    if (!sessionId) return [];

    return events
      .filter(
        (e): e is Extract<SSEEvent, { type: 'session:output' }> =>
          e.type === 'session:output' && 'sessionId' in e && e.sessionId === sessionId
      )
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

import { useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import type { SessionChunk } from '../model/use-session-stream';

interface TokenStreamProps {
  chunks: SessionChunk[];
  accumulatedText: string;
}

function ChunkDisplay({ chunk }: { chunk: SessionChunk }) {
  switch (chunk.type) {
    case 'text':
      return <span className="text-cream whitespace-pre-wrap break-words">{chunk.data}</span>;
    case 'thinking':
      return (
        <div className="text-slate italic text-xs py-1 border-l-2 border-navy-light pl-2 my-1">
          {chunk.data}
        </div>
      );
    case 'tool_use': {
      const parts = chunk.data.split(' ');
      const toolName = parts[0];
      const input = parts.slice(1).join(' ');
      return (
        <div className="flex items-start gap-2 py-1 my-1">
          <span className="text-gold font-bold text-xs shrink-0">{toolName}</span>
          {input && <span className="text-slate text-xs truncate">{input.slice(0, 100)}</span>}
        </div>
      );
    }
    case 'tool_result': {
      const truncated = chunk.data.length > 200 ? `${chunk.data.slice(0, 200)}...` : chunk.data;
      return <div className="text-slate text-xs pl-4 py-0.5 opacity-60 truncate">{truncated}</div>;
    }
    case 'status':
      return (
        <div className="text-gold text-xs py-2 border-t border-navy-light mt-2">{chunk.data}</div>
      );
    case 'error':
      return <div className="text-error text-xs py-1">{chunk.data}</div>;
  }
}

export function TokenStream({ chunks }: TokenStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showThinking, setShowThinking] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to bottom on new chunks
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [chunks.length]);

  const thinkingChunks = chunks.filter((c) => c.type === 'thinking');
  const nonThinkingChunks = chunks.filter((c) => c.type !== 'thinking');

  return (
    <div
      ref={containerRef}
      className="flex-1 font-mono text-[0.8125rem] leading-relaxed bg-navy-deep p-4 overflow-y-auto"
    >
      {thinkingChunks.length > 0 && (
        <button
          type="button"
          onClick={() => setShowThinking(!showThinking)}
          className="text-xs text-slate hover:text-cream mb-2 flex items-center gap-1"
        >
          <span className={cn('transition-transform', showThinking && 'rotate-90')}>&#9654;</span>
          {thinkingChunks.length} thinking block{thinkingChunks.length > 1 ? 's' : ''}
        </button>
      )}
      {showThinking &&
        thinkingChunks.map((chunk, i) => (
          <ChunkDisplay key={`thinking-${chunk.timestamp}-${i}`} chunk={chunk} />
        ))}
      {nonThinkingChunks.map((chunk, i) => (
        <ChunkDisplay key={`chunk-${chunk.timestamp}-${i}`} chunk={chunk} />
      ))}
    </div>
  );
}

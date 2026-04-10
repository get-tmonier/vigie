import type { StructuredEvent } from '#shared/kernel/session/events';

interface EventFeedProps {
  events: StructuredEvent[];
}

function renderEvent(event: StructuredEvent, index: number) {
  switch (event.type) {
    case 'agent:tool-call':
      return (
        <div key={index} className="flex items-start gap-2 py-1.5 border-b border-neutral-800">
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              event.status === 'running'
                ? 'bg-yellow-900/30 text-yellow-400'
                : event.status === 'completed'
                  ? 'bg-green-900/30 text-green-400'
                  : 'bg-red-900/30 text-red-400'
            }`}
          >
            {event.status === 'running' ? '...' : event.status === 'completed' ? '+' : 'x'}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-sm text-neutral-200 font-mono">{event.toolName}</span>
            {event.durationMs && (
              <span className="text-xs text-neutral-500 ml-2">{event.durationMs}ms</span>
            )}
          </div>
        </div>
      );

    case 'agent:text-delta':
      return (
        <div key={index} className="py-1 text-sm text-neutral-300">
          {event.content}
        </div>
      );

    case 'agent:cost-update':
      return (
        <div key={index} className="py-1 text-xs text-neutral-500 flex gap-4">
          <span>
            {event.inputTokens} in / {event.outputTokens} out
          </span>
          <span>{event.modelId}</span>
        </div>
      );

    case 'agent:subagent-spawn':
      return (
        <div key={index} className="py-1 text-xs text-teal-400">
          Subagent: {event.description}
        </div>
      );

    case 'agent:turn-started':
      return (
        <div key={index} className="py-2 text-xs text-neutral-400 border-t border-neutral-700 mt-2">
          Turn {event.turnIndex}: {event.prompt.slice(0, 100)}
        </div>
      );

    case 'agent:turn-completed':
      return (
        <div key={index} className="py-1 text-xs text-neutral-500">
          Turn completed: {event.stopReason}
        </div>
      );

    default:
      return null;
  }
}

export function EventFeed({ events }: EventFeedProps) {
  return (
    <div className="flex flex-col overflow-y-auto p-3 h-full">
      {events.length === 0 && (
        <div className="text-xs text-neutral-600 text-center py-8">No events yet</div>
      )}
      {events.map((event, i) => renderEvent(event, i))}
    </div>
  );
}

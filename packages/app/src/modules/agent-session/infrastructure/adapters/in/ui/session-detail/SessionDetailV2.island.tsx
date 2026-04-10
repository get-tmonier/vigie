import { useStore } from '@nanostores/react';
import { InteractiveTerminal } from '../InteractiveTerminal.island';
import { $eventFeed, $selectedId, $sessions, $view } from '../store';
import { EventFeed } from './EventFeed';
import { PromptInput } from './PromptInput';

export function SessionDetailV2() {
  const sessions = useStore($sessions);
  const selectedId = useStore($selectedId);
  const view = useStore($view);
  const eventFeedMap = useStore($eventFeed);

  if (view !== 'detail' || !selectedId) return null;

  const session = sessions.find((s) => s.id === selectedId);
  if (!session) return null;

  const events = eventFeedMap[session.id] ?? [];
  const isStructured = session.sessionType === 'structured';
  const isPaused = session.status === 'paused';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-700">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="text-sm text-neutral-400 hover:text-neutral-200"
            onClick={() => $view.set('kanban')}
          >
            Back
          </button>
          <span className="text-sm font-mono text-neutral-300">{session.id.slice(0, 12)}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-400">
            {session.sessionType ?? 'interactive'}
          </span>
          <span className="text-xs text-neutral-500">{session.status}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>${(session.totalCostUsd ?? 0).toFixed(4)}</span>
          <span>Turn {session.currentTurnIndex ?? 0}</span>
        </div>
      </div>

      {/* Content */}
      {isStructured ? (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            <EventFeed events={events} />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: structured events from hooks */}
          <div className="w-1/2 border-r border-neutral-700 overflow-y-auto">
            <div className="p-2 text-xs text-neutral-500 bg-neutral-800/50 border-b border-neutral-700">
              Structured events via hooks (best effort)
            </div>
            <EventFeed events={events} />
          </div>
          {/* Right: xterm.js escape hatch */}
          <div className="w-1/2">
            <InteractiveTerminal sessionId={session.id} />
          </div>
        </div>
      )}

      {/* Prompt input for structured paused sessions */}
      {isStructured && <PromptInput sessionId={session.id} disabled={!isPaused} />}
    </div>
  );
}

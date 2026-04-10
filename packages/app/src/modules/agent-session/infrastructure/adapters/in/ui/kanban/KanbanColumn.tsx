import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { StructuredEvent } from '#shared/kernel/session/events';
import { KanbanCard } from './KanbanCard';

interface KanbanColumnProps {
  title: string;
  sessions: AgentSession[];
  events: Record<string, StructuredEvent[]>;
  onAction: (action: string, sessionId: string) => void;
}

export function KanbanColumn({ title, sessions, events, onAction }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[240px] max-w-[280px]">
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-sm font-medium text-neutral-300">{title}</h3>
        <span className="text-xs text-neutral-500 bg-neutral-800 px-1.5 py-0.5 rounded">
          {sessions.length}
        </span>
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-180px)]">
        {sessions.map((s) => (
          <KanbanCard key={s.id} session={s} events={events[s.id] ?? []} onAction={onAction} />
        ))}
        {sessions.length === 0 && (
          <div className="text-xs text-neutral-600 text-center py-4">No sessions</div>
        )}
      </div>
    </div>
  );
}

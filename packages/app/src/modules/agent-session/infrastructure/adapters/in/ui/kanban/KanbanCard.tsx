import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import type { StructuredEvent, ToolCall } from '#shared/kernel/session/events';
import { $selectedId, $view } from '../store';

interface KanbanCardProps {
  session: AgentSession;
  events: StructuredEvent[];
  onAction: (action: string, sessionId: string) => void;
}

function getActivityMode(session: AgentSession, events: StructuredEvent[]): string {
  if (session.status === 'paused') return 'Waiting';
  if (session.status !== 'active') return '';

  const recentTools = events
    .filter((e): e is ToolCall => e.type === 'agent:tool-call' && e.sessionId === session.id)
    .slice(-5);

  if (recentTools.length === 0) return 'Other';

  const lastName = recentTools[recentTools.length - 1].toolName;
  const planningTools = ['Read', 'Grep', 'Glob', 'WebSearch'];
  const implementingTools = ['Edit', 'Write'];

  if (planningTools.includes(lastName)) return 'Planning';
  if (implementingTools.includes(lastName)) return 'Implementing';
  if (
    lastName === 'Bash' &&
    recentTools.some((t) => /test|spec|check/.test(JSON.stringify(t.input)))
  )
    return 'Testing';
  if (lastName === 'Read' && recentTools.some((t) => t.toolName === 'Edit')) return 'Reviewing';
  return 'Other';
}

function formatCost(usd: number | undefined): string {
  if (!usd || usd === 0) return '$0.00';
  return `$${usd.toFixed(4)}`;
}

export function KanbanCard({ session, events, onAction }: KanbanCardProps) {
  const activityMode = getActivityMode(session, events);

  function handleOpen() {
    $selectedId.set(session.id);
    $view.set('detail');
  }

  return (
    <div className="rounded-lg border border-neutral-700 bg-neutral-800/50 transition-colors hover:border-neutral-500">
      <button type="button" className="w-full cursor-pointer p-3 text-left" onClick={handleOpen}>
        <div className="mb-2 flex items-center justify-between">
          <span className="max-w-[120px] truncate font-mono text-xs text-neutral-400">
            {session.id.slice(0, 8)}
          </span>
          <span className="rounded bg-neutral-700 px-1.5 py-0.5 text-xs text-neutral-300">
            {session.agentType}
          </span>
        </div>

        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-neutral-700/50 px-1.5 py-0.5 text-xs text-neutral-400">
            {session.sessionType ?? 'interactive'}
          </span>
          {activityMode && <span className="text-xs text-teal-400">{activityMode}</span>}
        </div>

        <div className="mb-1 truncate text-xs text-neutral-500">{session.cwd}</div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>{formatCost(session.totalCostUsd)}</span>
          <span>Turn {session.currentTurnIndex ?? 0}</span>
        </div>
      </button>

      {session.status === 'active' && (
        <div className="flex gap-1 px-3 pb-3">
          <button
            type="button"
            className="rounded bg-red-900/30 px-2 py-0.5 text-xs text-red-400 hover:bg-red-900/50"
            onClick={() => onAction('kill', session.id)}
          >
            Kill
          </button>
        </div>
      )}
    </div>
  );
}

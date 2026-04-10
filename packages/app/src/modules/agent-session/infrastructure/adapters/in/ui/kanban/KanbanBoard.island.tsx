import { useStore } from '@nanostores/react';
import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { $eventFeed, $sessions } from '../store';
import { KanbanColumn } from './KanbanColumn';

type StatusGroup = 'Queued' | 'Running' | 'Paused' | 'Completed' | 'Stopped' | 'Archived';

function groupByStatus(sessions: AgentSession[]): Record<StatusGroup, AgentSession[]> {
  const groups: Record<StatusGroup, AgentSession[]> = {
    Queued: [],
    Running: [],
    Paused: [],
    Completed: [],
    Stopped: [],
    Archived: [],
  };

  for (const s of sessions) {
    switch (s.status) {
      case 'registering':
        groups.Queued.push(s);
        break;
      case 'active':
        groups.Running.push(s);
        break;
      case 'paused':
        groups.Paused.push(s);
        break;
      case 'ended':
        groups.Completed.push(s);
        break;
      case 'error':
      case 'abandoned':
      case 'killed':
        groups.Stopped.push(s);
        break;
      case 'archived':
        groups.Archived.push(s);
        break;
    }
  }

  return groups;
}

function handleAction(action: string, sessionId: string): void {
  const url = `/api/sessions/${sessionId}/${action}`;
  fetch(url, { method: 'POST' }).catch(() => {});
}

export function KanbanBoard() {
  const sessions = useStore($sessions);
  const eventFeedMap = useStore($eventFeed);
  const groups = groupByStatus(sessions);

  return (
    <div className="flex gap-4 p-4 overflow-x-auto h-full">
      <KanbanColumn
        title="Queued"
        sessions={groups.Queued}
        events={eventFeedMap}
        onAction={handleAction}
      />
      <KanbanColumn
        title="Running"
        sessions={groups.Running}
        events={eventFeedMap}
        onAction={handleAction}
      />
      <KanbanColumn
        title="Paused"
        sessions={groups.Paused}
        events={eventFeedMap}
        onAction={handleAction}
      />
      <KanbanColumn
        title="Completed"
        sessions={groups.Completed}
        events={eventFeedMap}
        onAction={handleAction}
      />
      <KanbanColumn
        title="Stopped"
        sessions={groups.Stopped}
        events={eventFeedMap}
        onAction={handleAction}
      />
    </div>
  );
}

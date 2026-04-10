import { createRoot } from 'react-dom/client';
import { KanbanBoard } from '#modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanBoard.island';
import { SpawnSessionFormIsland } from '#modules/agent-session/infrastructure/adapters/in/ui/SpawnSessionForm.island';
import { SessionDetailV2 } from '#modules/agent-session/infrastructure/adapters/in/ui/session-detail/SessionDetailV2.island';
import { init } from '#modules/agent-session/infrastructure/adapters/in/ui/ws-sync';
import '#shared/styles/global.css';

function mount(id: string, component: React.ReactNode): void {
  const el = document.getElementById(id);
  if (el) createRoot(el).render(component);
}

init();
mount('kanban-board-app', <KanbanBoard />);
mount('session-detail-v2-app', <SessionDetailV2 />);
mount('spawn-form-app', <SpawnSessionFormIsland />);

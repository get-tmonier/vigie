import { createRoot } from 'react-dom/client';
import { KanbanBoard } from '#modules/agent-session/infrastructure/adapters/in/ui/kanban/KanbanBoard.island';
import { SessionDetail } from '#modules/agent-session/infrastructure/adapters/in/ui/SessionDetail.island';
import { SessionList } from '#modules/agent-session/infrastructure/adapters/in/ui/SessionList.island';
import { SpawnSessionFormIsland } from '#modules/agent-session/infrastructure/adapters/in/ui/SpawnSessionForm.island';
import { init } from '#modules/agent-session/infrastructure/adapters/in/ui/ws-sync';
import '#shared/styles/global.css';

init();

const el1 = document.getElementById('session-list-app');
if (el1) createRoot(el1).render(<SessionList />);

const el2 = document.getElementById('session-detail-app');
if (el2) createRoot(el2).render(<SessionDetail />);

const el3 = document.getElementById('spawn-form-app');
if (el3) createRoot(el3).render(<SpawnSessionFormIsland />);

const el4 = document.getElementById('kanban-board-app');
if (el4) createRoot(el4).render(<KanbanBoard />);

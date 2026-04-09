import { createRoot } from 'react-dom/client';
import { SessionDashboard } from '#modules/agent-session/infrastructure/adapters/in/ui/SessionDashboard.island';
import '#shared/styles/global.css';

const dashboardEl = document.getElementById('dashboard-app');
if (dashboardEl) {
  createRoot(dashboardEl).render(<SessionDashboard />);
}

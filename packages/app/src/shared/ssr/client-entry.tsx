import { createRoot } from 'react-dom/client';
import { DashboardApp } from '#modules/agent-session/infrastructure/adapters/in/ui/DashboardApp.island';
import '#shared/styles/global.css';

const dashboardEl = document.getElementById('dashboard-app');
if (dashboardEl) {
  createRoot(dashboardEl).render(<DashboardApp />);
}

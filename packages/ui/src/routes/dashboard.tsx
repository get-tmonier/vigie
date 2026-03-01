import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage } from '../pages/dashboard/ui/DashboardPage.js';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

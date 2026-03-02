import { createFileRoute, redirect } from '@tanstack/react-router';
import { authClient } from '#shared/api/auth-client';
import { DashboardPage } from '../pages/dashboard/ui/DashboardPage';

export const Route = createFileRoute('/dashboard')({
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession();
    if (!session) {
      throw redirect({ to: '/login' });
    }
  },
  component: DashboardPage,
});

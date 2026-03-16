import { API_BASE } from '#shared/api/client';

export function createDaemonEventSource(daemonId: string): EventSource {
  return new EventSource(`${API_BASE}/daemons/${daemonId}/events`, { withCredentials: true });
}

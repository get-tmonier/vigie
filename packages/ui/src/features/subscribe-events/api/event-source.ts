import { API_BASE } from '../../../shared/api/client.js';

export function createDaemonEventSource(daemonId: string): EventSource {
  return new EventSource(`${API_BASE}/daemons/${daemonId}/events`);
}

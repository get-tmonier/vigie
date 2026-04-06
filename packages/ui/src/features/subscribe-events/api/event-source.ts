import { API_BASE } from '#shared/api/client';

export function createEventSource(): EventSource {
  return new EventSource(`${API_BASE}/api/events`, { withCredentials: true });
}

import { apiFetch } from '../../../shared/api/client.js';

export interface DaemonSession {
  id: string;
  hostname: string;
  pid: number;
  version: string;
  connectedAt: number;
}

interface ListDaemonsResponse {
  daemons: DaemonSession[];
}

export async function listDaemons(): Promise<DaemonSession[]> {
  const data = await apiFetch<ListDaemonsResponse>('/daemons');
  return data.daemons;
}

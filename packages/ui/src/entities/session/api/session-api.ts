import { apiFetch } from '#shared/api/client';

export interface AgentSession {
  id: string;
  daemonId: string;
  agentType: 'claude' | 'opencode' | 'generic';
  cwd: string;
  gitBranch?: string;
  repoName?: string;
  startedAt: number;
  status: 'active' | 'ended';
}

export async function listSessions(daemonId: string): Promise<AgentSession[]> {
  const data = await apiFetch<{ sessions: AgentSession[] }>(`/daemons/${daemonId}/sessions`);
  return data.sessions;
}

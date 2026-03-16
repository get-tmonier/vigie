import { apiFetch } from '#shared/api/client';

export interface AgentSession {
  id: string;
  daemonId: string;
  agentType: 'claude' | 'opencode' | 'generic';
  mode: 'prompt' | 'interactive';
  cwd: string;
  gitBranch?: string;
  repoName?: string;
  startedAt: number;
  status: 'active' | 'ended';
  claudeSessionId?: string;
  exitCode?: number;
  resumable?: boolean;
}

export async function listSessions(daemonId: string): Promise<AgentSession[]> {
  const data = await apiFetch<{ sessions: AgentSession[] }>(`/daemons/${daemonId}/sessions`);
  return data.sessions;
}

export async function spawnSession(
  daemonId: string,
  options: {
    agentType?: 'claude' | 'opencode' | 'generic';
    cwd?: string;
    cols?: number;
    rows?: number;
  }
): Promise<{ sessionId: string }> {
  return apiFetch<{ sessionId: string }>(`/daemons/${daemonId}/sessions`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function resumeSession(
  daemonId: string,
  sessionId: string
): Promise<{ sessionId: string }> {
  return apiFetch<{ sessionId: string }>(`/daemons/${daemonId}/sessions/${sessionId}/resume`, {
    method: 'POST',
  });
}

export async function killSession(daemonId: string, sessionId: string): Promise<void> {
  await apiFetch(`/daemons/${daemonId}/sessions/${sessionId}/kill`, {
    method: 'POST',
  });
}

export async function deleteSession(daemonId: string, sessionId: string): Promise<void> {
  await apiFetch(`/daemons/${daemonId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function clearEndedSessions(daemonId: string): Promise<{ deletedCount: number }> {
  return apiFetch<{ deletedCount: number }>(`/daemons/${daemonId}/sessions/clear-ended`, {
    method: 'POST',
  });
}

export async function killAllSessions(daemonId: string): Promise<{ killedCount: number }> {
  return apiFetch<{ killedCount: number }>(`/daemons/${daemonId}/sessions/kill-all`, {
    method: 'POST',
  });
}

export interface FsEntry {
  name: string;
  isDirectory: boolean;
}

export async function listDirectory(
  daemonId: string,
  path: string
): Promise<{ entries: FsEntry[]; error?: string }> {
  return apiFetch<{ entries: FsEntry[]; error?: string }>(`/daemons/${daemonId}/fs/list`, {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

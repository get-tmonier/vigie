import { apiFetch } from '#shared/api/client';

export interface AgentSession {
  id: string;
  agentType: string;
  mode: string;
  cwd: string;
  gitBranch?: string;
  repoName?: string;
  startedAt: number;
  endedAt?: number;
  status: 'active' | 'ended' | 'error';
  claudeSessionId?: string;
  exitCode?: number;
  resumable?: boolean;
}

export async function listSessions(): Promise<AgentSession[]> {
  const data = await apiFetch<{ sessions: AgentSession[] }>('/api/sessions');
  return data.sessions;
}

export async function spawnSession(options: {
  agentType?: string;
  cwd?: string;
  cols?: number;
  rows?: number;
}): Promise<{ sessionId: string }> {
  return apiFetch<{ sessionId: string }>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export async function resumeSession(sessionId: string): Promise<{ sessionId: string }> {
  return apiFetch<{ sessionId: string }>(`/api/sessions/${sessionId}/resume`, {
    method: 'POST',
  });
}

export async function killSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}/kill`, {
    method: 'POST',
  });
}

export async function deleteSession(sessionId: string): Promise<void> {
  await apiFetch(`/api/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function clearEndedSessions(): Promise<{ deletedCount: number }> {
  return apiFetch<{ deletedCount: number }>('/api/sessions/clear-ended', {
    method: 'POST',
  });
}

export async function killAllSessions(): Promise<{ killedCount: number }> {
  return apiFetch<{ killedCount: number }>('/api/sessions/kill-all', {
    method: 'POST',
  });
}

export interface FsEntry {
  name: string;
  isDirectory: boolean;
}

export async function listDirectory(path: string): Promise<{ entries: FsEntry[]; error?: string }> {
  return apiFetch<{ entries: FsEntry[]; error?: string }>('/api/fs/list', {
    method: 'POST',
    body: JSON.stringify({ path }),
  });
}

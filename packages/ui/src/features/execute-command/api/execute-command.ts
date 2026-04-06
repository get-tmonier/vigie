import { apiFetch } from '#shared/api/client';

interface ExecResponse {
  commandId: string;
}

export async function executeCommand(command: string, cwd?: string): Promise<string> {
  const data = await apiFetch<ExecResponse>('/api/exec', {
    method: 'POST',
    body: JSON.stringify({ command, cwd }),
  });
  return data.commandId;
}

import { apiFetch } from '#shared/api/client';

interface ExecResponse {
  commandId: string;
}

export async function executeCommand(
  daemonId: string,
  command: string,
  cwd?: string
): Promise<string> {
  const data = await apiFetch<ExecResponse>(`/daemons/${daemonId}/exec`, {
    method: 'POST',
    body: JSON.stringify({ command, cwd }),
  });
  return data.commandId;
}

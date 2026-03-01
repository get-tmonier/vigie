import { useCallback, useState } from 'react';
import { executeCommand } from '../api/execute-command';

export function useExecuteCommand(daemonId: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (command: string, cwd?: string) => {
      if (!daemonId) return;
      setLoading(true);
      setError(null);
      try {
        await executeCommand(daemonId, command, cwd);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [daemonId]
  );

  return { execute, loading, error };
}

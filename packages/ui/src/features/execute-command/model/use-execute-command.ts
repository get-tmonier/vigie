import { useCallback, useState } from 'react';
import { executeCommand } from '../api/execute-command';

export function useExecuteCommand() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (command: string, cwd?: string) => {
    setLoading(true);
    setError(null);
    try {
      await executeCommand(command, cwd);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  return { execute, loading, error };
}

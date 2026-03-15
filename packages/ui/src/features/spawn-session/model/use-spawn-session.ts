import { useCallback, useState } from 'react';
import { spawnSession } from '#entities/session/api/session-api';

interface UseSpawnSessionResult {
  spawn: (
    daemonId: string,
    options: { agentType?: 'claude' | 'opencode' | 'generic'; cwd?: string }
  ) => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

export function useSpawnSession(): UseSpawnSessionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = useCallback(
    async (
      daemonId: string,
      options: { agentType?: 'claude' | 'opencode' | 'generic'; cwd?: string }
    ): Promise<string | null> => {
      setLoading(true);
      setError(null);
      try {
        const result = await spawnSession(daemonId, {
          agentType: options.agentType ?? 'claude',
          cwd: options.cwd,
        });
        return result.sessionId;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to spawn session');
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { spawn, loading, error };
}

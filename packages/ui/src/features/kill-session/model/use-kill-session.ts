import { useCallback, useState } from 'react';
import { killSession } from '#entities/session/api/session-api';

interface UseKillSessionResult {
  kill: (daemonId: string, sessionId: string) => Promise<boolean>;
  loading: boolean;
}

export function useKillSession(): UseKillSessionResult {
  const [loading, setLoading] = useState(false);

  const kill = useCallback(async (daemonId: string, sessionId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await killSession(daemonId, sessionId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { kill, loading };
}

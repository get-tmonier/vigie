import { useCallback, useState } from 'react';
import { killAllSessions } from '#entities/session/api/session-api';

interface UseKillAllSessionsResult {
  killAll: () => Promise<boolean>;
  loading: boolean;
}

export function useKillAllSessions(): UseKillAllSessionsResult {
  const [loading, setLoading] = useState(false);

  const killAll = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      await killAllSessions();
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { killAll, loading };
}

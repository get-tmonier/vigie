import { useCallback, useState } from 'react';
import { clearEndedSessions } from '#entities/session/api/session-api';

interface UseClearEndedSessionsResult {
  clear: (daemonId: string) => Promise<boolean>;
  loading: boolean;
}

export function useClearEndedSessions(): UseClearEndedSessionsResult {
  const [loading, setLoading] = useState(false);

  const clear = useCallback(async (daemonId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await clearEndedSessions(daemonId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { clear, loading };
}

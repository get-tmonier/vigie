import { useCallback, useState } from 'react';
import { deleteSession } from '#entities/session/api/session-api';

interface UseDeleteSessionResult {
  remove: (daemonId: string, sessionId: string) => Promise<boolean>;
  loading: boolean;
}

export function useDeleteSession(): UseDeleteSessionResult {
  const [loading, setLoading] = useState(false);

  const remove = useCallback(async (daemonId: string, sessionId: string): Promise<boolean> => {
    setLoading(true);
    try {
      await deleteSession(daemonId, sessionId);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { remove, loading };
}

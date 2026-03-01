import { useEffect, useState } from 'react';
import { type DaemonSession, listDaemons } from '../api/daemon-api.js';

export function useDaemons() {
  const [daemons, setDaemons] = useState<DaemonSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const poll = async () => {
      try {
        const result = await listDaemons();
        if (active) {
          setDaemons(result);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };

    poll();
    const interval = setInterval(poll, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return { daemons, loading };
}

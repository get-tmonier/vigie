import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import { useKillSession } from '../model/use-kill-session';

interface KillSessionButtonProps {
  daemonId: string;
  sessionId: string;
}

export function KillSessionButton({ daemonId, sessionId }: KillSessionButtonProps) {
  const { kill, loading } = useKillSession();
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (armed) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setArmed(false);
      await kill(daemonId, sessionId);
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    }
  }, [armed, kill, daemonId, sessionId]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'text-xs font-mono px-2 py-1 rounded transition-colors',
        armed
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-slate hover:text-red-400 hover:bg-navy-light',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? '...' : armed ? 'Confirm?' : 'Kill'}
    </button>
  );
}

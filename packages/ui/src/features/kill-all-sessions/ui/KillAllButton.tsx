import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import { useKillAllSessions } from '../model/use-kill-all-sessions';

interface KillAllButtonProps {
  daemonId: string;
  activeCount: number;
}

export function KillAllButton({ daemonId, activeCount }: KillAllButtonProps) {
  const { killAll, loading } = useKillAllSessions();
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
      await killAll(daemonId);
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    }
  }, [armed, killAll, daemonId]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || activeCount === 0}
      className={cn(
        'text-xs font-mono px-1.5 py-0.5 rounded transition-colors',
        armed
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-slate hover:text-red-400 hover:bg-navy-light',
        (loading || activeCount === 0) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? '...' : armed ? 'Kill all?' : `Kill all (${activeCount})`}
    </button>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import { useClearEndedSessions } from '../model/use-clear-ended-sessions';

interface ClearEndedButtonProps {
  daemonId: string;
  endedCount: number;
  onCleared: () => void;
}

export function ClearEndedButton({ daemonId, endedCount, onCleared }: ClearEndedButtonProps) {
  const { clear, loading } = useClearEndedSessions();
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
      const success = await clear(daemonId);
      if (success) onCleared();
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    }
  }, [armed, clear, daemonId, onCleared]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading || endedCount === 0}
      className={cn(
        'text-xs font-mono px-1.5 py-0.5 rounded-md transition-colors',
        armed
          ? 'bg-red-500 text-white hover:bg-red-600'
          : 'text-cream-200 hover:text-cream-50 hover:bg-navy-700',
        (loading || endedCount === 0) && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? '...' : armed ? 'Clear all?' : `Clear (${endedCount})`}
    </button>
  );
}

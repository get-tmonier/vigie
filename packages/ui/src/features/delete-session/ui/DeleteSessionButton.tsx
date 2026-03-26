import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import { useDeleteSession } from '../model/use-delete-session';

interface DeleteSessionButtonProps {
  daemonId: string;
  sessionId: string;
  onDeleted: () => void;
}

export function DeleteSessionButton({ daemonId, sessionId, onDeleted }: DeleteSessionButtonProps) {
  const { remove, loading } = useDeleteSession();
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
      const success = await remove(daemonId, sessionId);
      if (success) onDeleted();
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), 3000);
    }
  }, [armed, remove, daemonId, sessionId, onDeleted]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className={cn(
        'text-xs font-mono px-2 py-1 rounded transition-colors',
        armed
          ? 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_8px_rgba(239,68,68,0.3)] rounded-md'
          : 'text-cream-200 hover:text-red-400 hover:bg-navy-700',
        loading && 'opacity-50 cursor-not-allowed'
      )}
    >
      {loading ? '...' : armed ? 'Confirm?' : 'Delete'}
    </button>
  );
}

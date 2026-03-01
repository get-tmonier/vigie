import { cn } from '../lib/cn.js';

interface StatusBadgeProps {
  status: 'connected' | 'disconnected';
  label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const isConnected = status === 'connected';
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          isConnected ? 'bg-success animate-pulse' : 'bg-error'
        )}
      />
      <span className="text-xs text-slate">{label}</span>
    </span>
  );
}

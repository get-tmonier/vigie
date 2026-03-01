import { cn } from '../../../shared/lib/cn.js';
import { StatusBadge } from '../../../shared/ui/StatusBadge.js';
import type { DaemonSession } from '../api/daemon-api.js';

interface DaemonCardProps {
  daemon: DaemonSession;
  selected: boolean;
  onSelect: () => void;
}

export function DaemonCard({ daemon, selected, onSelect }: DaemonCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-1 px-4 py-3 rounded-md cursor-pointer text-left w-full text-inherit font-inherit border',
        selected ? 'bg-navy-light border-gold' : 'bg-navy-mid border-navy-light'
      )}
    >
      <span className="font-mono text-sm text-cream font-semibold">{daemon.hostname}</span>
      <span className="flex justify-between items-center">
        <span className="text-xs text-slate">v{daemon.version}</span>
        <StatusBadge status="connected" label="online" />
      </span>
    </button>
  );
}

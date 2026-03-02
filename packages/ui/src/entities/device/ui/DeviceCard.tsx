import { cn } from '#shared/lib/cn';
import { StatusBadge } from '#shared/ui/StatusBadge';
import type { Device } from '../api/device-api';

interface DeviceCardProps {
  device: Device;
  selected: boolean;
  onSelect: () => void;
}

export function DeviceCard({ device, selected, onSelect }: DeviceCardProps) {
  const isOnline = device.status === 'online';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isOnline}
      className={cn(
        'flex flex-col gap-1 px-4 py-3 rounded-md text-left w-full text-inherit font-inherit border transition-colors',
        isOnline ? 'cursor-pointer' : 'cursor-default opacity-50',
        selected ? 'bg-navy-light border-gold' : 'bg-navy-mid border-navy-light'
      )}
    >
      <span className="font-mono text-sm text-cream font-semibold">{device.hostname}</span>
      <span className="flex justify-between items-center">
        {isOnline && device.version ? (
          <span className="text-xs text-slate">v{device.version}</span>
        ) : (
          <span />
        )}
        <StatusBadge status={isOnline ? 'connected' : 'disconnected'} label={device.status} />
      </span>
    </button>
  );
}

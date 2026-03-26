import { useEffect, useRef, useState } from 'react';
import type { Device } from '#entities/device/api/device-api';
import { useDevices } from '#entities/device/model/use-devices';
import { cn } from '#shared/lib/cn';

interface DeviceSelectorProps {
  selectedId: string | null;
  onSelect: (daemonId: string) => void;
}

export function DeviceSelector({ selectedId, onSelect }: DeviceSelectorProps) {
  const { devices, loading } = useDevices();
  const [open, setOpen] = useState(false);
  const autoSelectedRef = useRef(false);

  const onlineDevices = devices.filter((d) => d.status === 'online' && d.daemonId);
  const selected = selectedId ? devices.find((d) => d.daemonId === selectedId) : undefined;

  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (!selectedId && onlineDevices.length > 0 && onlineDevices[0].daemonId) {
      autoSelectedRef.current = true;
      onSelect(onlineDevices[0].daemonId);
    }
  }, [selectedId, onlineDevices, onSelect]);

  if (loading) {
    return <span className="text-xs text-cream-200 px-3 py-1">Loading...</span>;
  }

  if (devices.length === 0) {
    return <span className="text-xs text-cream-200 px-3 py-1">No devices connected</span>;
  }

  if (onlineDevices.length <= 1) {
    const device = selected ?? onlineDevices[0];
    if (!device) {
      return <span className="text-xs text-cream-200 px-3 py-1">No devices online</span>;
    }
    return (
      <span className="flex items-center gap-2 px-3 py-1 h-8 max-w-[220px]">
        <span className="w-2 h-2 rounded-full bg-success shrink-0" />
        <span className="text-[0.75rem] text-cream-50 font-mono truncate" title={device.hostname}>
          {device.hostname}
        </span>
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1 h-8 max-w-[220px] rounded hover:bg-navy-700 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-success shrink-0" />
        <span
          className="text-[0.75rem] text-cream-50 font-mono truncate"
          title={selected?.hostname ?? 'Select device'}
        >
          {selected?.hostname ?? 'Select device'}
        </span>
        <span className="text-xs text-cream-200">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-10 cursor-default"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setOpen(false);
            }}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-navy-800 border border-navy-700 rounded shadow-lg min-w-48">
            {devices.map((device) => (
              <DeviceOption
                key={device.id}
                device={device}
                selected={device.daemonId === selectedId}
                onSelect={() => {
                  if (device.daemonId) {
                    onSelect(device.daemonId);
                    setOpen(false);
                  }
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DeviceOption({
  device,
  selected,
  onSelect,
}: {
  device: Device;
  selected: boolean;
  onSelect: () => void;
}) {
  const isOnline = device.status === 'online';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isOnline}
      className={cn(
        'flex items-center gap-2 w-full px-3 py-2 text-left transition-colors',
        isOnline ? 'hover:bg-navy-700 cursor-pointer' : 'opacity-50 cursor-default',
        selected && 'bg-navy-700'
      )}
    >
      <span
        className={cn('w-2 h-2 rounded-full shrink-0', isOnline ? 'bg-success' : 'bg-cream-200')}
      />
      <span className="text-sm text-cream-50 font-mono truncate">{device.hostname}</span>
      {isOnline && device.version && (
        <span className="text-xs text-cream-200 ml-auto">v{device.version}</span>
      )}
    </button>
  );
}

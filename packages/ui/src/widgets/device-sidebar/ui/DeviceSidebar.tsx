import { useDevices } from '#entities/device/model/use-devices';
import { DeviceCard } from '#entities/device/ui/DeviceCard';

interface DeviceSidebarProps {
  selectedId: string | null;
  onSelect: (daemonId: string) => void;
}

export function DeviceSidebar({ selectedId, onSelect }: DeviceSidebarProps) {
  const { devices, loading } = useDevices();

  return (
    <aside className="w-64 border-r border-navy-light p-4 flex flex-col gap-2 overflow-y-auto">
      <h2 className="font-vollkorn-sc text-sm text-gold mb-2 uppercase tracking-wide">Devices</h2>
      {loading && <span className="text-xs text-slate">Loading...</span>}
      {!loading && devices.length === 0 && (
        <span className="text-xs text-slate">No devices registered</span>
      )}
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          selected={device.daemonId === selectedId}
          onSelect={() => {
            if (device.daemonId) onSelect(device.daemonId);
          }}
        />
      ))}
    </aside>
  );
}

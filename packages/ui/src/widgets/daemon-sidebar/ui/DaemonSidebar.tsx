import { useDaemons } from '#entities/daemon/model/use-daemons';
import { DaemonCard } from '#entities/daemon/ui/DaemonCard';

interface DaemonSidebarProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function DaemonSidebar({ selectedId, onSelect }: DaemonSidebarProps) {
  const { daemons, loading } = useDaemons();

  return (
    <aside className="w-64 border-r border-navy-light p-4 flex flex-col gap-2 overflow-y-auto">
      <h2 className="font-vollkorn-sc text-sm text-gold mb-2 uppercase tracking-wide">Daemons</h2>
      {loading && <span className="text-xs text-slate">Loading...</span>}
      {!loading && daemons.length === 0 && (
        <span className="text-xs text-slate">No daemons connected</span>
      )}
      {daemons.map((daemon) => (
        <DaemonCard
          key={daemon.id}
          daemon={daemon}
          selected={daemon.id === selectedId}
          onSelect={() => onSelect(daemon.id)}
        />
      ))}
    </aside>
  );
}

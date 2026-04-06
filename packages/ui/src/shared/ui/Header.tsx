import { RadarIcon } from '#shared/ui/RadarIcon';

export function Header() {
  return (
    <header className="flex items-center justify-between px-6 py-3 bg-navy-800 shadow-[0_1px_0_0_rgba(22,45,74,0.8),0_4px_12px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2">
        <RadarIcon size={20} className="shrink-0" />
        <span className="font-display text-xl text-vigie-400">vigie</span>
      </div>
    </header>
  );
}

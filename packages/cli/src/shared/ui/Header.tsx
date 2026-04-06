import { RadarIcon } from '#shared/ui/RadarIcon.js';

export function Header() {
  return (
    <header className="flex items-center gap-2 px-3 py-2.5 shadow-[0_1px_0_0_rgba(22,45,74,0.8)]">
      <RadarIcon size={18} className="shrink-0" />
      <span className="font-display text-lg text-vigie-400">vigie</span>
    </header>
  );
}

import { useNavigate } from '@tanstack/react-router';
import { signOut, useSession } from '#shared/api/auth-client';
import { RadarIcon } from '#shared/ui/RadarIcon';

export function Header() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-navy-800 shadow-[0_1px_0_0_rgba(22,45,74,0.8),0_4px_12px_rgba(0,0,0,0.15)]">
      <div className="flex items-center gap-2">
        <RadarIcon size={20} className="shrink-0" />
        <span className="font-display text-xl text-vigie-400">vigie</span>
      </div>
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="font-mono text-[0.75rem] text-cream-200/50">{session.user.email}</span>
          <button
            type="button"
            className="font-mono text-[0.7rem] text-cream-200/40 hover:text-cream-50 transition-all duration-150 hover:bg-navy-700 rounded-md px-2.5 py-1"
            onClick={async () => {
              await signOut();
              navigate({ to: '/login' });
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  );
}

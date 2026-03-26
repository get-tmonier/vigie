import { useNavigate } from '@tanstack/react-router';
import { signOut, useSession } from '#shared/api/auth-client';

export function Header() {
  const { data: session } = useSession();
  const navigate = useNavigate();

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-navy-mid border-b border-navy-light">
      <h1 className="font-vollkorn-sc text-xl font-bold text-gold m-0">vigie</h1>
      {session?.user && (
        <div className="flex items-center gap-4">
          <span className="font-mono text-sm text-cream/70">{session.user.email}</span>
          <button
            type="button"
            className="font-mono text-sm text-cream/50 hover:text-cream transition-colors"
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

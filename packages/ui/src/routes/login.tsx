import { createFileRoute, useNavigate } from '@tanstack/react-router';
import * as v from 'valibot';
import { signIn, useSession } from '#shared/api/auth-client';
import { isSafeRedirect } from '#shared/lib/is-safe-redirect';
import { RadarIcon } from '#shared/ui/RadarIcon';

const LoginSearchSchema = v.object({
  callbackURL: v.optional(v.string()),
});

export const Route = createFileRoute('/login')({
  validateSearch: (search) => v.parse(LoginSearchSchema, search),
  component: LoginPage,
});

function LoginPage() {
  const { callbackURL } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const navigate = useNavigate();
  const safeCallback = callbackURL && isSafeRedirect(callbackURL) ? callbackURL : undefined;

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="font-body text-cream-50/60">Loading...</p>
      </div>
    );
  }

  if (session) {
    if (safeCallback) {
      window.location.href = safeCallback;
      return null;
    }
    navigate({ to: '/dashboard' });
    return null;
  }

  const redirectAfterAuth = safeCallback ?? `${window.location.origin}/dashboard`;

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-8"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(38,192,154,0.05) 0%, transparent 55%)',
      }}
    >
      <div className="flex flex-col items-center gap-2">
        <RadarIcon size={64} />
        <h1 className="font-display text-4xl text-vigie-400">vigie</h1>
        <p className="flex items-center gap-2 font-mono text-xs text-vigie-400/50">
          <span>/vi.ʒi/</span>
          <span className="text-cream-200/25">—</span>
          <span className="font-display italic text-cream-200/50 text-sm">the lookout</span>
        </p>
        <p className="font-body text-lg text-cream-50/80">Your agents, watched.</p>
      </div>
      <button
        type="button"
        className="rounded-lg bg-vigie-400 px-6 py-3 font-body text-sm font-semibold text-navy-900 transition-all hover:bg-vigie-500 shadow-[0_1px_2px_rgba(0,0,0,0.15),0_4px_12px_rgba(38,192,154,0.2)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.2),0_8px_24px_rgba(38,192,154,0.25)]"
        onClick={() => signIn.social({ provider: 'github', callbackURL: redirectAfterAuth })}
      >
        Sign in with GitHub
      </button>
    </div>
  );
}

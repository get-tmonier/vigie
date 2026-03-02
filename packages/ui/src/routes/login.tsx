import { createFileRoute, useNavigate } from '@tanstack/react-router';
import * as v from 'valibot';
import { signIn, useSession } from '#shared/api/auth-client';
import { isSafeRedirect } from '#shared/lib/is-safe-redirect';

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
        <p className="font-source-serif text-cream/60">Loading...</p>
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="font-vollkorn-sc text-4xl font-bold text-gold">tmonier</h1>
        <p className="font-source-serif text-lg text-cream/80">Your crew. Under your watch.</p>
      </div>
      <button
        type="button"
        className="rounded-lg bg-gold px-6 py-3 font-mono text-sm font-semibold text-navy-deep transition-colors hover:bg-gold/90"
        onClick={() => signIn.social({ provider: 'github', callbackURL: redirectAfterAuth })}
      >
        Sign in with GitHub
      </button>
    </div>
  );
}

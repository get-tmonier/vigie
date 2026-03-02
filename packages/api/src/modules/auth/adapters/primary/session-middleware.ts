import { createMiddleware } from 'hono/factory';
import { auth } from '#modules/auth/auth-instance';

type SessionUser = typeof auth.$Infer.Session.user;
type Session = typeof auth.$Infer.Session.session;

export type AuthEnv = {
  Variables: {
    user: SessionUser | null;
    session: Session | null;
  };
};

export const sessionMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  c.set('user', session?.user ?? null);
  c.set('session', session?.session ?? null);
  await next();
});

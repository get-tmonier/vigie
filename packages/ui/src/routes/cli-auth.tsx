import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import * as v from 'valibot';
import { createApiKey, deleteApiKey, listApiKeys } from '#shared/api/api-keys-api';
import { useSession } from '#shared/api/auth-client';
import { RadarIcon } from '#shared/ui/RadarIcon';

const CliAuthSearchSchema = v.object({
  port: v.pipe(
    v.union([v.number(), v.pipe(v.string(), v.transform(Number))]),
    v.integer(),
    v.minValue(1),
    v.maxValue(65535)
  ),
  state: v.pipe(v.string(), v.minLength(1), v.maxLength(256)),
  hostname: v.optional(v.pipe(v.string(), v.maxLength(253)), 'unknown'),
});

export const Route = createFileRoute('/cli-auth')({
  validateSearch: (search) => v.parse(CliAuthSearchSchema, search),
  component: CliAuthPage,
});

function CliAuthPage() {
  const { port, state, hostname } = Route.useSearch();
  const { data: session, isPending } = useSession();
  const [status, setStatus] = useState('Checking authentication...');
  const handledRef = useRef(false);

  useEffect(() => {
    if (isPending || handledRef.current) return;

    if (!session) {
      sessionStorage.setItem('cli-auth-params', JSON.stringify({ port, state, hostname }));
      window.location.href = `/login?callbackURL=${encodeURIComponent(window.location.href)}`;
      return;
    }

    handledRef.current = true;
    provisionKey();

    async function provisionKey() {
      try {
        setStatus('Creating API key...');
        const keyName = `CLI (${hostname})`;
        const existingKeys = await listApiKeys();
        const duplicates = existingKeys.filter((k) => k.name === keyName);
        await Promise.all(duplicates.map((k) => deleteApiKey(k.id)));
        const result = await createApiKey(keyName);
        setStatus('Redirecting to CLI...');
        window.location.href = `http://127.0.0.1:${port}/callback?key=${encodeURIComponent(result.key)}&state=${encodeURIComponent(state)}`;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setStatus(`Error: ${message}`);
        window.location.href = `http://127.0.0.1:${port}/callback?error=${encodeURIComponent(message)}&state=${encodeURIComponent(state)}`;
      }
    }
  }, [isPending, session, port, state, hostname]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(38,192,154,0.05) 0%, transparent 55%)',
      }}
    >
      <RadarIcon size={48} />
      <h1 className="font-display text-2xl text-vigie-400">vigie</h1>
      <p className="font-body text-cream-50/80">{status}</p>
    </div>
  );
}

import { hostname } from 'node:os';
import { config } from '../config.js';
import { saveCredentials } from '../credentials.js';
import { start } from './start.js';

const LOGIN_TIMEOUT_MS = 120_000;

export async function login() {
  const tokenFlag = process.argv.indexOf('--token');
  if (tokenFlag !== -1 && process.argv[tokenFlag + 1]) {
    const token = process.argv[tokenFlag + 1];
    return manualLogin(token);
  }

  return browserLogin();
}

async function manualLogin(token: string) {
  if (!token.startsWith('tmonier_')) {
    console.error('Invalid token format. API keys must start with "tmonier_".');
    process.exit(1);
  }
  await saveCredentials(token);
  console.log('Credentials saved to ~/.tmonier/credentials.json');
}

async function browserLogin() {
  const state = crypto.randomUUID();
  let server: ReturnType<typeof Bun.serve> | undefined;
  const appUrl = config.TMONIER_APP_URL;

  const handler = createCallbackHandler(state);

  const result = await Promise.race([
    new Promise<{ key: string }>((resolve, reject) => {
      server = Bun.serve({
        hostname: '127.0.0.1',
        port: 0,
        fetch(req) {
          const res = handler(req);
          if (res instanceof Response) {
            if (res.status >= 400) reject(new Error('Callback failed'));
            return res;
          }
          resolve(res);
          return new Response(
            html(
              'Authenticated',
              'You can close this tab and return to your terminal.',
              `${appUrl}/dashboard`
            ),
            { headers: { 'Content-Type': 'text/html' } }
          );
        },
      });

      const port = server.port;
      const authUrl = `${appUrl}/cli-auth?port=${port}&state=${state}&hostname=${encodeURIComponent(hostname())}`;

      console.log('Opening browser for authentication...');
      console.log(`If the browser doesn't open, visit: ${authUrl}`);

      openBrowser(authUrl);
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Login timed out after 120 seconds')), LOGIN_TIMEOUT_MS)
    ),
  ]);

  await saveCredentials(result.key);
  console.log('Login successful! Credentials saved to ~/.tmonier/credentials.json');
  setTimeout(() => {
    server?.stop();
    start();
  }, 3_000);
}

export function createCallbackHandler(state: string): (req: Request) => Response | { key: string } {
  return (req: Request) => {
    const url = new URL(req.url);

    if (url.pathname !== '/callback') {
      return new Response('Not found', { status: 404 });
    }

    const returnedState = url.searchParams.get('state');
    const key = url.searchParams.get('key');
    const error = url.searchParams.get('error');

    if (returnedState !== state) {
      return new Response(html('Authentication failed', 'State mismatch. Please try again.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (error) {
      return new Response(html('Authentication failed', error), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    if (!key) {
      return new Response(html('Authentication failed', 'No API key received.'), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return { key };
  };
}

function openBrowser(url: string) {
  const cmd = process.platform === 'darwin' ? 'open' : 'xdg-open';
  Bun.spawn([cmd, url], { stdout: 'ignore', stderr: 'ignore' });
}

export function escapeHtml(str: string): string {
  return str
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function html(title: string, message: string, redirectUrl?: string) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const redirect = redirectUrl
    ? `<meta http-equiv="refresh" content="2;url=${encodeURI(redirectUrl)}"><p style="opacity:0.5;font-size:0.875rem;margin-top:1rem">Redirecting to dashboard...</p>`
    : '';
  return `<!DOCTYPE html>
<html>
<head><title>tmonier — ${safeTitle}</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0e1a;color:#f5f0e8}
.box{text-align:center;max-width:400px}h1{color:#c9a227;margin-bottom:0.5rem}p{opacity:0.8}</style></head>
<body><div class="box"><h1>${safeTitle}</h1><p>${safeMessage}</p>${redirect}</div></body>
</html>`;
}

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
<head><title>vigie — ${safeTitle}</title>
<style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#0a0e1a;color:#f5f0e8}
.box{text-align:center;max-width:400px}h1{color:#c9a227;margin-bottom:0.5rem}p{opacity:0.8}</style></head>
<body><div class="box"><h1>${safeTitle}</h1><p>${safeMessage}</p>${redirect}</div></body>
</html>`;
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

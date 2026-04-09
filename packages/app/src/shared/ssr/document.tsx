import type { ReactNode } from 'react';

type Props = { title: string; children: ReactNode };

export function Document({ title, children }: Props) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        <link rel="stylesheet" href="/client/style.css" />
      </head>
      <body>
        <div id="root">{children}</div>
        <script type="module" src="/client/entry.js" />
      </body>
    </html>
  );
}

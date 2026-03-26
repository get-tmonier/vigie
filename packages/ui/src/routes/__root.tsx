import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Provider } from 'react-redux';
import { store } from '#app/store';
import { RadarIcon } from '#shared/ui/RadarIcon';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'vigie' },
    ],
    links: [
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'stylesheet', href: '/src/app/styles/global.css' },
    ],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <RadarIcon size={48} />
      <h1 className="font-display text-4xl text-vigie-400">404</h1>
      <p className="font-body text-lg text-cream-50">Page not found.</p>
    </div>
  );
}

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Provider store={store}>
          <Outlet />
        </Provider>
        <Scripts />
      </body>
    </html>
  );
}

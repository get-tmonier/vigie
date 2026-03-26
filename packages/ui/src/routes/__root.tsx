import { createRootRoute, HeadContent, Outlet, Scripts } from '@tanstack/react-router';
import { Provider } from 'react-redux';
import { store } from '#app/store';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'vigie' },
    ],
    links: [{ rel: 'stylesheet', href: '/src/app/styles/global.css' }],
  }),
  component: RootComponent,
  notFoundComponent: NotFound,
});

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <h1 className="font-vollkorn-sc text-4xl font-bold text-gold">404</h1>
      <p className="font-source-serif text-lg text-cream">Page not found.</p>
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

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Effect } from 'effect';
import * as Layer from 'effect/Layer';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import { createFsRoutes } from '#modules/daemon/infrastructure/adapters/in/fs.routes';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

type ServerDeps = {
  appRoutes: HttpRouter.Route<any, any>[];
  clientDistPath?: string;
};

export function createRoutesLayer(deps: ServerDeps) {
  const routes = [...deps.appRoutes, ...createFsRoutes()];

  if (deps.clientDistPath && existsSync(deps.clientDistPath)) {
    const clientPath = deps.clientDistPath;

    routes.push(
      HttpRouter.route('GET', '/client/*', (request) =>
        Effect.sync(() => {
          const urlPath = new URL(request.url, 'http://localhost').pathname;
          const relative = urlPath.slice('/client/'.length);
          const filePath = join(clientPath, relative);
          if (existsSync(filePath)) {
            const ext = extname(filePath);
            const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
            const content = readFileSync(filePath);
            return HttpServerResponse.uint8Array(new Uint8Array(content), { contentType });
          }
          return HttpServerResponse.empty({ status: 404 });
        })
      )
    );
  }

  return Layer.mergeAll(HttpRouter.layer, HttpRouter.addAll(routes));
}

import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Effect } from 'effect';
import * as Layer from 'effect/Layer';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import type { AppEventPublisher } from '#modules/daemon/adapters/event-publisher.adapter';
import { createFsRoutes } from '#modules/filesystem/adapters/primary/fs.routes';
import { createSessionRoutes } from '#modules/session/adapters/primary/session.routes';
import type { SessionService } from '#modules/session/session.service';
import { createTerminalRoutes } from '#modules/terminal/adapters/primary/terminal.routes';
import type { TerminalSubscribers } from '#modules/terminal/terminal-subscribers';

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
  sessionService: SessionService;
  eventPublisher: AppEventPublisher;
  terminalSubs: TerminalSubscribers;
  clientDistPath?: string;
};

export function createRoutesLayer(deps: ServerDeps) {
  const routes = [...createSessionRoutes(deps), ...createTerminalRoutes(deps), ...createFsRoutes()];

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

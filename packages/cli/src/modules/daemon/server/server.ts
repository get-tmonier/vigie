import { existsSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { Effect } from 'effect';
import * as Layer from 'effect/Layer';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';
import { createFsRoutes } from '../../filesystem/adapters/primary/fs.routes.js';
import { createSessionRoutes } from '../../session/adapters/primary/session.routes.js';
import { createTerminalRoutes } from '../../terminal/adapters/primary/terminal.routes.js';
import type { EventBus } from '../../terminal/event-bus.js';
import type { PtyEntry } from '../../terminal/terminal.service.js';
import type { TerminalSubscribers } from '../../terminal/terminal-subscribers.js';
import type { createSessionStore } from '../persistence/session-store.js';

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
  store: ReturnType<typeof createSessionStore>;
  ptyHandles: Map<string, PtyEntry>;
  eventBus: EventBus;
  terminalSubs: TerminalSubscribers;
  spawnSession: (opts: {
    agentType: string;
    cwd: string;
    cols: number;
    rows: number;
  }) => Promise<{ sessionId: string }>;
  resumeSession: (
    sessionId: string,
    opts: { cols: number; rows: number }
  ) => Promise<{ sessionId: string }>;
  applyResizePriority: (sessionId: string) => { cols: number; rows: number } | null;
  inputLineBufferWrite: (sessionId: string, base64Data: string, source: 'cli' | 'browser') => void;
  uiDistPath?: string;
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

  if (deps.uiDistPath && existsSync(deps.uiDistPath)) {
    const uiPath = deps.uiDistPath;

    routes.push(
      HttpRouter.route('GET', '/spa/*', (request) =>
        Effect.sync(() => {
          const urlPath = new URL(request.url, 'http://localhost').pathname;
          const spaRelative = urlPath.slice('/spa'.length) || '/';

          const filePath = join(uiPath, spaRelative === '/' ? 'index.html' : spaRelative);
          if (existsSync(filePath)) {
            const ext = extname(filePath);
            const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
            const content = readFileSync(filePath);
            return HttpServerResponse.uint8Array(new Uint8Array(content), { contentType });
          }

          const indexPath = join(uiPath, 'index.html');
          if (existsSync(indexPath)) {
            const content = readFileSync(indexPath);
            return HttpServerResponse.uint8Array(new Uint8Array(content), {
              contentType: 'text/html',
            });
          }

          return HttpServerResponse.empty({ status: 404 });
        })
      )
    );
  }

  return Layer.mergeAll(HttpRouter.layer, HttpRouter.addAll(routes));
}

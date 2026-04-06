import { readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { Effect } from 'effect';
import type * as Cause from 'effect/Cause';
import * as HttpRouter from 'effect/unstable/http/HttpRouter';
import type * as HttpServerError from 'effect/unstable/http/HttpServerError';
import * as HttpServerRequest from 'effect/unstable/http/HttpServerRequest';
import * as HttpServerResponse from 'effect/unstable/http/HttpServerResponse';

type RouteError = HttpServerError.HttpServerError | Cause.UnknownError | never;

function expandPath(p: string): string {
  if (p === '~' || p.startsWith('~/')) {
    return resolve(homedir(), p.slice(2) || '.');
  }
  return resolve(p);
}

const jsonRoute = <E>(
  method: 'GET' | 'POST' | 'DELETE',
  path: HttpRouter.PathInput,
  handler: Effect.Effect<
    HttpServerResponse.HttpServerResponse,
    E,
    HttpServerRequest.HttpServerRequest | HttpRouter.RouteContext
  >
) =>
  HttpRouter.route(
    method,
    path,
    handler.pipe(
      Effect.catch((err) =>
        Effect.succeed(
          HttpServerResponse.jsonUnsafe(
            { error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          )
        )
      )
    )
  );

export function createFsRoutes(): HttpRouter.Route<RouteError, never>[] {
  return [
    jsonRoute(
      'POST',
      '/api/exec',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = (yield* request.json) as { command: string; cwd?: string };
        const commandId = crypto.randomUUID();
        const resolvedCwd = body.cwd ? expandPath(body.cwd) : undefined;

        const readStream = async (stream: ReadableStream<Uint8Array> | null): Promise<string> => {
          if (!stream) return '';
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          let result = '';
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              result += decoder.decode(value, { stream: true });
            }
          } finally {
            reader.releaseLock();
          }
          return result;
        };

        const proc = Bun.spawn(['sh', '-c', body.command], {
          cwd: resolvedCwd,
          stdout: 'pipe',
          stderr: 'pipe',
        });
        const [stdout, stderr] = yield* Effect.tryPromise(() =>
          Promise.all([readStream(proc.stdout), readStream(proc.stderr)])
        );
        const exitCode = yield* Effect.tryPromise(() => proc.exited);
        return HttpServerResponse.jsonUnsafe({ commandId, stdout, stderr, exitCode });
      })
    ),

    HttpRouter.route(
      'POST',
      '/api/fs/list',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const body = (yield* request.json) as { path?: string };
        const dirPath = expandPath(body.path ?? '~');
        try {
          const items = readdirSync(dirPath, { withFileTypes: true });
          const entries = items
            .filter((item) => !item.name.startsWith('.'))
            .map((item) => ({ name: item.name, isDirectory: item.isDirectory() }))
            .sort((a, b) => {
              if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          return HttpServerResponse.jsonUnsafe({ entries });
        } catch (err) {
          return HttpServerResponse.jsonUnsafe(
            { entries: [], error: err instanceof Error ? err.message : String(err) },
            { status: 500 }
          );
        }
      })
    ),
  ];
}

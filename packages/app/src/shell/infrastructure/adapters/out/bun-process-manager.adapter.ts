import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { Effect } from 'effect';
import type { ProcessManagerShape } from '#shell/application/ports/out/process-manager.port';
import type { DaemonInfo } from '#shell/domain/daemon-info';
import {
  DaemonAlreadyRunningError,
  DaemonNotRunningError,
  DaemonStartError,
} from '#shell/domain/errors';
import type { DaemonConfigShape } from '#shell/infrastructure/daemon-config';

function readPidFile(pidFile: string): { pid: number; startedAt: number } | null {
  try {
    const lines = readFileSync(pidFile, 'utf-8').trim().split('\n');
    const pid = Number.parseInt(lines[0], 10);
    const startedAt = Number.parseInt(lines[1] ?? '0', 10);
    if (Number.isNaN(pid)) return null;
    return { pid, startedAt: Number.isNaN(startedAt) ? 0 : startedAt };
  } catch {
    return null;
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function cleanupStaleFiles(pidFile: string, socketPath: string) {
  try {
    unlinkSync(pidFile);
  } catch {}
  try {
    unlinkSync(socketPath);
  } catch {}
}

export function createBunProcessManager(config: DaemonConfigShape): ProcessManagerShape {
  return {
    start: () =>
      Effect.gen(function* () {
        mkdirSync(config.vigieHome, { recursive: true, mode: 0o700 });

        const existing = readPidFile(config.pidFile);
        if (existing !== null && isProcessAlive(existing.pid)) {
          return yield* new DaemonAlreadyRunningError({ pid: existing.pid });
        }

        if (existing !== null) {
          cleanupStaleFiles(config.pidFile, config.socketPath);
        }

        const entryPoint = new URL('../main.js', import.meta.url).pathname;
        const logFd = openSync(config.logFile, 'a');

        const proc = Bun.spawn(['bun', 'run', entryPoint], {
          env: { ...process.env, VIGIE_INTERNAL_DAEMON: '1' },
          stdin: null,
          stdout: logFd,
          stderr: logFd,
          detached: true,
        });

        closeSync(logFd);

        if (!proc.pid) {
          return yield* new DaemonStartError({ message: 'Failed to spawn daemon process' });
        }

        writeFileSync(config.pidFile, `${proc.pid}\n${Date.now()}`);

        proc.unref();

        yield* Effect.sleep('500 millis');

        if (!isProcessAlive(proc.pid)) {
          cleanupStaleFiles(config.pidFile, config.socketPath);
          return yield* new DaemonStartError({
            message: 'Daemon process exited immediately after spawn',
          });
        }

        const info: DaemonInfo = {
          pid: proc.pid,
          socketPath: config.socketPath,
          startedAt: Date.now(),
          hostname: hostname(),
          version: config.version,
        };

        return info;
      }),

    stop: () =>
      Effect.gen(function* () {
        const entry = readPidFile(config.pidFile);
        if (entry === null || !isProcessAlive(entry.pid)) {
          return yield* new DaemonNotRunningError({ message: 'No daemon is running' });
        }

        process.kill(entry.pid, 'SIGTERM');

        let attempts = 0;
        while (attempts < 10) {
          yield* Effect.sleep('500 millis');
          if (!isProcessAlive(entry.pid)) break;
          attempts++;
        }

        if (isProcessAlive(entry.pid)) {
          process.kill(entry.pid, 'SIGKILL');
          yield* Effect.sleep('500 millis');
        }

        cleanupStaleFiles(config.pidFile, config.socketPath);
      }),

    status: () =>
      Effect.gen(function* () {
        const entry = readPidFile(config.pidFile);
        if (entry === null || !isProcessAlive(entry.pid)) {
          return yield* new DaemonNotRunningError({ message: 'No daemon is running' });
        }

        const info: DaemonInfo = {
          pid: entry.pid,
          socketPath: config.socketPath,
          startedAt: entry.startedAt,
          hostname: hostname(),
          version: config.version,
        };

        return info;
      }),

    isRunning: () =>
      Effect.sync(() => {
        const entry = readPidFile(config.pidFile);
        return entry !== null && isProcessAlive(entry.pid);
      }),
  };
}

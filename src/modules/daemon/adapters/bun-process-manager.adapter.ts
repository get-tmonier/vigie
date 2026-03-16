import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { Effect } from 'effect';
import type { DaemonInfo } from '../domain/daemon-info.js';
import {
  DaemonAlreadyRunningError,
  DaemonNotRunningError,
  DaemonStartError,
} from '../domain/errors.js';
import { LOG_FILE, PID_FILE, SOCKET_PATH, TMONIER_HOME, VERSION } from '../paths.js';
import type { ProcessManagerShape } from '../ports/process-manager.port.js';

function ensureHome() {
  mkdirSync(TMONIER_HOME, { recursive: true, mode: 0o700 });
}

function readPidFile(): { pid: number; startedAt: number } | null {
  try {
    const lines = readFileSync(PID_FILE, 'utf-8').trim().split('\n');
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

function cleanupStaleFiles() {
  try {
    unlinkSync(PID_FILE);
  } catch {}
  try {
    unlinkSync(SOCKET_PATH);
  } catch {}
}

export function createBunProcessManager(): ProcessManagerShape {
  return {
    start: () =>
      Effect.gen(function* () {
        ensureHome();

        const existing = readPidFile();
        if (existing !== null && isProcessAlive(existing.pid)) {
          return yield* new DaemonAlreadyRunningError({ pid: existing.pid });
        }

        if (existing !== null) {
          cleanupStaleFiles();
        }

        const entryPoint = new URL('../main.js', import.meta.url).pathname;
        const logFd = openSync(LOG_FILE, 'a');

        const proc = Bun.spawn(['bun', 'run', entryPoint], {
          env: { ...process.env, TMONIER_INTERNAL_DAEMON: '1' },
          stdin: null,
          stdout: logFd,
          stderr: logFd,
          detached: true,
        });

        closeSync(logFd);

        if (!proc.pid) {
          return yield* new DaemonStartError({ message: 'Failed to spawn daemon process' });
        }

        writeFileSync(PID_FILE, `${proc.pid}\n${Date.now()}`);

        proc.unref();

        yield* Effect.sleep('500 millis');

        if (!isProcessAlive(proc.pid)) {
          cleanupStaleFiles();
          return yield* new DaemonStartError({
            message: 'Daemon process exited immediately after spawn',
          });
        }

        const info: DaemonInfo = {
          pid: proc.pid,
          socketPath: SOCKET_PATH,
          startedAt: Date.now(),
          hostname: hostname(),
          version: VERSION,
        };

        return info;
      }),

    stop: () =>
      Effect.gen(function* () {
        const entry = readPidFile();
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

        cleanupStaleFiles();
      }),

    status: () =>
      Effect.gen(function* () {
        const entry = readPidFile();
        if (entry === null || !isProcessAlive(entry.pid)) {
          return yield* new DaemonNotRunningError({ message: 'No daemon is running' });
        }

        const info: DaemonInfo = {
          pid: entry.pid,
          socketPath: SOCKET_PATH,
          startedAt: entry.startedAt,
          hostname: hostname(),
          version: VERSION,
        };

        return info;
      }),

    isRunning: () =>
      Effect.sync(() => {
        const entry = readPidFile();
        return entry !== null && isProcessAlive(entry.pid);
      }),
  };
}

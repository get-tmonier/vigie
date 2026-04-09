import { Effect } from 'effect';
import { AgentRunnerError } from '#modules/agent-session/domain/errors';
import type {
  PtyHandle,
  PtySpawnFn,
} from '#modules/agent-session/infrastructure/pty-manager.types';
import { createPtyLibrary } from './pty/bun-pty';

export function createBunPtySpawnFn(): PtySpawnFn {
  return (
    command: string,
    args: string[],
    cwd: string,
    cols: number,
    rows: number
  ): Effect.Effect<PtyHandle, AgentRunnerError> => {
    return Effect.try({
      try: () => {
        const pty = createPtyLibrary();

        process.chdir(cwd);

        const handle = pty.spawn(command, args, rows, cols);
        const outputCallbacks: Array<(data: Uint8Array) => void> = [];
        const buffered: Uint8Array[] = [];
        let running = true;
        let callbacksReady = false;
        let readInterval: ReturnType<typeof setInterval> | null = null;

        readInterval = setInterval(() => {
          if (!running) {
            if (readInterval) clearInterval(readInterval);
            return;
          }

          let reads = 0;
          while (reads < 100) {
            const data = pty.read(handle.fd);
            if (data === null) break;
            reads++;

            if (callbacksReady) {
              for (const cb of outputCallbacks) {
                try {
                  cb(data);
                } catch {}
              }
            } else {
              buffered.push(data.slice());
            }
          }

          if (reads === 0) {
            const { exited } = pty.waitpid(handle.pid);
            if (exited) {
              running = false;
              if (readInterval) clearInterval(readInterval);
            }
          }
        }, 5);

        const ptyHandle: PtyHandle = {
          pid: handle.pid,

          onOutput(cb) {
            outputCallbacks.push(cb);
            if (!callbacksReady) {
              callbacksReady = true;
              for (const chunk of buffered) {
                cb(chunk);
              }
              buffered.length = 0;
            }
          },

          write(data) {
            if (running) pty.write(handle.fd, data);
          },

          resize(newCols, newRows) {
            if (running) pty.resize(handle.fd, newRows, newCols);
          },

          kill() {
            if (running) {
              running = false;
              if (readInterval) clearInterval(readInterval);
              pty.kill(handle.pid, 15);
              pty.close(handle.fd);
            }
          },

          async wait() {
            while (running) {
              const { exited, exitCode } = pty.waitpid(handle.pid);
              if (exited) {
                running = false;
                if (readInterval) clearInterval(readInterval);
                pty.close(handle.fd);
                return exitCode;
              }
              await new Promise((r) => setTimeout(r, 50));
            }
            const { exitCode } = pty.waitpid(handle.pid);
            pty.close(handle.fd);
            return exitCode;
          },
        };

        return ptyHandle;
      },
      catch: (err) =>
        new AgentRunnerError({
          message: `Failed to spawn ${command}: ${err instanceof Error ? err.message : String(err)}`,
        }),
    });
  };
}

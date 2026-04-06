import { Effect } from 'effect';
import type { AgentConfig } from '#modules/session/domain/agent-config';
import { AgentRunnerError } from '#modules/session/domain/errors';
import { createPtyLibrary } from '../pty/bun-pty';

export interface InteractiveRunnerHandle {
  readonly pid: number;
  onOutput(cb: (data: Uint8Array) => void): void;
  write(data: Uint8Array): void;
  resize(cols: number, rows: number): void;
  enableStdinRelay(): void;
  wait(): Promise<number>;
  kill(): void;
  cleanup(): void;
}

export function spawnAgentInteractive(
  agent: AgentConfig,
  cwd: string,
  cols: number,
  rows: number,
  options?: { resume?: boolean; claudeSessionId?: string }
): Effect.Effect<InteractiveRunnerHandle, AgentRunnerError> {
  return Effect.try({
    try: () => {
      const pty = createPtyLibrary();

      process.chdir(cwd);

      const args = agent.buildArgs(options);
      const command = agent.command;

      const handle = pty.spawn(command, args, rows, cols);
      const outputCallbacks: Array<(data: Uint8Array) => void> = [];
      const buffered: Uint8Array[] = [];
      let running = true;
      let callbacksReady = false;
      let readInterval: ReturnType<typeof setInterval> | null = null;

      // Poll PTY output via setInterval
      readInterval = setInterval(() => {
        if (!running) {
          if (readInterval) clearInterval(readInterval);
          return;
        }

        // Drain all available PTY output in one tick
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

        // Check if child exited (only when no data was read)
        if (reads === 0) {
          const { exited } = pty.waitpid(handle.pid);
          if (exited) {
            running = false;
            if (readInterval) clearInterval(readInterval);
          }
        }
      }, 5);

      return {
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
          if (running) {
            pty.write(handle.fd, data);
          }
        },

        resize(newCols, newRows) {
          if (running) {
            pty.resize(handle.fd, newRows, newCols);
          }
        },

        enableStdinRelay() {
          pty.startStdinRelay(handle.fd);
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

        kill() {
          if (running) {
            running = false;
            if (readInterval) clearInterval(readInterval);
            pty.kill(handle.pid, 15);
            pty.close(handle.fd);
          }
        },

        cleanup() {
          pty.stopStdinRelay();
        },
      };
    },
    catch: (err) =>
      new AgentRunnerError({
        message: `Failed to spawn ${agent.name} interactive: ${err instanceof Error ? err.message : String(err)}`,
      }),
  });
}

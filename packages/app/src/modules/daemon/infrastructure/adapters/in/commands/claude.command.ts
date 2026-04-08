import { Console, Effect, Stream } from 'effect';
import { printChunk } from '#lib/cli-terminal/chunk-printer';
import { printHeader } from '#lib/cli-terminal/header';
import { printSessionSummary } from '#lib/cli-terminal/status-bar';
import { getGitContext } from '#lib/git-context';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors';
import { createClaudeRunner } from '#modules/daemon/infrastructure/adapters/out/agents/claude-runner.adapter';
import { createBunProcessManager } from '#modules/daemon/infrastructure/adapters/out/bun-process-manager.adapter';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { createUnixSocketClient } from '../unix-socket-client.adapter';

export function claudeCommand(prompt: string) {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const manager = createBunProcessManager(config);
    const running = yield* manager.isRunning();

    if (!running) {
      return yield* new DaemonNotRunningError({
        message: 'Daemon is not running. Start it with `vigie daemon start`.',
      });
    }

    const cwd = process.cwd();
    const sessionId = crypto.randomUUID();
    const gitCtx = yield* getGitContext(cwd);

    // Connect to daemon via IPC
    const client = createUnixSocketClient();
    yield* client.connect(config.socketPath);

    // Register session
    yield* client.send({
      type: 'session:register',
      sessionId,
      agentType: 'claude',
      mode: 'prompt',
      cwd,
      gitBranch: gitCtx.branch,
      gitRemoteUrl: gitCtx.remoteUrl,
      repoName: gitCtx.repoName,
    });

    yield* client.waitForMessage('session:registered');

    // Print branded header
    const daemonInfo = yield* manager.status();
    printHeader({
      sessionId,
      daemonPid: daemonInfo.pid,
      cwd,
      repoName: gitCtx.repoName,
      gitBranch: gitCtx.branch,
    });

    // Spawn Claude as Effect Stream
    const runner = createClaudeRunner();
    const startTime = Date.now();
    let inputTokens = 0;
    let outputTokens = 0;
    const services = yield* Effect.services();

    yield* runner
      .spawn({
        prompt,
        cwd,
        onSessionId: (agentSessionId) => {
          Effect.runPromiseWith(services)(
            client.send({
              type: 'session:agent-id',
              sessionId,
              agentSessionId,
            })
          ).catch(() => {});
        },
      })
      .pipe(
        Stream.tap((chunk) =>
          client.send({
            type: 'session:output',
            sessionId,
            data: chunk.data,
            chunkType: chunk.chunkType,
            timestamp: chunk.timestamp,
          })
        ),
        Stream.tap((chunk) =>
          Effect.sync(() => {
            printChunk(chunk);

            // Parse token counts from status chunks
            if (chunk.chunkType === 'status') {
              const tokenMatch = chunk.data.match(/tokens: (\d+) in \/ (\d+) out/);
              if (tokenMatch) {
                inputTokens = Number.parseInt(tokenMatch[1], 10);
                outputTokens = Number.parseInt(tokenMatch[2], 10);
              }
            }
          })
        ),
        Stream.runDrain
      );

    // Send done and print summary
    yield* client.send({
      type: 'session:done',
      sessionId,
      exitCode: 0,
      timestamp: Date.now(),
    });

    printSessionSummary(sessionId, inputTokens, outputTokens, Date.now() - startTime);

    yield* client.close();
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', (e) => Console.error(e.message)),
    Effect.catchTag('IpcConnectionError', (e) => Console.error(`IPC error: ${e.message}`)),
    Effect.catchTag('AgentRunnerError', (e) => Console.error(`Agent error: ${e.message}`)),
    Effect.ensuring(Effect.sync(() => process.exit(0)))
  );
}

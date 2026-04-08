import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { Console, Effect } from 'effect';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors';
import { createBunProcessManager } from '#modules/daemon/infrastructure/adapters/out/bun-process-manager.adapter';
import { DaemonConfig } from '#modules/daemon/infrastructure/daemon-config';
import { getGitContext } from '#shared/lib/git-context';
import { attachPtyRelay } from '../pty-relay';
import { createUnixSocketClient } from '../unix-socket-client.adapter';

interface SessionRow {
  id: string;
  agent_type: string;
  mode: string;
  status: string;
  cwd: string;
  git_branch: string | null;
  agent_session_id: string | null;
  resumable: number;
}

export function sessionResumeCommand(partialId: string) {
  return Effect.gen(function* () {
    const config = yield* DaemonConfig;
    const { dbFile, socketPath } = config;

    if (!existsSync(dbFile)) {
      yield* Console.error('No sessions found. Start the daemon first.');
      return;
    }

    const db = new Database(dbFile, { readonly: true });
    const rows = db
      .prepare('SELECT * FROM sessions WHERE id LIKE $prefix')
      .all({ $prefix: `${partialId}%` }) as SessionRow[];
    db.close();

    if (rows.length === 0) {
      yield* Console.error(`No session found matching "${partialId}".`);
      return;
    }

    if (rows.length > 1) {
      yield* Console.error(`Multiple sessions match "${partialId}". Be more specific:`);
      for (const row of rows) {
        yield* Console.error(`  ${row.id.slice(0, 8)}  ${row.status}  ${row.mode}  ${row.cwd}`);
      }
      return;
    }

    const session = rows[0];

    if (session.status !== 'ended') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} is ${session.status}. Only ended sessions can be resumed.`
      );
      return;
    }

    if (session.mode !== 'interactive') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} is in ${session.mode} mode. Only interactive sessions can be resumed.`
      );
      return;
    }

    const manager = createBunProcessManager(config);
    const running = yield* manager.isRunning();

    if (!running) {
      return yield* new DaemonNotRunningError({
        message: 'Daemon is not running. Start it with `vigie daemon start`.',
      });
    }

    const agentSessionId = session.resumable === 1 ? session.agent_session_id : null;

    const gitContext = yield* getGitContext(session.cwd);

    const cols = process.stdout.columns ?? 80;
    const rows_ = process.stdout.rows ?? 24;

    const client = createUnixSocketClient();
    yield* client.connect(socketPath);

    let resolveSpawn: () => void;
    let rejectSpawn: (error: Error) => void;
    const spawnPromise = new Promise<void>((resolve, reject) => {
      resolveSpawn = resolve;
      rejectSpawn = reject;
    });

    client.onMessage((msg) => {
      if (!('sessionId' in msg) || msg.sessionId !== session.id) return;

      switch (msg.type) {
        case 'session:spawned':
          resolveSpawn();
          break;
        case 'session:spawn-failed':
          rejectSpawn(new Error(msg.error));
          break;
        case 'session:error-response':
          rejectSpawn(new Error(msg.error));
          break;
      }
    });

    if (agentSessionId) {
      yield* client.send({
        type: 'session:resume',
        sessionId: session.id,
        agentSessionId,
        cwd: session.cwd,
        cols,
        rows: rows_,
        gitBranch: gitContext.branch,
        gitRemoteUrl: gitContext.remoteUrl,
        repoName: gitContext.repoName,
      });
    } else {
      yield* client.send({
        type: 'session:spawn-interactive',
        sessionId: session.id,
        agentType: session.agent_type,
        cwd: session.cwd,
        cols,
        rows: rows_,
        gitBranch: gitContext.branch,
        gitRemoteUrl: gitContext.remoteUrl,
        repoName: gitContext.repoName,
      });
    }

    yield* Effect.promise(() => spawnPromise);

    const infoLine = agentSessionId
      ? `Resumed from ${session.id.slice(0, 8)}`
      : `Previous session was too short-lived — fresh start`;

    const result = yield* attachPtyRelay(client, {
      sessionId: session.id,
      startedAt: Date.now(),
      infoLine,
    });

    if (result.type === 'exit') {
      yield* Console.log(`\n[session] Resumed session ended (exit ${result.exitCode})`);
    } else if (result.type === 'detach') {
      yield* Console.log(`\n[session] Detached from resumed session ${session.id.slice(0, 8)}`);
    }
  }).pipe(
    Effect.catchTag('DaemonNotRunningError', (e) => Console.error(e.message)),
    Effect.catchTag('IpcConnectionError', (e) => Console.error(`IPC error: ${e.message}`)),
    Effect.ensuring(
      Effect.sync(() => {
        process.exit(0);
      })
    )
  );
}

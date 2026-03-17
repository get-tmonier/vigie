import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Console, Effect } from 'effect';
import { createBunProcessManager } from '#modules/daemon/adapters/bun-process-manager.adapter.js';
import { DaemonNotRunningError } from '#modules/daemon/domain/errors.js';
import { DB_FILE, SOCKET_PATH } from '#modules/daemon/paths.js';
import { attachPtyRelay } from '../adapters/pty-relay.js';
import { createUnixSocketClient } from '../adapters/unix-socket-client.adapter.js';
import { getGitContext } from '../domain/git-context.js';

interface SessionRow {
  id: string;
  agent_type: string;
  mode: string;
  status: string;
  cwd: string;
  git_branch: string | null;
  claude_session_id: string | null;
}

export function sessionResumeCommand(partialId: string): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (!existsSync(DB_FILE)) {
      yield* Console.error('No sessions found. Start the daemon first.');
      return;
    }

    const db = new Database(DB_FILE, { readonly: true });
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

    if (session.agent_type !== 'claude') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} is a ${session.agent_type} session. Only Claude sessions can be resumed.`
      );
      return;
    }

    if (!session.claude_session_id) {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} has no Claude session ID stored. Cannot resume.`
      );
      return;
    }

    if (session.mode !== 'interactive') {
      yield* Console.error(
        `Session ${session.id.slice(0, 8)} is in ${session.mode} mode. Only interactive sessions can be resumed.`
      );
      return;
    }

    const manager = createBunProcessManager();
    const running = yield* manager.isRunning();

    if (!running) {
      return yield* new DaemonNotRunningError({
        message: 'Daemon is not running. Start it with `tmonier daemon start`.',
      });
    }

    // Check if the Claude session file actually exists on disk
    const projectKey = session.cwd.replace(/\//g, '-');
    const claudeSessionFile = join(
      homedir(),
      '.claude',
      'projects',
      projectKey,
      `${session.claude_session_id}.jsonl`
    );
    const canResume = existsSync(claudeSessionFile);

    const gitContext = yield* getGitContext(session.cwd);

    const cols = process.stdout.columns ?? 80;
    const rows_ = process.stdout.rows ?? 24;

    const client = createUnixSocketClient();
    yield* client.connect(SOCKET_PATH);

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

    if (canResume) {
      yield* client.send({
        type: 'session:resume',
        sessionId: session.id,
        claudeSessionId: session.claude_session_id,
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
        agentType: 'claude',
        cwd: session.cwd,
        cols,
        rows: rows_,
        gitBranch: gitContext.branch,
        gitRemoteUrl: gitContext.remoteUrl,
        repoName: gitContext.repoName,
      });
    }

    yield* Effect.promise(() => spawnPromise);

    const infoLine = canResume
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

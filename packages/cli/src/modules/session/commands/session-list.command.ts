import { Database } from 'bun:sqlite';
import { existsSync } from 'node:fs';
import { Console, Effect } from 'effect';
import { DB_FILE } from '#modules/daemon/paths.js';

interface SessionRow {
  id: string;
  agent_type: string;
  mode: string;
  cwd: string;
  git_branch: string | null;
  started_at: number;
  ended_at: number | null;
  status: string;
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  const end = endedAt ?? Date.now();
  const diff = Math.floor((end - startedAt) / 1000);
  if (diff < 60) return `${diff}s`;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function shortenPath(cwd: string): string {
  const home = process.env.HOME;
  if (home && cwd.startsWith(home)) {
    return `~${cwd.slice(home.length)}`;
  }
  return cwd;
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (isToday) {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : `${str}${' '.repeat(len - str.length)}`;
}

export function sessionListCommand(activeOnly: boolean, all: boolean): Effect.Effect<void> {
  return Effect.gen(function* () {
    if (!existsSync(DB_FILE)) {
      yield* Console.log('No sessions found. Start the daemon first.');
      return;
    }

    const db = new Database(DB_FILE, { readonly: true });

    let query = 'SELECT * FROM sessions';
    if (activeOnly) {
      query += " WHERE status = 'active'";
    }
    query += ' ORDER BY started_at DESC';
    if (!all) {
      query += ' LIMIT 20';
    }

    const rows = db.prepare(query).all() as SessionRow[];
    db.close();

    if (rows.length === 0) {
      yield* Console.log(activeOnly ? 'No active sessions.' : 'No sessions found.');
      return;
    }

    // ANSI codes
    const dim = '\x1b[2m';
    const green = '\x1b[32m';
    const reset = '\x1b[0m';

    // Header
    const header = `${padRight('ID', 10)}${padRight('Agent', 8)}${padRight('Mode', 14)}${padRight('Status', 10)}${padRight('Branch', 16)}${padRight('CWD', 28)}${padRight('Started', 18)}Duration`;
    yield* Console.log(`\n${dim}${header}${reset}`);
    yield* Console.log(`${dim}${'─'.repeat(header.length)}${reset}`);

    for (const row of rows) {
      const isActive = row.status === 'active';
      const statusIcon = isActive ? `${green}\u25CF${reset}` : `${dim}\u25CB${reset}`;
      const prefix = isActive ? '' : dim;
      const suffix = isActive ? '' : reset;

      const line = [
        `${statusIcon} ${prefix}${padRight(row.id.slice(0, 8), 9)}`,
        padRight(row.agent_type, 8),
        padRight(row.mode, 14),
        padRight(row.status, 10),
        padRight(row.git_branch ?? '-', 16),
        padRight(shortenPath(row.cwd), 28),
        padRight(formatTime(row.started_at), 18),
        `${formatDuration(row.started_at, row.ended_at)}${suffix}`,
      ].join('');

      yield* Console.log(line);
    }

    yield* Console.log('');
  });
}

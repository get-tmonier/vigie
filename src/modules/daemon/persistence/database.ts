import { Database } from 'bun:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  agent_type TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'prompt',
  cwd TEXT NOT NULL,
  git_branch TEXT,
  git_remote_url TEXT,
  repo_name TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  exit_code INTEGER
);

CREATE TABLE IF NOT EXISTS terminal_chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  data TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  seq INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terminal_session_seq ON terminal_chunks(session_id, seq);

CREATE TABLE IF NOT EXISTS input_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'cli',
  timestamp INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_input_history_session ON input_history(session_id, timestamp);

CREATE TABLE IF NOT EXISTS event_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
`;

export function openDatabase(path: string): Database {
  const db = new Database(path);
  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA synchronous = NORMAL');
  db.exec(SCHEMA);
  try {
    db.run('ALTER TABLE sessions ADD COLUMN claude_session_id TEXT');
  } catch {}
  try {
    db.run('ALTER TABLE sessions ADD COLUMN resumable INTEGER NOT NULL DEFAULT 0');
  } catch {}
  return db;
}

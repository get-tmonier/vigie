import type { Database } from 'bun:sqlite';
import { registerMigration } from '../migrator';

registerMigration({
  name: '001-initial-schema',
  up(db: Database) {
    db.exec(`
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
        exit_code INTEGER,
        agent_session_id TEXT,
        resumable INTEGER NOT NULL DEFAULT 0,
        session_type TEXT NOT NULL DEFAULT 'interactive',
        auto_advance INTEGER NOT NULL DEFAULT 0,
        current_turn_index INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0
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

      CREATE TABLE IF NOT EXISTS turns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        prompt TEXT NOT NULL,
        mode TEXT NOT NULL,
        stop_reason TEXT,
        summary TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS text_deltas (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_text_deltas_session_turn ON text_deltas(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS tool_calls (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        input TEXT NOT NULL,
        status TEXT NOT NULL,
        output TEXT,
        error TEXT,
        duration_ms INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_tool_calls_session_turn ON tool_calls(session_id, turn_index);

      CREATE TABLE IF NOT EXISTS cost_updates (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        input_tokens INTEGER NOT NULL,
        output_tokens INTEGER NOT NULL,
        cache_read_tokens INTEGER,
        cache_write_tokens INTEGER,
        total_cost_usd REAL NOT NULL,
        model_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_cost_updates_session ON cost_updates(session_id);

      CREATE TABLE IF NOT EXISTS subagent_spawns (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES sessions(id),
        turn_index INTEGER NOT NULL,
        parent_tool_call_id TEXT NOT NULL REFERENCES tool_calls(id),
        subagent_session_id TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_subagent_spawns_session ON subagent_spawns(session_id);
    `);
  },
});

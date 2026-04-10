import type { Database } from 'bun:sqlite';
import type { Kysely } from 'kysely';
import type { VigiDatabaseSchema } from './schema';

interface Migration {
  readonly name: string;
  up(db: Database): void;
}

const migrations: Migration[] = [];

export function registerMigration(migration: Migration): void {
  migrations.push(migration);
}

export function runMigrations(kysely: Kysely<VigiDatabaseSchema>, db: Database): void {
  void kysely;
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set(
    db
      .query<{ name: string }, []>('SELECT name FROM _migrations')
      .all()
      .map((r) => r.name)
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;
    migration.up(db);
    db.run('INSERT INTO _migrations (name) VALUES (?)', [migration.name]);
  }
}

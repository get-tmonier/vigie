import { Database } from 'bun:sqlite';
import { describe, expect, it } from 'bun:test';
import { Kysely } from 'kysely';
import { createBunSqliteDialect } from '../dialect';
import { runMigrations } from '../migrator';
import type { VigiDatabaseSchema } from '../schema';
import '../migrations/001-initial-schema';

describe('migrator', () => {
  it('creates migration tracking table and applies migrations', () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });

    runMigrations(db, sqlite);

    const tables = sqlite
      .query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => r.name);

    expect(tables).toContain('sessions');
    expect(tables).toContain('terminal_chunks');
    expect(tables).toContain('input_history');
    expect(tables).toContain('turns');
    expect(tables).toContain('tool_calls');
    expect(tables).toContain('cost_updates');
    expect(tables).toContain('subagent_spawns');
    expect(tables).toContain('_migrations');
  });

  it('is idempotent — running twice does not error', () => {
    const sqlite = new Database(':memory:');
    const db = new Kysely<VigiDatabaseSchema>({ dialect: createBunSqliteDialect(sqlite) });

    runMigrations(db, sqlite);
    runMigrations(db, sqlite);

    const count = sqlite
      .query<{ cnt: number }, []>('SELECT count(*) as cnt FROM _migrations')
      .get();
    expect(count?.cnt).toBe(1);
  });
});

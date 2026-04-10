import { Database } from 'bun:sqlite';
import { Layer, ServiceMap } from 'effect';
import { Kysely } from 'kysely';
import { createBunSqliteDialect } from './dialect';
import { runMigrations } from './migrator';
import type { VigiDatabaseSchema } from './schema';

// Import migrations to register them
import './migrations/001-initial-schema';

export type VigiKysely = Kysely<VigiDatabaseSchema>;

export interface VigiDatabaseServices {
  readonly sqlite: Database;
  readonly kysely: VigiKysely;
}

export class VigiDatabase extends ServiceMap.Service<VigiDatabase, VigiDatabaseServices>()(
  '@vigie/Database'
) {}

function openDatabase(path: string): VigiDatabaseServices {
  const sqlite = new Database(path);
  sqlite.run('PRAGMA journal_mode = WAL');
  sqlite.run('PRAGMA synchronous = NORMAL');

  const kysely = new Kysely<VigiDatabaseSchema>({
    dialect: createBunSqliteDialect(sqlite),
  });

  runMigrations(kysely, sqlite);

  return { sqlite, kysely };
}

export const makeDatabaseLayer = (dbFile: string) =>
  Layer.sync(VigiDatabase)(() => openDatabase(dbFile));

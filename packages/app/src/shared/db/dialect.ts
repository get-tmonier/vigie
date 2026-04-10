import type { Database, SQLQueryBindings } from 'bun:sqlite';
import {
  type CompiledQuery,
  type DatabaseConnection,
  type Dialect,
  type Driver,
  type Kysely,
  type QueryResult,
  SqliteAdapter,
  SqliteIntrospector,
  SqliteQueryCompiler,
} from 'kysely';

class BunSqliteConnection implements DatabaseConnection {
  constructor(private db: Database) {}

  async executeQuery<R>(compiledQuery: CompiledQuery): Promise<QueryResult<R>> {
    const { sql, parameters } = compiledQuery;
    const stmt = this.db.prepare(sql);
    if (sql.trimStart().toUpperCase().startsWith('SELECT') || sql.includes('RETURNING')) {
      const rows = stmt.all(...(parameters as SQLQueryBindings[])) as R[];
      return { rows };
    }
    const result = stmt.run(...(parameters as SQLQueryBindings[]));
    return {
      rows: [],
      numAffectedRows: BigInt(result.changes),
      insertId: result.lastInsertRowid !== undefined ? BigInt(result.lastInsertRowid) : undefined,
    };
  }

  streamQuery<R>(): AsyncIterableIterator<QueryResult<R>> {
    throw new Error('Streaming not supported with bun:sqlite');
  }
}

class BunSqliteDriver implements Driver {
  constructor(private db: Database) {}
  async init(): Promise<void> {}
  async acquireConnection(): Promise<DatabaseConnection> {
    return new BunSqliteConnection(this.db);
  }
  async beginTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({
      sql: 'BEGIN',
      parameters: [],
      query: { kind: 'RawNode', sqlFragments: ['BEGIN'], parameters: [] },
    } as CompiledQuery);
  }
  async commitTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({
      sql: 'COMMIT',
      parameters: [],
      query: { kind: 'RawNode', sqlFragments: ['COMMIT'], parameters: [] },
    } as CompiledQuery);
  }
  async rollbackTransaction(conn: DatabaseConnection): Promise<void> {
    await conn.executeQuery({
      sql: 'ROLLBACK',
      parameters: [],
      query: { kind: 'RawNode', sqlFragments: ['ROLLBACK'], parameters: [] },
    } as CompiledQuery);
  }
  async releaseConnection(): Promise<void> {}
  async destroy(): Promise<void> {}
}

export function createBunSqliteDialect(db: Database): Dialect {
  return {
    createAdapter: () => new SqliteAdapter(),
    createDriver: () => new BunSqliteDriver(db),
    createIntrospector: (kysely: Kysely<unknown>) => new SqliteIntrospector(kysely),
    createQueryCompiler: () => new SqliteQueryCompiler(),
  };
}

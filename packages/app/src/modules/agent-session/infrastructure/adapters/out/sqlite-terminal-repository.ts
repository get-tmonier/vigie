import type { Database } from 'bun:sqlite';
import { Effect, Layer } from 'effect';
import {
  type InputEntry,
  SessionLog,
  type SessionLogShape,
  type TerminalChunk,
} from '#modules/agent-session/application/ports/out/session-log.port';
import { VigiDatabase } from '#shared/db/database';
import type { SessionId } from '#shared/kernel/session/session-id';

function createSqliteTerminalRepository(db: Database): SessionLogShape {
  const getMaxSeqStmt = db.prepare(
    'SELECT COALESCE(MAX(seq), 0) as max_seq FROM terminal_chunks WHERE session_id = $session_id'
  );
  const appendChunkStmt = db.prepare(
    'INSERT INTO terminal_chunks (session_id, data, timestamp, seq) VALUES ($session_id, $data, $timestamp, $seq)'
  );
  const getChunksStmt = db.prepare(
    'SELECT data, timestamp, seq FROM terminal_chunks WHERE session_id = $session_id ORDER BY seq DESC LIMIT $limit'
  );
  const getAllChunksStmt = db.prepare(
    'SELECT data, timestamp, seq FROM terminal_chunks WHERE session_id = $session_id ORDER BY seq ASC'
  );
  const appendInputStmt = db.prepare(
    'INSERT INTO input_history (session_id, text, source, timestamp) VALUES ($session_id, $text, $source, $timestamp)'
  );
  const getInputHistoryStmt = db.prepare(
    'SELECT text, source, timestamp FROM input_history WHERE session_id = $session_id ORDER BY timestamp ASC LIMIT $limit'
  );

  return {
    appendChunk(sessionId: SessionId, data: string, timestamp: number): void {
      const row = getMaxSeqStmt.get({ $session_id: sessionId }) as { max_seq: number };
      appendChunkStmt.run({
        $session_id: sessionId,
        $data: data,
        $timestamp: timestamp,
        $seq: row.max_seq + 1,
      });
    },

    getChunks(sessionId: SessionId, limit: number = 500): TerminalChunk[] {
      const rows = getChunksStmt.all({
        $session_id: sessionId,
        $limit: limit,
      }) as TerminalChunk[];
      return rows.reverse();
    },

    getAllChunks(sessionId: SessionId): TerminalChunk[] {
      return getAllChunksStmt.all({ $session_id: sessionId }) as TerminalChunk[];
    },

    appendInput(sessionId: SessionId, text: string, source: string, timestamp: number): void {
      appendInputStmt.run({
        $session_id: sessionId,
        $text: text,
        $source: source,
        $timestamp: timestamp,
      });
    },

    getInputHistory(sessionId: SessionId, limit: number = 200): InputEntry[] {
      return getInputHistoryStmt.all({
        $session_id: sessionId,
        $limit: limit,
      }) as InputEntry[];
    },
  };
}

export const SqliteTerminalRepositoryLive = Layer.effect(SessionLog)(
  Effect.gen(function* () {
    const { sqlite } = yield* VigiDatabase;
    return createSqliteTerminalRepository(sqlite);
  })
);

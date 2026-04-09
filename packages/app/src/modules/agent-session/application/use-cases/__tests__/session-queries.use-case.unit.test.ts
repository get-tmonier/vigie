import { describe, expect, it } from 'bun:test';
import type {
  InputEntry,
  TerminalChunk,
  TerminalRepositoryShape,
} from '#modules/agent-session/application/ports/out/terminal-repository.port';
import { createSessionQueriesUseCase } from '#modules/agent-session/application/use-cases/session-queries.use-case';
import { Session } from '#modules/agent-session/domain/session';
import { SessionId as makeSessionId } from '#modules/agent-session/domain/session-id';
import { makeSessionRepo } from './test-helpers';

function makeTerminalRepo(): TerminalRepositoryShape & {
  chunks: Map<string, TerminalChunk[]>;
  inputs: Map<string, InputEntry[]>;
} {
  const chunks = new Map<string, TerminalChunk[]>();
  const inputs = new Map<string, InputEntry[]>();
  return {
    chunks,
    inputs,
    appendChunk: (sessionId, data, timestamp) => {
      const list = chunks.get(sessionId) ?? [];
      list.push({ data, timestamp, seq: list.length });
      chunks.set(sessionId, list);
    },
    getChunks: (sessionId, limit) => {
      const list = chunks.get(sessionId) ?? [];
      return limit !== undefined ? list.slice(-limit) : list;
    },
    getAllChunks: (sessionId) => chunks.get(sessionId) ?? [],
    appendInput: (sessionId, text, source, timestamp) => {
      const list = inputs.get(sessionId) ?? [];
      list.push({ text, source, timestamp });
      inputs.set(sessionId, list);
    },
    getInputHistory: (sessionId, limit) => {
      const list = inputs.get(sessionId) ?? [];
      return limit !== undefined ? list.slice(-limit) : list;
    },
  };
}

describe('SessionQueriesUseCase.listAll', () => {
  it('returns empty array when no sessions', () => {
    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo: makeTerminalRepo(),
    });
    expect(useCase.listAll()).toEqual([]);
  });

  it('returns all stored sessions', () => {
    const sessionRepo = makeSessionRepo();
    const s1 = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    const s2 = Session.create({ id: 'sess-2', agentType: 'claude', cwd: '/home' });
    sessionRepo.save(s1);
    sessionRepo.save(s2);

    const useCase = createSessionQueriesUseCase({ sessionRepo, terminalRepo: makeTerminalRepo() });
    expect(useCase.listAll()).toHaveLength(2);
  });
});

describe('SessionQueriesUseCase.findById', () => {
  it('returns null when session does not exist', () => {
    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo: makeTerminalRepo(),
    });
    expect(useCase.findById(makeSessionId('nonexistent'))).toBeNull();
  });

  it('returns the session when it exists', () => {
    const sessionRepo = makeSessionRepo();
    const session = Session.create({ id: 'sess-1', agentType: 'claude', cwd: '/tmp' });
    sessionRepo.save(session);

    const useCase = createSessionQueriesUseCase({ sessionRepo, terminalRepo: makeTerminalRepo() });
    const found = useCase.findById(makeSessionId('sess-1'));
    expect(found).not.toBeNull();
    expect(found?.id).toBe(makeSessionId('sess-1'));
  });
});

describe('SessionQueriesUseCase.getAllChunks', () => {
  it('returns empty array when no chunks', () => {
    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo: makeTerminalRepo(),
    });
    expect(useCase.getAllChunks(makeSessionId('sess-1'))).toEqual([]);
  });

  it('returns all chunks for a session', () => {
    const terminalRepo = makeTerminalRepo();
    terminalRepo.appendChunk(makeSessionId('sess-1'), 'hello', Date.now());
    terminalRepo.appendChunk(makeSessionId('sess-1'), ' world', Date.now());

    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo,
    });
    const chunks = useCase.getAllChunks(makeSessionId('sess-1'));
    expect(chunks).toHaveLength(2);
    expect(chunks[0].data).toBe('hello');
    expect(chunks[1].data).toBe(' world');
  });
});

describe('SessionQueriesUseCase.getInputHistory', () => {
  it('returns empty array when no input history', () => {
    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo: makeTerminalRepo(),
    });
    expect(useCase.getInputHistory(makeSessionId('sess-1'))).toEqual([]);
  });

  it('returns input history for a session', () => {
    const terminalRepo = makeTerminalRepo();
    terminalRepo.appendInput(makeSessionId('sess-1'), 'ls -la', 'cli', Date.now());
    terminalRepo.appendInput(makeSessionId('sess-1'), 'pwd', 'browser', Date.now());

    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo,
    });
    const history = useCase.getInputHistory(makeSessionId('sess-1'));
    expect(history).toHaveLength(2);
    expect(history[0].text).toBe('ls -la');
    expect(history[1].source).toBe('browser');
  });

  it('respects limit parameter', () => {
    const terminalRepo = makeTerminalRepo();
    terminalRepo.appendInput(makeSessionId('sess-1'), 'cmd1', 'cli', Date.now());
    terminalRepo.appendInput(makeSessionId('sess-1'), 'cmd2', 'cli', Date.now());
    terminalRepo.appendInput(makeSessionId('sess-1'), 'cmd3', 'cli', Date.now());

    const useCase = createSessionQueriesUseCase({
      sessionRepo: makeSessionRepo(),
      terminalRepo,
    });
    const history = useCase.getInputHistory(makeSessionId('sess-1'), 2);
    expect(history).toHaveLength(2);
  });
});

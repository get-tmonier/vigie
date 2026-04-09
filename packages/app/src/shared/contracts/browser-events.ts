import type { AgentSessionEvent } from '#shared/kernel/agent-session/events';
import type { SessionId } from '#shared/kernel/agent-session/session-id';

export type { AgentSessionEvent };

export type DaemonSyncSession = {
  sessionId: string;
  agentType: string;
  mode: 'prompt' | 'interactive';
  cwd: string;
  gitBranch?: string;
  repoName?: string;
  startedAt: number;
  status: 'active' | 'ended' | 'error';
  exitCode?: number;
  agentSessionId?: string;
  resumable: boolean;
  terminalChunks: Array<{ data: string; timestamp: number; seq: number }>;
  inputHistory?: Array<{ text: string; source: 'cli' | 'browser'; timestamp: number }>;
};

export type BrowserEvent =
  | AgentSessionEvent
  | { type: 'daemon:hello'; hostname: string; pid: number; version: string }
  | {
      type: 'command:output';
      id: string;
      stream: 'stdout' | 'stderr';
      data: string;
      timestamp: number;
    }
  | { type: 'command:done'; id: string; exitCode: number; timestamp: number }
  | { type: 'command:error'; id: string; error: string; timestamp: number }
  | { type: 'pong' }
  | {
      type: 'session:output';
      sessionId: SessionId;
      data: string;
      chunkType: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error';
      timestamp: number;
    }
  | { type: 'session:spawn-failed'; sessionId: SessionId; error: string; timestamp: number }
  | {
      type: 'fs:list-dir-response';
      requestId: string;
      entries: Array<{ name: string; isDirectory: boolean }>;
      error?: string;
    }
  | { type: 'daemon:sync'; sessions: DaemonSyncSession[] }
  | {
      type: 'terminal:chunks-response';
      requestId: string;
      sessionId: string;
      chunks: Array<{ data: string; timestamp: number; seq: number }>;
    };

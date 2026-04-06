// Browser-facing event union — matches all events published via eventBus
// and broadcast over /ws/events to UI clients.

type DaemonSyncSession = {
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
      type: 'session:started';
      sessionId: string;
      agentType: string;
      mode: 'prompt' | 'interactive';
      cwd: string;
      gitBranch?: string;
      repoName?: string;
      timestamp: number;
    }
  | {
      type: 'session:output';
      sessionId: string;
      data: string;
      chunkType: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error';
      timestamp: number;
    }
  | {
      type: 'session:ended';
      sessionId: string;
      exitCode: number;
      resumable: boolean;
      timestamp: number;
    }
  | { type: 'session:error'; sessionId: string; error: string; timestamp: number }
  | { type: 'terminal:output'; sessionId: string; data: string; timestamp: number }
  | { type: 'session:spawn-failed'; sessionId: string; error: string; timestamp: number }
  | {
      type: 'fs:list-dir-response';
      requestId: string;
      entries: Array<{ name: string; isDirectory: boolean }>;
      error?: string;
    }
  | { type: 'daemon:sync'; sessions: DaemonSyncSession[] }
  | {
      type: 'terminal:input-echo';
      sessionId: string;
      text: string;
      source: 'cli' | 'browser';
      timestamp: number;
    }
  | {
      type: 'session:agent-id-detected';
      sessionId: string;
      agentSessionId: string;
      timestamp: number;
    }
  | { type: 'session:resumable-changed'; sessionId: string; resumable: boolean; timestamp: number }
  | {
      type: 'terminal:chunks-response';
      requestId: string;
      sessionId: string;
      chunks: Array<{ data: string; timestamp: number; seq: number }>;
    }
  | { type: 'terminal:pty-resized'; sessionId: string; cols: number; rows: number }
  | { type: 'session:deleted'; sessionId: string; timestamp: number }
  | { type: 'sessions:cleared'; timestamp: number };

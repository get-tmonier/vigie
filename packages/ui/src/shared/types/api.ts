import * as v from 'valibot';

// ── Session ──────────────────────────────────────────────────────────────────

const AgentSessionSchema = v.object({
  id: v.string(),
  agentType: v.string(),
  mode: v.string(),
  cwd: v.string(),
  gitBranch: v.optional(v.string()),
  repoName: v.optional(v.string()),
  startedAt: v.number(),
  endedAt: v.optional(v.number()),
  status: v.picklist(['registering', 'active', 'ended', 'error']),
  exitCode: v.optional(v.number()),
  claudeSessionId: v.optional(v.string()),
  resumable: v.optional(v.boolean()),
});
export type AgentSession = v.InferOutput<typeof AgentSessionSchema>;

export const ListSessionsResponseSchema = v.object({
  sessions: v.array(AgentSessionSchema),
});

// ── Filesystem ───────────────────────────────────────────────────────────────

export type FsEntry = { name: string; isDirectory: boolean };

// ── Browser events (sent over /ws/events) ────────────────────────────────────

export type SessionStarted = {
  type: 'session:started';
  sessionId: string;
  agentType: string;
  mode: 'prompt' | 'interactive';
  cwd: string;
  gitBranch?: string;
  repoName?: string;
  timestamp: number;
};

export type SessionEnded = {
  type: 'session:ended';
  sessionId: string;
  exitCode: number;
  resumable: boolean;
  timestamp: number;
};

export type SessionErrorUpstream = {
  type: 'session:error';
  sessionId: string;
  error: string;
  timestamp: number;
};

export type SessionClaudeIdDetected = {
  type: 'session:claude-id-detected';
  sessionId: string;
  claudeSessionId: string;
  timestamp: number;
};

export type SessionSpawnFailed = {
  type: 'session:spawn-failed';
  sessionId: string;
  error: string;
  timestamp: number;
};

export type SessionOutput = {
  type: 'session:output';
  sessionId: string;
  data: string;
  chunkType: 'text' | 'thinking' | 'tool_use' | 'tool_result' | 'status' | 'error';
  timestamp: number;
};

export type TerminalInputEcho = {
  type: 'terminal:input-echo';
  sessionId: string;
  text: string;
  source: 'cli' | 'browser';
  timestamp: number;
};

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
  claudeSessionId?: string;
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
  | SessionStarted
  | SessionOutput
  | SessionEnded
  | SessionErrorUpstream
  | { type: 'terminal:output'; sessionId: string; data: string; timestamp: number }
  | SessionSpawnFailed
  | {
      type: 'fs:list-dir-response';
      requestId: string;
      entries: Array<{ name: string; isDirectory: boolean }>;
      error?: string;
    }
  | { type: 'daemon:sync'; sessions: DaemonSyncSession[] }
  | TerminalInputEcho
  | SessionClaudeIdDetected
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

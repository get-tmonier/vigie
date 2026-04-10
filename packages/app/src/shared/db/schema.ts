export interface SessionsTable {
  id: string;
  agent_type: string;
  mode: string;
  cwd: string;
  git_branch: string | null;
  git_remote_url: string | null;
  repo_name: string | null;
  started_at: number;
  ended_at: number | null;
  status: string;
  exit_code: number | null;
  agent_session_id: string | null;
  resumable: number;
  session_type: string;
  auto_advance: number;
  current_turn_index: number;
  total_cost_usd: number;
}

export interface TerminalChunksTable {
  id: number;
  session_id: string;
  data: string;
  timestamp: number;
  seq: number;
}

export interface InputHistoryTable {
  id: number;
  session_id: string;
  text: string;
  source: string;
  timestamp: number;
}

export interface TurnsTable {
  id: string;
  session_id: string;
  turn_index: number;
  prompt: string;
  mode: string;
  stop_reason: string | null;
  summary: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface TextDeltasTable {
  id: string;
  session_id: string;
  turn_index: number;
  role: string;
  content: string;
  created_at: string;
}

export interface ToolCallsTable {
  id: string;
  session_id: string;
  turn_index: number;
  tool_name: string;
  input: string;
  status: string;
  output: string | null;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface CostUpdatesTable {
  id: string;
  session_id: string;
  turn_index: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number | null;
  cache_write_tokens: number | null;
  total_cost_usd: number;
  model_id: string;
  created_at: string;
}

export interface SubagentSpawnsTable {
  id: string;
  session_id: string;
  turn_index: number;
  parent_tool_call_id: string;
  subagent_session_id: string;
  description: string;
  created_at: string;
}

export interface MigrationsTable {
  name: string;
  applied_at: string;
}

export interface VigiDatabaseSchema {
  sessions: SessionsTable;
  terminal_chunks: TerminalChunksTable;
  input_history: InputHistoryTable;
  turns: TurnsTable;
  text_deltas: TextDeltasTable;
  tool_calls: ToolCallsTable;
  cost_updates: CostUpdatesTable;
  subagent_spawns: SubagentSpawnsTable;
  _migrations: MigrationsTable;
}

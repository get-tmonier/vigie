import { ServiceMap } from 'effect';
import type {
  CostUpdate,
  SubagentSpawn,
  TextDelta,
  ToolCall,
  TurnCompleted,
  TurnStarted,
} from '#shared/kernel/session/events';
import type { SessionId } from '#shared/kernel/session/session-id';

export interface Turn {
  readonly id: string;
  readonly sessionId: string;
  readonly turnIndex: number;
  readonly prompt: string;
  readonly mode: string;
  readonly stopReason: string | null;
  readonly summary: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export interface StructuredEventStoreShape {
  insertTurn(event: TurnStarted): void;
  completeTurn(event: TurnCompleted): void;
  insertTextDelta(event: TextDelta): void;
  insertToolCall(event: ToolCall): void;
  updateToolCall(event: ToolCall): void;
  insertCostUpdate(event: CostUpdate): void;
  insertSubagentSpawn(event: SubagentSpawn): void;

  getTurns(sessionId: SessionId): Turn[];
  getToolCalls(sessionId: SessionId, turnIndex?: number): ToolCall[];
  getCostUpdates(sessionId: SessionId): CostUpdate[];
  getTextDeltas(sessionId: SessionId, turnIndex: number): TextDelta[];
  getSubagentSpawns(sessionId: SessionId): SubagentSpawn[];
  getSessionTotalCost(sessionId: SessionId): number;
}

export class StructuredEventStore extends ServiceMap.Service<
  StructuredEventStore,
  StructuredEventStoreShape
>()('@vigie/StructuredEventStore') {}

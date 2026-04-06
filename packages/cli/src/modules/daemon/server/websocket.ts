import type { ServerWebSocket } from 'bun';
import type { createSessionStore } from '../persistence/session-store.js';
import type { PtyEntry } from './app.js';
import type { DaemonEvent, EventBus } from './event-bus.js';
import type { TerminalSubscribers } from './terminal-subscribers.js';

interface WsData {
  type: 'events' | 'terminal';
  sessionId?: string;
  browserConnId?: string;
}

interface WsDeps {
  store: ReturnType<typeof createSessionStore>;
  ptyHandles: Map<string, PtyEntry>;
  eventBus: EventBus;
  terminalSubs: TerminalSubscribers;
  applyResizePriority: (sessionId: string) => { cols: number; rows: number } | null;
  inputLineBufferWrite: (sessionId: string, base64Data: string, source: 'cli' | 'browser') => void;
}

// Track unsubscribe functions per WebSocket
const unsubscribers = new WeakMap<ServerWebSocket<WsData>, () => void>();

export function createWebSocketHandlers(deps: WsDeps) {
  return {
    open(ws: ServerWebSocket<WsData>) {
      if (ws.data.type === 'events') {
        // Subscribe to event bus and send all events as JSON
        const unsub = deps.eventBus.subscribe((event: DaemonEvent) => {
          try {
            ws.sendText(JSON.stringify(event));
          } catch {}
        });
        unsubscribers.set(ws, unsub);

        // Send initial snapshot of all sessions
        const rows = deps.store.getAllSessions();
        const sessions = rows.map((row) => ({
          id: row.id,
          agentType: row.agent_type,
          mode: row.mode,
          cwd: row.cwd,
          gitBranch: row.git_branch ?? undefined,
          repoName: row.repo_name ?? undefined,
          startedAt: row.started_at,
          endedAt: row.ended_at ?? undefined,
          status: row.status,
          exitCode: row.exit_code ?? undefined,
          claudeSessionId: row.claude_session_id ?? undefined,
          resumable: row.resumable === 1,
        }));
        ws.sendText(JSON.stringify({ type: 'snapshot', sessions }));

        console.log('[server] Events WS client connected');
      } else if (ws.data.type === 'terminal' && ws.data.sessionId) {
        const sessionId = ws.data.sessionId;
        const browserConnId = ws.data.browserConnId ?? '';

        // Replay existing terminal chunks
        const chunks = deps.store.getAllTerminalChunks(sessionId);
        for (const chunk of chunks) {
          try {
            const payload = Uint8Array.from(atob(chunk.data), (c) => c.charCodeAt(0));
            ws.send(payload);
          } catch {}
        }

        // Subscribe to live terminal output
        const unsub = deps.terminalSubs.subscribe(sessionId, (data: string) => {
          try {
            const payload = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
            ws.send(payload);
          } catch {}
        });
        unsubscribers.set(ws, unsub);

        // Register browser channel for resize priority
        const entry = deps.ptyHandles.get(sessionId);
        if (entry) {
          entry.browserChannels.set(browserConnId, {
            cols: 120,
            rows: 30,
          });
        }

        console.log(`[server] Terminal WS client connected for session ${sessionId}`);
      }
    },

    message(ws: ServerWebSocket<WsData>, message: string | Buffer) {
      if (ws.data.type !== 'terminal' || !ws.data.sessionId) return;

      const sessionId = ws.data.sessionId;
      const browserConnId = ws.data.browserConnId ?? '';

      if (typeof message === 'string') {
        // JSON control message (resize)
        let parsed: { type?: string; cols?: number; rows?: number };
        try {
          parsed = JSON.parse(message);
        } catch {
          return;
        }

        if (
          parsed.type === 'resize' &&
          typeof parsed.cols === 'number' &&
          typeof parsed.rows === 'number'
        ) {
          const entry = deps.ptyHandles.get(sessionId);
          if (entry) {
            entry.browserChannels.set(browserConnId, {
              cols: parsed.cols,
              rows: parsed.rows,
            });
            deps.applyResizePriority(sessionId);
            console.log(
              `[server] terminal:resize sessionId=${sessionId} cols=${parsed.cols} rows=${parsed.rows}`
            );
          }
        }
      } else {
        // Binary data — keyboard input
        const bytes = message instanceof Uint8Array ? message : new Uint8Array(message);

        if (bytes.length > 0) {
          const entry = deps.ptyHandles.get(sessionId);
          if (entry) {
            entry.handle.write(bytes);
            const base64 = Buffer.from(bytes).toString('base64');
            deps.inputLineBufferWrite(sessionId, base64, 'browser');
          }
        }
      }
    },

    close(ws: ServerWebSocket<WsData>) {
      const unsub = unsubscribers.get(ws);
      if (unsub) {
        unsub();
        unsubscribers.delete(ws);
      }

      if (ws.data.type === 'terminal' && ws.data.sessionId) {
        const sessionId = ws.data.sessionId;
        const browserConnId = ws.data.browserConnId;

        // Remove browser channel
        const entry = deps.ptyHandles.get(sessionId);
        if (entry && browserConnId) {
          entry.browserChannels.delete(browserConnId);
          deps.applyResizePriority(sessionId);
          console.log(
            `[server] Browser channel ${browserConnId} disconnected from session ${sessionId}`
          );
        }
      }
    },
  };
}

export type { WsData };

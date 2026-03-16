export interface HistoryEntry {
  text: string;
  timestamp: number;
  source?: 'cli' | 'browser';
}

export function createInputHistoryStore() {
  const entries = new Map<string, HistoryEntry[]>();
  const seen = new Map<string, Set<string>>();

  return {
    addEntry(sessionId: string, text: string, source: 'cli' | 'browser', timestamp: number) {
      const key = `${timestamp}:${text}`;
      if (!seen.has(sessionId)) seen.set(sessionId, new Set());
      const sessionSeen = seen.get(sessionId) as Set<string>;
      if (sessionSeen.has(key)) return;
      sessionSeen.add(key);
      if (!entries.has(sessionId)) entries.set(sessionId, []);
      entries.get(sessionId)?.push({ text, source, timestamp });
    },

    getHistory(sessionId: string): HistoryEntry[] {
      return entries.get(sessionId) ?? [];
    },
  };
}

export interface HistoryEntry {
  text: string;
  timestamp: number;
  source?: 'cli' | 'browser';
}

export function createInputHistoryStore() {
  const entries = new Map<string, HistoryEntry[]>();

  return {
    addEntry(sessionId: string, text: string, source: 'cli' | 'browser', timestamp: number) {
      if (!entries.has(sessionId)) {
        entries.set(sessionId, []);
      }
      entries.get(sessionId)?.push({ text, source, timestamp });
    },

    getHistory(sessionId: string): HistoryEntry[] {
      return entries.get(sessionId) ?? [];
    },
  };
}

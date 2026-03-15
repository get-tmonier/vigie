import { useCallback, useRef, useState } from 'react';
import { createInputHistoryStore, type HistoryEntry } from './input-history-store';

export type { HistoryEntry };

interface UseInputHistoryResult {
  getHistory: (sessionId: string) => HistoryEntry[];
  addEntry: (sessionId: string, text: string, source: 'cli' | 'browser', timestamp: number) => void;
}

export function useInputHistory(): UseInputHistoryResult {
  const [, setTick] = useState(0);
  const storeRef = useRef(createInputHistoryStore());

  const addEntry = useCallback(
    (sessionId: string, text: string, source: 'cli' | 'browser', timestamp: number) => {
      storeRef.current.addEntry(sessionId, text, source, timestamp);
      setTick((t) => t + 1);
    },
    []
  );

  const getHistory = useCallback((sessionId: string): HistoryEntry[] => {
    return storeRef.current.getHistory(sessionId);
  }, []);

  return { getHistory, addEntry };
}

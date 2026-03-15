import { useCallback, useRef, useState } from 'react';

export interface HistoryEntry {
  text: string;
  timestamp: number;
}

interface UseInputHistoryResult {
  history: HistoryEntry[];
  trackInput: (data: string) => void;
}

export function useInputHistory(): UseInputHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const lineBuffer = useRef('');

  const trackInput = useCallback((data: string) => {
    for (const char of data) {
      if (char === '\r' || char === '\n') {
        const line = lineBuffer.current.trim();
        if (line.length > 0) {
          setHistory((prev) => [...prev, { text: line, timestamp: Date.now() }]);
        }
        lineBuffer.current = '';
      } else if (char === '\x7f') {
        lineBuffer.current = lineBuffer.current.slice(0, -1);
      } else if (char.charCodeAt(0) >= 32) {
        lineBuffer.current += char;
      }
    }
  }, []);

  return { history, trackInput };
}

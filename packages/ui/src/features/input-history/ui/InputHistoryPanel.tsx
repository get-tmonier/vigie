import type { HistoryEntry } from '../model/use-input-history';

interface InputHistoryPanelProps {
  history: HistoryEntry[];
}

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const minutes = Math.floor(diff / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

export function InputHistoryPanel({ history }: InputHistoryPanelProps) {
  if (history.length === 0) {
    return (
      <div className="w-64 border-l border-navy-light bg-navy-deep p-3">
        <div className="text-xs text-slate uppercase tracking-wider mb-2">Input History</div>
        <div className="text-xs text-slate">No commands yet</div>
      </div>
    );
  }

  return (
    <div className="w-64 border-l border-navy-light bg-navy-deep overflow-y-auto">
      <div className="text-xs text-slate uppercase tracking-wider p-3 pb-2 sticky top-0 bg-navy-deep">
        Input History
      </div>
      <div className="space-y-1 px-3 pb-3">
        {history.map((entry, i) => (
          <div key={`${entry.timestamp}-${i}`} className="group">
            <div className="font-mono text-xs text-cream truncate">{entry.text}</div>
            <div className="text-[0.625rem] text-slate">{formatRelativeTime(entry.timestamp)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

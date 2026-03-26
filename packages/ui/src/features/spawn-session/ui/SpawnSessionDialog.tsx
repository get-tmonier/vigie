import { useCallback, useEffect, useRef, useState } from 'react';
import type { FsEntry } from '#entities/session/api/session-api';
import { listDirectory } from '#entities/session/api/session-api';
import { cn } from '#shared/lib/cn';
import { useSpawnSession } from '../model/use-spawn-session';

interface SpawnSessionDialogProps {
  daemonId: string;
  onSpawned: (sessionId: string) => void;
  onClose: () => void;
}

export function SpawnSessionDialog({ daemonId, onSpawned, onClose }: SpawnSessionDialogProps) {
  const [cwd, setCwd] = useState('~/');
  const [suggestions, setSuggestions] = useState<FsEntry[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { spawn, loading, error } = useSpawnSession();

  const fetchSuggestions = useCallback(
    async (path: string) => {
      setLoadingSuggestions(true);
      try {
        const result = await listDirectory(daemonId, path);
        const dirs = result.entries.filter((e) => e.isDirectory);
        setSuggestions(dirs);
        setSelectedIndex(0);
        setShowSuggestions(dirs.length > 0);
      } catch {
        setSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setLoadingSuggestions(false);
      }
    },
    [daemonId]
  );

  useEffect(() => {
    inputRef.current?.focus();
    fetchSuggestions('~');
  }, [fetchSuggestions]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showSuggestions) {
          setShowSuggestions(false);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showSuggestions]);

  const handleCwdChange = useCallback(
    (value: string) => {
      setCwd(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const parentDir = value.endsWith('/')
          ? value
          : value.substring(0, value.lastIndexOf('/') + 1);
        if (parentDir) {
          fetchSuggestions(parentDir);
        }
      }, 200);
    },
    [fetchSuggestions]
  );

  const selectSuggestion = useCallback(
    (entry: FsEntry) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const parentDir = cwd.endsWith('/') ? cwd : cwd.substring(0, cwd.lastIndexOf('/') + 1);
      const newPath = `${parentDir}${entry.name}/`;
      setCwd(newPath);
      setShowSuggestions(false);
      inputRef.current?.focus();
      fetchSuggestions(newPath);
    },
    [cwd, fetchSuggestions]
  );

  const handleInputKeyDown = (e: React.KeyboardEvent, filtered: FsEntry[]) => {
    if (!showSuggestions || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Tab') {
      e.preventDefault();
      selectSuggestion(filtered[selectedIndex]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setShowSuggestions(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sessionId = await spawn(daemonId, {
      cwd: cwd.trim() || undefined,
    });
    if (sessionId) {
      onSpawned(sessionId);
      onClose();
    }
  };

  // Filter suggestions by what the user has typed after the last /
  const typedSegment = cwd.endsWith('/') ? '' : cwd.substring(cwd.lastIndexOf('/') + 1);
  const filtered = typedSegment
    ? suggestions.filter((s) => s.name.toLowerCase().startsWith(typedSegment.toLowerCase()))
    : suggestions;

  return (
    <form onSubmit={handleSubmit} className="p-2 shadow-[0_1px_0_0_rgba(22,45,74,0.6)] space-y-2">
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className={cn(
            'flex-1 text-xs font-mono py-1.5 rounded transition-colors',
            loading
              ? 'bg-navy-700 text-cream-200 cursor-not-allowed'
              : 'bg-vigie-400 text-navy-900 hover:bg-vigie-500 shadow-[0_1px_2px_rgba(0,0,0,0.15),0_4px_8px_rgba(38,192,154,0.15)]'
          )}
        >
          {loading ? 'Starting...' : 'Start Session'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-mono text-cream-200 hover:text-cream-50 py-1.5 px-2"
        >
          Cancel
        </button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={cwd}
          onChange={(e) => handleCwdChange(e.target.value)}
          onKeyDown={(e) => handleInputKeyDown(e, filtered)}
          onFocus={() => filtered.length > 0 && setShowSuggestions(true)}
          placeholder="~/projects/..."
          className="w-full bg-navy-900 border-none shadow-[inset_0_0_0_1px_rgba(22,45,74,0.6)] rounded px-2 py-1.5 text-sm text-cream-50 font-mono placeholder:text-cream-200 focus:outline-none focus:shadow-[inset_0_0_0_1px_rgba(38,192,154,0.5),0_0_0_3px_rgba(38,192,154,0.1)]"
        />
        {loadingSuggestions && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[0.625rem] text-cream-200">
            ...
          </span>
        )}
        {showSuggestions && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 max-h-40 overflow-y-auto bg-navy-900 border-none rounded-lg shadow-[0_0_0_1px_rgba(22,45,74,0.6),0_8px_24px_rgba(0,0,0,0.3)]">
            {filtered.map((entry, i) => (
              <button
                key={entry.name}
                type="button"
                onClick={() => selectSuggestion(entry)}
                className={cn(
                  'w-full text-left px-2 py-1 text-xs font-mono flex items-center gap-2',
                  i === selectedIndex
                    ? 'bg-navy-800 text-cream-50'
                    : 'text-cream-200 hover:bg-navy-800 hover:text-cream-50'
                )}
              >
                <span className="text-vigie-400/60">{'/'}</span>
                {entry.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}

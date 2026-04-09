import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '#shared/lib/cn';
import { $homedir, $selectedId, $sessions } from './store';

export function SpawnSessionFormIsland() {
  const sessions = useStore($sessions);
  const selectedId = useStore($selectedId);
  const homedir = useStore($homedir);
  const selectedSession = sessions.find((s) => s.id === selectedId);
  const defaultCwd = selectedSession?.cwd ?? homedir;

  const [agentType, setAgentType] = useState('claude');
  const [value, setValue] = useState(defaultCwd);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [spawning, setSpawning] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(defaultCwd);
    setEditing(false);
  }, [defaultCwd]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setSuggestions([]);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when entering edit mode
  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) {
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          el.scrollLeft = el.scrollWidth;
        }
      });
    }
  }, [editing]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        bottom: window.innerHeight - rect.top + 4,
      });
    }
  };

  const fetchSuggestions = async (input: string) => {
    const lastSlash = input.lastIndexOf('/');
    if (lastSlash < 0) return setSuggestions([]);
    const dir = input.slice(0, lastSlash + 1) || '/';
    const prefix = input.slice(lastSlash + 1).toLowerCase();
    try {
      const res = await fetch('/api/fs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: dir }),
      });
      const data = (await res.json()) as { entries?: { name: string; isDirectory: boolean }[] };
      const dirs = (data.entries ?? [])
        .filter((e) => e.isDirectory && e.name.toLowerCase().startsWith(prefix))
        .map((e) => `${dir}${e.name}/`);
      setSuggestions(dirs);
      setActiveIndex(-1);
      updateDropdownPosition();
    } catch {
      setSuggestions([]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(v), 150);
  };

  const pick = (s: string) => {
    setValue(s);
    setSuggestions([]);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // Keep focus in input so user can keep typing to go deeper
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
        el.scrollLeft = el.scrollWidth;
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (suggestions.length > 0) {
        e.preventDefault();
        setSuggestions([]);
      } else {
        setEditing(false);
      }
      return;
    }
    if (e.key === 'Enter' && suggestions.length === 0) {
      // Confirm path selection and close edit mode
      e.preventDefault();
      setEditing(false);
      return;
    }
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Tab' || e.key === 'Enter') {
      const s = activeIndex >= 0 ? suggestions[activeIndex] : suggestions[0];
      if (s) {
        e.preventDefault();
        pick(s);
      }
    }
  };

  const handleSubmit = async () => {
    if (spawning) return;
    setSpawning(true);
    setEditing(false);
    setSuggestions([]);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType, cwd: value }),
      });
      const data = (await res.json()) as { sessionId?: string };
      if (data.sessionId) {
        setValue(defaultCwd);
        $selectedId.set(data.sessionId);
        history.pushState(null, '', `/?session=${data.sessionId}`);
      }
    } catch {
      /* WS will update */
    } finally {
      setSpawning(false);
    }
  };

  // Display helpers
  const segments = value.replace(/\/$/, '').split('/').filter(Boolean);
  const folderName = segments.at(-1) ?? '/';
  // Show end of path — truncate from left if too long
  const abbreviated = (() => {
    if (value.length <= 28) return value;
    // Keep last ~26 chars, prefix with ellipsis
    return `…${value.slice(-26)}`;
  })();

  return (
    <div
      ref={containerRef}
      className="p-3 shadow-[0_-1px_0_0_rgba(22,45,74,0.6)] flex flex-col gap-2"
    >
      <div className="flex flex-col gap-1.5">
        <select
          value={agentType}
          onChange={(e) => setAgentType(e.target.value)}
          className="w-full px-2 py-1.5 font-mono text-xs bg-navy-800 text-cream-50 border border-navy-700 rounded focus:outline-none focus:border-vigie-400/50"
        >
          <option value="claude">claude</option>
          <option value="opencode">opencode</option>
        </select>

        {/* Path display / edit */}
        {editing ? (
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                // Small delay so mousedown on suggestion fires first
                setTimeout(() => {
                  if (!containerRef.current?.querySelector(':focus-within')) {
                    setSuggestions([]);
                    setEditing(false);
                  }
                }, 150);
              }}
              spellCheck={false}
              autoComplete="off"
              placeholder="/path/to/project"
              className="w-full px-2 py-1.5 font-mono text-xs bg-navy-800 text-cream-50 border border-vigie-400/50 rounded focus:outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            title={value}
            onClick={() => {
              setEditing(true);
              fetchSuggestions(value);
            }}
            className="w-full text-left px-2 py-1.5 bg-navy-800 border border-navy-700 rounded hover:border-navy-600 transition-colors"
          >
            <div className="font-mono text-sm text-cream-50 truncate leading-tight">
              {folderName}
            </div>
            <div className="font-mono text-[0.6rem] text-cream-200/40 truncate leading-tight mt-0.5">
              {abbreviated}
            </div>
          </button>
        )}
      </div>

      {/* Dropdown rendered fixed so it's never clipped */}
      {suggestions.length > 0 && (
        <ul
          style={dropdownStyle}
          className="bg-navy-800 border border-navy-600 rounded shadow-xl z-50 max-h-48 overflow-y-auto"
        >
          {suggestions.map((s, i) => {
            const name = s.replace(/\/$/, '').split('/').at(-1) ?? s;
            const parent = s.slice(0, s.lastIndexOf(name));
            const parentShort = parent.length > 24 ? `…${parent.slice(-24)}` : parent;
            return (
              <li
                key={s}
                title={s}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(s);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'px-2 py-1 cursor-pointer',
                  i === activeIndex ? 'bg-vigie-400/20' : 'hover:bg-navy-700'
                )}
              >
                <div
                  className={cn(
                    'font-mono text-xs truncate',
                    i === activeIndex ? 'text-vigie-400' : 'text-cream-100'
                  )}
                >
                  {name}/
                </div>
                <div className="font-mono text-[0.6rem] text-cream-200/40 truncate">
                  {parentShort}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={spawning}
        className="w-full py-1.5 font-mono text-xs bg-vigie-400 text-navy-900 rounded hover:bg-vigie-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {spawning ? 'Starting…' : '+ New session'}
      </button>
    </div>
  );
}

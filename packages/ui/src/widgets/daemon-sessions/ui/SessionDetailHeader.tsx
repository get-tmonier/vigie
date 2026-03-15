import { useCallback, useEffect, useState } from 'react';
import type { AgentSession } from '#entities/session/api/session-api';
import { KillSessionButton } from '#features/kill-session/ui/KillSessionButton';
import { cn } from '#shared/lib/cn';

interface SessionDetailHeaderProps {
  session: AgentSession;
  connected: boolean;
  historyOpen: boolean;
  onToggleHistory: () => void;
  onResume?: () => void;
}

function formatDuration(startedAt: number): string {
  const diff = Math.floor((Date.now() - startedAt) / 1000);
  if (diff < 60) return `${diff}s`;
  const minutes = Math.floor(diff / 60);
  const seconds = diff % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function shortenPath(cwd: string): string {
  const home = '/Users/';
  if (cwd.includes(home)) {
    const parts = cwd.split(home);
    const rest = parts[1];
    const segments = rest.split('/');
    return `~/${segments.slice(1).join('/')}`;
  }
  return cwd;
}

const AGENT_ICONS: Record<string, string> = {
  claude: 'C',
  opencode: 'O',
  generic: 'G',
};

function AttachButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    const command = `tmonier session attach ${sessionId.slice(0, 8)}`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [sessionId]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-xs font-mono px-2 py-1 rounded transition-colors text-slate hover:text-cream hover:bg-navy-light"
    >
      {copied ? 'Copied!' : '>_ Attach'}
    </button>
  );
}

export function SessionDetailHeader({
  session,
  connected,
  historyOpen,
  onToggleHistory,
  onResume,
}: SessionDetailHeaderProps) {
  const [, setTick] = useState(0);
  const isActive = session.status === 'active';

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-navy-light bg-navy-deep">
      <span
        className={cn(
          'w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0',
          isActive ? 'bg-gold text-navy-deep' : 'bg-navy-light text-slate'
        )}
      >
        {AGENT_ICONS[session.agentType] ?? '?'}
      </span>
      <span className="text-sm text-cream font-mono">{session.id.slice(0, 8)}</span>
      <span className="text-[0.625rem] text-gold border border-gold/30 rounded px-1 py-0.5 leading-none">
        {session.mode}
      </span>
      <span className="text-xs text-slate font-mono truncate">{shortenPath(session.cwd)}</span>
      {session.gitBranch && (
        <span className="text-xs text-slate font-mono">({session.gitBranch})</span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <span className="text-xs text-slate font-mono tabular-nums">
          {formatDuration(session.startedAt)}
        </span>
        {session.mode === 'interactive' && (
          <button
            type="button"
            onClick={onToggleHistory}
            className={cn(
              'text-xs font-mono px-2 py-1 rounded transition-colors',
              historyOpen
                ? 'bg-navy-light text-cream'
                : 'text-slate hover:text-cream hover:bg-navy-light'
            )}
          >
            History
          </button>
        )}
        {session.mode === 'interactive' && isActive && <AttachButton sessionId={session.id} />}
        {session.status === 'ended' &&
          session.agentType === 'claude' &&
          session.claudeSessionId &&
          onResume && (
            <button
              type="button"
              onClick={onResume}
              className="text-xs font-mono px-2 py-1 rounded transition-colors bg-gold/20 text-gold hover:bg-gold/30"
            >
              Resume
            </button>
          )}
        {isActive && <KillSessionButton daemonId={session.daemonId} sessionId={session.id} />}
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isActive ? (connected ? 'bg-success animate-pulse' : 'bg-yellow-500') : 'bg-slate'
          )}
        />
      </div>
    </div>
  );
}

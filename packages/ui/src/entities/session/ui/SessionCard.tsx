import { cn } from '#shared/lib/cn';
import type { AgentSession } from '../api/session-api';

interface SessionCardProps {
  session: AgentSession;
  selected: boolean;
  onClick: () => void;
}

const AGENT_ICONS: Record<string, string> = {
  claude: 'C',
  opencode: 'O',
  generic: 'G',
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString();
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

export function SessionCard({ session, selected, onClick }: SessionCardProps) {
  const isActive = session.status === 'active';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors',
        selected ? 'border-gold bg-navy-mid' : 'border-navy-light bg-navy-deep hover:border-slate',
        !isActive && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
            isActive ? 'bg-gold text-navy-deep' : 'bg-navy-light text-slate'
          )}
        >
          {AGENT_ICONS[session.agentType] ?? '?'}
        </span>
        <span className="text-sm text-cream font-mono truncate">{session.id.slice(0, 8)}</span>
        {session.mode === 'interactive' && (
          <span className="text-[0.625rem] text-gold border border-gold/30 rounded px-1 py-0.5 leading-none">
            interactive
          </span>
        )}
        <span
          className={cn(
            'ml-auto w-2 h-2 rounded-full',
            isActive ? 'bg-success animate-pulse' : 'bg-slate'
          )}
        />
      </div>
      <div className="text-xs text-slate truncate">{shortenPath(session.cwd)}</div>
      {session.repoName && (
        <div className="text-xs text-slate truncate">
          {session.repoName}
          {session.gitBranch ? ` (${session.gitBranch})` : ''}
        </div>
      )}
      <div className="text-xs text-slate mt-1">{formatTime(session.startedAt)}</div>
    </button>
  );
}

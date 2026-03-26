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
        'w-full text-left p-3 rounded-xl transition-all duration-150',
        selected
          ? 'bg-navy-800 shadow-[0_0_0_1px_rgba(38,192,154,0.4),0_0_12px_rgba(38,192,154,0.08)]'
          : 'bg-navy-900 shadow-[0_0_0_1px_rgba(22,45,74,0.6)] hover:shadow-[0_0_0_1px_rgba(38,192,154,0.2)]',
        !isActive && 'opacity-60'
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={cn(
            'w-6 h-6 rounded flex items-center justify-center text-xs font-bold',
            isActive ? 'bg-vigie-400 text-navy-900' : 'bg-navy-700 text-cream-200'
          )}
        >
          {AGENT_ICONS[session.agentType] ?? '?'}
        </span>
        <span className="text-sm text-cream-50 font-mono truncate">{session.id.slice(0, 8)}</span>
        {session.mode === 'interactive' && (
          <span className="text-[0.625rem] text-vigie-400 border border-vigie-400/30 rounded px-1 py-0.5 leading-none">
            interactive
          </span>
        )}
        {isActive ? (
          <span className="ml-auto w-2 h-2 rounded-full bg-success animate-pulse" />
        ) : (
          <span className="ml-auto text-[0.6rem] font-mono text-cream-200/50 uppercase tracking-wider">
            ended
          </span>
        )}
      </div>
      <div className="text-xs text-cream-200 truncate">{shortenPath(session.cwd)}</div>
      {session.repoName && (
        <div className="text-xs text-cream-200 truncate">
          {session.repoName}
          {session.gitBranch ? ` (${session.gitBranch})` : ''}
        </div>
      )}
      <div className="text-xs text-cream-200 mt-1">{formatTime(session.startedAt)}</div>
    </button>
  );
}

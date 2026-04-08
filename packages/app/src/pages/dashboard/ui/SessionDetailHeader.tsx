import type { AgentSession } from '#modules/agent-session/infrastructure/adapters/in/session.dto';
import { cn } from '#shared/lib/cn';

const AGENT_ICONS: Record<string, string> = {
  claude: 'C',
  opencode: 'O',
  generic: 'G',
};

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
    const rest = parts[1] ?? '';
    const segments = rest.split('/');
    return `~/${segments.slice(1).join('/')}`;
  }
  return cwd;
}

interface SessionDetailHeaderProps {
  session: AgentSession;
  onKill?: () => void;
  onResume?: () => void;
  onDelete?: () => void;
}

export function SessionDetailHeader({
  session,
  onKill,
  onResume,
  onDelete,
}: SessionDetailHeaderProps) {
  const isActive = session.status === 'active';
  const duration = formatDuration(session.startedAt);

  return (
    <div className="flex items-center gap-3 px-4 py-2 shadow-[0_1px_0_0_rgba(22,45,74,0.8)] bg-navy-900 shrink-0">
      <span
        className={cn(
          'w-7 h-7 rounded flex items-center justify-center text-xs font-bold shrink-0',
          isActive ? 'bg-vigie-400 text-navy-900' : 'bg-navy-700 text-cream-200'
        )}
      >
        {AGENT_ICONS[session.agentType] ?? '?'}
      </span>
      <CopyableId sessionId={session.id} />
      <span className="text-[0.625rem] text-vigie-400 border border-vigie-400/30 rounded px-1 py-0.5 leading-none shrink-0">
        {session.mode}
      </span>
      <span className="text-xs text-cream-200 font-mono truncate">{shortenPath(session.cwd)}</span>
      {session.gitBranch && (
        <span className="text-xs text-cream-200 font-mono shrink-0">({session.gitBranch})</span>
      )}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        {!isActive && (
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-cream-200/10 text-cream-200">
            Ended
          </span>
        )}
        <span className="text-xs text-cream-200 font-mono tabular-nums">{duration}</span>
        {isActive && session.mode === 'interactive' && onKill && (
          <AttachButton sessionId={session.id} />
        )}
        {isActive && onKill && (
          <button
            type="button"
            onClick={onKill}
            className="text-xs font-mono px-2 py-1 rounded transition-colors text-danger hover:bg-danger/10 cursor-pointer"
          >
            Kill
          </button>
        )}
        {session.resumable && !isActive && onResume && (
          <button
            type="button"
            onClick={onResume}
            className="text-xs font-mono px-2 py-1 rounded transition-colors bg-vigie-400/20 text-vigie-400 hover:bg-vigie-400/30 cursor-pointer"
          >
            Resume
          </button>
        )}
        {!isActive && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="text-xs font-mono px-2 py-1 rounded transition-colors text-cream-200 hover:bg-navy-700 cursor-pointer"
          >
            Delete
          </button>
        )}
        <span
          className={cn(
            'w-2 h-2 rounded-full shrink-0',
            isActive ? 'bg-success animate-pulse' : 'bg-cream-200/30'
          )}
        />
      </div>
    </div>
  );
}

function CopyableId({ sessionId }: { sessionId: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(sessionId)}
      className="text-sm font-mono text-cream-50 hover:text-vigie-400 cursor-pointer transition-colors bg-transparent border-none p-0"
      title={`Copy full ID: ${sessionId}`}
    >
      {sessionId.slice(0, 8)}
    </button>
  );
}

function AttachButton({ sessionId }: { sessionId: string }) {
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(`vigie session attach --id ${sessionId}`)}
      className="text-xs font-mono px-2 py-1 rounded transition-colors text-cream-200 hover:bg-navy-700 cursor-pointer"
      title="Copy attach command to clipboard"
    >
      &gt;_ Attach
    </button>
  );
}

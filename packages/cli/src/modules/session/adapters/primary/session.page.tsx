import type { AgentSession } from '../../schemas.js';

function SessionRow({ session }: { session: AgentSession }) {
  const isActive = session.status === 'active';
  const isEnded = session.status === 'ended';
  const label = session.agentType === 'claude' ? 'C' : session.agentType === 'opencode' ? 'O' : 'G';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        borderBottom: '1px solid #162d4a',
        fontFamily: 'monospace',
        fontSize: '12px',
      }}
    >
      <span
        style={{
          width: '20px',
          height: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          background: isActive ? '#26c09a' : '#1e3a5f',
          color: isActive ? '#0b1929' : '#8a9bb5',
          fontSize: '11px',
          fontWeight: 'bold',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          color: isActive ? '#e8dcc8' : '#8a9bb5',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: '#8a9bb5' }}>{session.id.slice(0, 8)}</span>
        {'  '}
        {session.cwd}
        {session.repoName && (
          <span style={{ color: '#26c09a', marginLeft: '8px' }}>
            {session.repoName}
            {session.gitBranch && ` (${session.gitBranch})`}
          </span>
        )}
      </span>
      <span
        style={{ color: isActive ? '#26c09a' : '#8a9bb5', marginRight: '8px', fontSize: '11px' }}
      >
        {session.status}
      </span>
      {isActive && (
        <form action={`/sessions/${session.id}/kill`} method="POST" style={{ margin: 0 }}>
          <button
            type="submit"
            style={{ padding: '2px 10px', fontSize: '11px', cursor: 'pointer' }}
          >
            Kill
          </button>
        </form>
      )}
      {isEnded && session.resumable && (
        <form action={`/sessions/${session.id}/resume`} method="POST" style={{ margin: 0 }}>
          <button
            type="submit"
            style={{ padding: '2px 10px', fontSize: '11px', cursor: 'pointer' }}
          >
            Resume
          </button>
        </form>
      )}
      {isEnded && (
        <form action={`/sessions/${session.id}/delete`} method="POST" style={{ margin: 0 }}>
          <button
            type="submit"
            style={{ padding: '2px 10px', fontSize: '11px', cursor: 'pointer' }}
          >
            Delete
          </button>
        </form>
      )}
    </div>
  );
}

type Props = { sessions: AgentSession[] };

export function DashboardPage({ sessions }: Props) {
  const active = sessions.filter((s) => s.status === 'active');
  const ended = sessions.filter((s) => s.status !== 'active');

  return (
    <div
      style={{
        fontFamily: 'monospace',
        background: '#0b1929',
        color: '#e8dcc8',
        minHeight: '100vh',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 'normal',
              letterSpacing: '0.05em',
              color: '#26c09a',
            }}
          >
            vigie
          </h1>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {active.length > 0 && (
              <form action="/sessions/kill-all" method="POST" style={{ margin: 0 }}>
                <button
                  type="submit"
                  style={{ padding: '4px 12px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Kill all ({active.length})
                </button>
              </form>
            )}
            {ended.length > 0 && (
              <form action="/sessions/clear-ended" method="POST" style={{ margin: 0 }}>
                <button
                  type="submit"
                  style={{ padding: '4px 12px', fontSize: '11px', cursor: 'pointer' }}
                >
                  Clear ended ({ended.length})
                </button>
              </form>
            )}
          </div>
        </div>

        <form
          action="/sessions/create"
          method="POST"
          style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}
        >
          <select
            name="agentType"
            style={{
              padding: '6px 8px',
              fontFamily: 'monospace',
              fontSize: '12px',
              background: '#0f2237',
              color: '#e8dcc8',
              border: '1px solid #162d4a',
            }}
          >
            <option value="claude">claude</option>
            <option value="opencode">opencode</option>
          </select>
          <input
            name="cwd"
            type="text"
            placeholder="Working directory (e.g. ~/projects/myapp)"
            defaultValue="~"
            style={{
              flex: 1,
              padding: '6px 10px',
              fontFamily: 'monospace',
              fontSize: '12px',
              background: '#0f2237',
              color: '#e8dcc8',
              border: '1px solid #162d4a',
            }}
          />
          <button
            type="submit"
            style={{
              padding: '6px 16px',
              fontFamily: 'monospace',
              fontSize: '12px',
              cursor: 'pointer',
              background: '#26c09a',
              color: '#0b1929',
              border: 'none',
            }}
          >
            Spawn
          </button>
        </form>

        {sessions.length === 0 ? (
          <p style={{ color: '#8a9bb5', textAlign: 'center', marginTop: '48px' }}>
            No sessions yet
          </p>
        ) : (
          <div style={{ border: '1px solid #162d4a' }}>
            {active.length > 0 && (
              <>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '10px',
                    color: '#8a9bb5',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: '#0f2237',
                    borderBottom: '1px solid #162d4a',
                  }}
                >
                  Active
                </div>
                {active.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </>
            )}
            {ended.length > 0 && (
              <>
                <div
                  style={{
                    padding: '4px 12px',
                    fontSize: '10px',
                    color: '#8a9bb5',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    background: '#0f2237',
                    borderTop: active.length > 0 ? '1px solid #162d4a' : undefined,
                    borderBottom: '1px solid #162d4a',
                  }}
                >
                  Ended
                </div>
                {ended.map((s) => (
                  <SessionRow key={s.id} session={s} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

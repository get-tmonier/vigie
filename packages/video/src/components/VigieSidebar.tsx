import type React from 'react';
import { colors, fonts } from './theme';

interface Session {
  id: string;
  project: string;
  status: 'active' | 'ended' | 'paused';
  time: string;
}

interface VigieSidebarProps {
  sessions: Session[];
  activeSessionId?: string;
  activeNav?: 'sessions' | 'terminal';
}

const RadarLogo: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
    <circle cx="32" cy="32" r="24" fill="none" stroke={colors.vigie400} strokeWidth="2.5" />
    <circle cx="32" cy="32" r="16" fill="none" stroke={colors.vigie400} strokeWidth="1.5" opacity="0.7" />
    <circle cx="32" cy="32" r="8" fill="none" stroke={colors.vigie400} strokeWidth="1" opacity="0.5" />
    <circle cx="32" cy="32" r="3.5" fill={colors.vigie400} />
    <line x1="32" y1="8" x2="32" y2="2" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="52.8" y1="20" x2="57.4" y2="16.4" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
    <line x1="52.8" y1="44" x2="57.4" y2="47.6" stroke={colors.vigie400} strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

const statusColor = (s: Session['status']) =>
  s === 'active' ? colors.success : s === 'paused' ? colors.warning : `${colors.cream200}40`;

const statusLabel = (s: Session['status']) =>
  s === 'active' ? 'active' : s === 'paused' ? 'paused' : 'ended';

export const VigieSidebar: React.FC<VigieSidebarProps> = ({
  sessions,
  activeSessionId,
  activeNav = 'sessions',
}) => {
  return (
    <div
      style={{
        width: 240,
        height: '100%',
        background: `${colors.navy900}E0`,
        borderRight: `1px solid ${colors.vigie400}12`,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '18px 20px',
          borderBottom: `1px solid ${colors.cream200}10`,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <RadarLogo />
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: colors.vigie400,
            fontFamily: fonts.display,
          }}
        >
          vigie
        </span>
      </div>

      {/* Host */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${colors.cream200}08`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.success,
            boxShadow: `0 0 6px ${colors.success}60`,
          }}
        />
        <span style={{ fontSize: 12, color: `${colors.cream200}80`, fontFamily: fonts.mono }}>
          MacBook-Pro
        </span>
      </div>

      {/* Nav */}
      <div style={{ padding: '12px 10px' }}>
        <NavItem label="Sessions" active={activeNav === 'sessions'} count={sessions.length} />
        <NavItem label="Terminal" active={activeNav === 'terminal'} />
      </div>

      {/* Sessions list */}
      <div
        style={{
          padding: '4px 10px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontFamily: fonts.mono,
            color: `${colors.cream200}40`,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            padding: '4px 8px',
          }}
        >
          Active ({sessions.filter((s) => s.status === 'active').length})
        </div>
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isActive={session.id === activeSessionId}
          />
        ))}
      </div>

      {/* User */}
      <div
        style={{
          padding: '14px 16px',
          borderTop: `1px solid ${colors.cream200}08`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: `${colors.vigie400}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            color: colors.vigie400,
            fontWeight: 600,
          }}
        >
          D
        </div>
        <span style={{ fontSize: 12, color: `${colors.cream200}90`, fontFamily: fonts.display }}>
          damien.meur
        </span>
      </div>
    </div>
  );
};

const NavItem: React.FC<{ label: string; active: boolean; count?: number }> = ({
  label,
  active,
  count,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 12px',
      borderRadius: 8,
      background: active ? `${colors.vigie400}12` : 'transparent',
      border: active ? `1px solid ${colors.vigie400}20` : '1px solid transparent',
      marginBottom: 2,
    }}
  >
    <span
      style={{
        fontSize: 13,
        color: active ? colors.cream50 : `${colors.cream200}70`,
        fontFamily: fonts.display,
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </span>
    {count !== undefined && (
      <span
        style={{
          fontSize: 10,
          color: `${colors.cream200}50`,
          fontFamily: fonts.mono,
          background: `${colors.cream200}08`,
          borderRadius: 10,
          padding: '2px 7px',
        }}
      >
        {count}
      </span>
    )}
  </div>
);

const SessionCard: React.FC<{ session: Session; isActive: boolean }> = ({ session, isActive }) => (
  <div
    style={{
      padding: '10px 12px',
      borderRadius: 8,
      background: isActive ? `${colors.navy700}80` : `${colors.navy800}40`,
      border: `1px solid ${isActive ? `${colors.vigie400}25` : `${colors.cream200}08`}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          background: `${colors.vigie400}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 10,
          fontWeight: 700,
          color: colors.vigie400,
        }}
      >
        C
      </div>
      <span style={{ fontSize: 12, fontFamily: fonts.mono, color: colors.cream50 }}>
        {session.id}
      </span>
      <div style={{ flex: 1 }} />
      <div
        style={{
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: statusColor(session.status),
          boxShadow: session.status === 'active' ? `0 0 6px ${colors.success}50` : 'none',
        }}
      />
      <span
        style={{
          fontSize: 10,
          fontFamily: fonts.mono,
          color: statusColor(session.status),
          textTransform: 'uppercase',
        }}
      >
        {statusLabel(session.status)}
      </span>
    </div>
    <span style={{ fontSize: 11, fontFamily: fonts.mono, color: `${colors.cream200}50` }}>
      {session.project}
    </span>
    <span style={{ fontSize: 10, fontFamily: fonts.mono, color: `${colors.cream200}30` }}>
      {session.time}
    </span>
  </div>
);

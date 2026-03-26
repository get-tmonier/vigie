import type React from 'react';
import { colors, fonts } from './theme';

interface BrowserFrameProps {
  url: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const BrowserFrame: React.FC<BrowserFrameProps> = ({ url, children, style }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${colors.vigie400}15`,
        boxShadow: `0 0 0 1px rgba(38,192,154,0.08), 0 32px 80px rgba(0,0,0,0.5)`,
        ...style,
      }}
    >
      {/* Chrome bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 16px',
          background: `${colors.navy800}CC`,
          borderBottom: `1px solid ${colors.vigie400}15`,
        }}
      >
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.danger }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.warning }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.success }} />
        </div>
        {/* Address bar */}
        <div
          style={{
            flex: 1,
            maxWidth: 420,
            margin: '0 auto',
            background: `${colors.navy900}CC`,
            border: `1px solid ${colors.cream200}20`,
            borderRadius: 8,
            padding: '6px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="12" height="14" viewBox="0 0 10 12" fill="none">
            <path
              d="M5 0C3.067 0 1.5 1.567 1.5 3.5V5H1C0.448 5 0 5.448 0 6v5c0 .552.448 1 1 1h8c.552 0 1-.448 1-1V6c0-.552-.448-1-1-1H8.5V3.5C8.5 1.567 6.933 0 5 0zm2.5 5h-5V3.5C2.5 2.12 3.62 1 5 1s2.5 1.12 2.5 2.5V5z"
              fill={`${colors.cream200}50`}
            />
          </svg>
          <span style={{ fontSize: 13, color: `${colors.cream200}90`, fontFamily: fonts.mono }}>
            {url}
          </span>
        </div>
      </div>
      {/* Content */}
      <div style={{ flex: 1, background: colors.navy900, position: 'relative', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
};

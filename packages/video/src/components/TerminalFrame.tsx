import type React from 'react';
import { colors, fonts } from './theme';

interface TerminalFrameProps {
  title: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export const TerminalFrame: React.FC<TerminalFrameProps> = ({ title, children, style }) => {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${colors.cream200}12`,
        boxShadow: `0 16px 48px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)`,
        ...style,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: `${colors.navy800}90`,
          borderBottom: `1px solid ${colors.cream200}12`,
        }}
      >
        <div style={{ display: 'flex', gap: 7 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.danger }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.warning }} />
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: colors.success }} />
        </div>
        <span style={{ fontSize: 12, color: `${colors.cream200}50`, fontFamily: fonts.mono }}>
          {title}
        </span>
      </div>
      {/* Terminal body */}
      <div
        style={{
          flex: 1,
          background: `${colors.navy900}F0`,
          padding: '16px 20px',
          fontFamily: fonts.mono,
          fontSize: 14,
          lineHeight: 1.8,
          color: colors.cream200,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </div>
    </div>
  );
};

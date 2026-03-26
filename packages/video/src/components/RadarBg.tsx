import { useCurrentFrame } from 'remotion';
import { colors } from './theme';

export const RadarBg: React.FC<{ opacity?: number }> = ({ opacity = 0.04 }) => {
  const frame = useCurrentFrame();
  const angle = (frame * 1.5) % 360;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      <svg width="800" height="800" viewBox="0 0 800 800">
        {/* Concentric rings */}
        {[100, 200, 300, 380].map((r) => (
          <circle
            key={r}
            cx={400}
            cy={400}
            r={r}
            fill="none"
            stroke={colors.vigie400}
            strokeWidth={0.5}
            opacity={0.5}
          />
        ))}
        {/* Cross hairs */}
        <line x1={400} y1={20} x2={400} y2={780} stroke={colors.vigie400} strokeWidth={0.3} opacity={0.3} />
        <line x1={20} y1={400} x2={780} y2={400} stroke={colors.vigie400} strokeWidth={0.3} opacity={0.3} />
        {/* Sweep */}
        <g transform={`rotate(${angle} 400 400)`}>
          <defs>
            <linearGradient id="sweep" gradientTransform="rotate(90)">
              <stop offset="0%" stopColor={`${colors.vigie400}00`} />
              <stop offset="100%" stopColor={`${colors.vigie400}40`} />
            </linearGradient>
          </defs>
          <path d={`M400,400 L400,20 A380,380 0 0,1 ${400 + 380 * Math.sin(Math.PI / 4)},${400 - 380 * Math.cos(Math.PI / 4)} Z`} fill="url(#sweep)" />
        </g>
        {/* Center dot */}
        <circle cx={400} cy={400} r={4} fill={colors.vigie400} opacity={0.6} />
      </svg>
    </div>
  );
};

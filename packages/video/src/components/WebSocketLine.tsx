import { interpolate, useCurrentFrame } from 'remotion';
import { colors } from './theme';

interface WebSocketLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  opacity: number;
  showPulse?: boolean;
}

export const WebSocketLine: React.FC<WebSocketLineProps> = ({
  x1,
  y1,
  x2,
  y2,
  opacity,
  showPulse = true,
}) => {
  const frame = useCurrentFrame();
  const dashOffset = frame * 2;

  // Pulse dot position along the line
  const pulseT = ((frame * 1.5) % 100) / 100;
  const px = x1 + (x2 - x1) * pulseT;
  const py = y1 + (y2 - y1) * pulseT;

  // Data packet dots
  const packets = [0.15, 0.45, 0.75].map((base) => {
    const t = ((base + (frame * 1.2) / 100) % 1);
    return {
      x: x1 + (x2 - x1) * t,
      y: y1 + (y2 - y1) * t,
      opacity: Math.sin(t * Math.PI) * 0.8,
    };
  });

  return (
    <svg
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 30,
        opacity,
      }}
    >
      {/* Glow line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colors.vigie400}
        strokeWidth={3}
        strokeOpacity={0.15}
        filter="blur(4px)"
      />
      {/* Dashed line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colors.vigie400}
        strokeWidth={1.5}
        strokeOpacity={0.5}
        strokeDasharray="6 8"
        strokeDashoffset={-dashOffset}
      />
      {/* Data packets */}
      {showPulse &&
        packets.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3}
            fill={colors.vigie400}
            opacity={p.opacity}
          >
          </circle>
        ))}
      {/* Badge */}
      <g opacity={0.8}>
        <rect
          x={(x1 + x2) / 2 - 50}
          y={(y1 + y2) / 2 - 10}
          width={100}
          height={20}
          rx={10}
          fill={`${colors.success}12`}
          stroke={`${colors.success}35`}
          strokeWidth={1}
        />
        <circle cx={(x1 + x2) / 2 - 34} cy={(y1 + y2) / 2} r={3} fill={colors.success}>
          <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
        </circle>
        <text
          x={(x1 + x2) / 2 + 4}
          y={(y1 + y2) / 2 + 4}
          fontSize={9}
          fill={colors.success}
          fontFamily="JetBrains Mono, monospace"
          textAnchor="middle"
        >
          ws://localhost
        </text>
      </g>
    </svg>
  );
};

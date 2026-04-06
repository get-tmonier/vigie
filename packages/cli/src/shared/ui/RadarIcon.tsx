interface RadarIconProps {
  size?: number;
  className?: string;
}

export function RadarIcon({ size = 24, className = '' }: RadarIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`vigie-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ECFB0" />
          <stop offset="100%" stopColor="#178A6A" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="24" fill="none" stroke={`url(#vigie-${size})`} strokeWidth="2.5" />
      <circle
        cx="32"
        cy="32"
        r="16"
        fill="none"
        stroke={`url(#vigie-${size})`}
        strokeWidth="1.5"
        opacity="0.7"
      />
      <circle
        cx="32"
        cy="32"
        r="8"
        fill="none"
        stroke={`url(#vigie-${size})`}
        strokeWidth="1"
        opacity="0.5"
      />
      <circle cx="32" cy="32" r="3.5" fill={`url(#vigie-${size})`} />
      <line
        x1="32"
        y1="8"
        x2="32"
        y2="2"
        stroke={`url(#vigie-${size})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="52.8"
        y1="20"
        x2="57.4"
        y2="16.4"
        stroke={`url(#vigie-${size})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <line
        x1="52.8"
        y1="44"
        x2="57.4"
        y2="47.6"
        stroke={`url(#vigie-${size})`}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

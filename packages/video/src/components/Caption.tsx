import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, fonts } from './theme';

interface CaptionProps {
  text: string;
  sub?: string;
  startFrame: number;
  endFrame: number;
  position?: 'bottom' | 'top' | 'center';
}

export const Caption: React.FC<CaptionProps> = ({
  text,
  sub,
  startFrame,
  endFrame,
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const inProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 16, stiffness: 70 },
    durationInFrames: 20,
  });

  const outProgress = spring({
    frame: frame - (endFrame - 12),
    fps,
    config: { damping: 20, stiffness: 100 },
    durationInFrames: 12,
  });

  const opacity = inProgress * (1 - outProgress);
  const translateY = interpolate(inProgress, [0, 1], [30, 0]) + interpolate(outProgress, [0, 1], [0, -20]);

  if (frame < startFrame || frame > endFrame) return null;

  const posMap = {
    bottom: { bottom: 60, left: 0, right: 0 },
    top: { top: 60, left: 0, right: 0 },
    center: { top: '50%', left: 0, right: 0, transform: 'translateY(-50%)' },
  };

  return (
    <div
      style={{
        position: 'absolute',
        ...posMap[position],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        opacity,
        transform: `translateY(${translateY}px)`,
        zIndex: 50,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: `${colors.navy900}E0`,
          backdropFilter: 'blur(16px)',
          border: `1px solid ${colors.vigie400}25`,
          borderRadius: 14,
          padding: '14px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.cream50,
            fontFamily: fonts.display,
            letterSpacing: '-0.01em',
          }}
        >
          {text}
        </span>
        {sub && (
          <span
            style={{
              fontSize: 14,
              color: `${colors.cream200}70`,
              fontFamily: fonts.mono,
            }}
          >
            {sub}
          </span>
        )}
      </div>
    </div>
  );
};

import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { colors } from './theme';

interface SceneTransitionProps {
  direction: 'in' | 'out';
  startFrame: number;
  durationFrames?: number;
}

export const SceneTransition: React.FC<SceneTransitionProps> = ({
  direction,
  startFrame,
  durationFrames = 15,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + durationFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = direction === 'in' ? 1 - progress : progress;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.navy900,
        opacity,
        pointerEvents: 'none',
        zIndex: 100,
      }}
    />
  );
};

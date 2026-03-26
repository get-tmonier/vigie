import { interpolate, useCurrentFrame } from 'remotion';
import { colors, fonts } from './theme';

interface TypedTextProps {
  text: string;
  startFrame: number;
  charsPerFrame?: number;
  style?: React.CSSProperties;
  cursorColor?: string;
  showCursor?: boolean;
}

export const TypedText: React.FC<TypedTextProps> = ({
  text,
  startFrame,
  charsPerFrame = 0.8,
  style,
  cursorColor = colors.vigie400,
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(Math.floor(elapsed * charsPerFrame), text.length);
  const displayText = text.slice(0, charCount);
  const isDone = charCount >= text.length;
  const cursorVisible = !isDone && frame % 20 < 14;

  return (
    <span
      style={{
        fontFamily: fonts.mono,
        whiteSpace: 'pre',
        ...style,
      }}
    >
      {displayText}
      {showCursor && !isDone && (
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: '1.1em',
            backgroundColor: cursorColor,
            opacity: cursorVisible ? 0.9 : 0,
            verticalAlign: 'text-bottom',
            marginLeft: 1,
          }}
        />
      )}
    </span>
  );
};

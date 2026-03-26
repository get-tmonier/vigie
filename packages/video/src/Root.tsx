import { Composition } from 'remotion';
import { AppShowcase } from './compositions/AppShowcase';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="AppShowcase"
      component={AppShowcase}
      durationInFrames={3600}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};

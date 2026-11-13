import { CallSettings } from 'src/features/visits/telemed/components/appointment/CallSettings';
import { defineStory } from '../../harness/story';
import { ChimeProviders } from './_chime';

export default defineStory({
  title: 'Call settings (during a video call)',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/CallSettings.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Virtual visit → video call window → settings (gear) button',
  notes:
    'Rendered inside the real Chime provider stack but without a joined meeting, in a browser with no camera/mic: the Camera and Microphone selects are empty and the video preview is blank.',
  render: () => (
    <ChimeProviders>
      <CallSettings onClose={() => undefined} />
    </ChimeProviders>
  ),
});

import { PreCallSettingsDialog } from 'src/features/visits/telemed/components/appointment/PreCallSettingsDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Call settings (before connecting to patient)',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/PreCallSettingsDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Virtual visit → footer → "Connect to Patient"',
  notes:
    'Captured in a browser with no camera/mic: the Camera and Microphone selects are empty and the video preview is blank.',
  render: () => <PreCallSettingsDialog open onClose={() => undefined} onConnect={async () => undefined} />,
});

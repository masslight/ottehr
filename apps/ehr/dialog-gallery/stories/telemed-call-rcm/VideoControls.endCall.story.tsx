import { dataTestIds } from 'src/constants/data-test-ids';
import { VideoControls } from 'src/features/visits/telemed/components/appointment/VideoControls';
import { defineStory } from '../../harness/story';
import { ChimeProviders } from './_chime';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'End video call confirmation',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/VideoControls.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Virtual visit → video call window → red "end call" button',
  ...visitRoute,
  mocks: visitMocks(),
  notes: 'VideoControls rendered in the real Chime provider stack without a joined meeting.',
  render: () => (
    <ChimeProviders>
      <VideoControls />
    </ChimeProviders>
  ),
  play: async ({ user, screen }) => {
    const icon = await screen.findByTestId(dataTestIds.telemedEhrFlow.endVideoCallButton);
    await user.click(icon.closest('button') as HTMLElement);
  },
});

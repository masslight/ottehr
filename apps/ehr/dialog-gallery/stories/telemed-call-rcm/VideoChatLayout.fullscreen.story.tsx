import { VideoChatContainer } from 'src/features/visits/telemed/components/appointment/VideoChatContainer';
import { defineStory } from '../../harness/story';
import { ChimeProviders } from './_chime';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Video call window (full screen)',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/VideoChatLayout.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Virtual visit → video call window → "full screen" button',
  ...visitRoute,
  mocks: visitMocks(),
  notes:
    'Real VideoChatContainer in the real Chime provider stack, but no meeting is joined: no video tiles. The footer inside the dialog is the real VirtualAppointmentFooter with no appointment data loaded.',
  render: () => (
    <ChimeProviders>
      <VideoChatContainer />
    </ChimeProviders>
  ),
  play: async ({ user, screen }) => {
    const icon = await screen.findByTestId('OpenInFullIcon');
    await user.click(icon.closest('button') as HTMLElement);
  },
});

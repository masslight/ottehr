import { VideoChatContainer } from 'src/features/visits/telemed/components/appointment/VideoChatContainer';
import { defineStory } from '../../harness/story';
import { ChimeProviders } from './_chime';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Video call window (picture-in-picture, draggable)',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/VideoChatLayout.tsx',
  base: 'MUI Dialog',
  kind: 'viewer',
  where: 'Virtual visit → after connecting to the patient (default layout)',
  ...visitRoute,
  mocks: visitMocks(),
  notes:
    'Real VideoChatContainer (VideoChatLayout + VideoRoom) in the real Chime provider stack, but no meeting is joined: there are no local/remote video tiles and the timer is at its initial value. Backdrop-less dialog with a draggable Card as paper.',
  render: () => (
    <ChimeProviders>
      <VideoChatContainer />
    </ChimeProviders>
  ),
});

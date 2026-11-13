import InviteParticipant from 'src/features/visits/telemed/components/appointment/InviteParticipant';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Invite participant to video call',
  source: 'apps/ehr/src/features/visits/telemed/components/appointment/InviteParticipant.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Virtual visit → footer → "Invite participant"',
  route: '/in-person/appt-1',
  routePath: '/in-person/:id',
  render: () => <InviteParticipant modalOpen onClose={() => undefined} />,
});

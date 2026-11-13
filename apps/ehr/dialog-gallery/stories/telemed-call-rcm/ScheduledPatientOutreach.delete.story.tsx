import ScheduledPatientOutreach from 'src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach';
import { defineStory } from '../../harness/story';
import { AdminHeaderHost, outreachMocks } from './_outreach';

export default defineStory({
  title: 'Delete outreach action',
  source: 'apps/ehr/src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Admin → Outreach → Patient outreach → Configuration → trash icon on an action row',
  notes: 'Real page with a mocked outreach config (3 actions); the first listed action is the one being deleted.',
  route: '/admin/outreach/patient-outreach/configuration',
  mocks: outreachMocks,
  render: () => (
    <AdminHeaderHost>
      <ScheduledPatientOutreach outreachTab="configuration" />
    </AdminHeaderHost>
  ),
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Delete action' }))[0]);
  },
});

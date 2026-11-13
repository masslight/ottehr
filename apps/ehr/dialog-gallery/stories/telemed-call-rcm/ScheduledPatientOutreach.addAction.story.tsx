import ScheduledPatientOutreach from 'src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach';
import { defineStory } from '../../harness/story';
import { AdminHeaderHost, outreachMocks } from './_outreach';

export default defineStory({
  title: 'Add outreach action',
  source: 'apps/ehr/src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Outreach → Patient outreach → Configuration → "Add Action" header button',
  notes:
    'Real page with a mocked outreach config; the header buttons are portalled into a stand-in for the admin page header (AdminHeaderSlotProvider). Form shown with its default values.',
  route: '/admin/outreach/patient-outreach/configuration',
  mocks: outreachMocks,
  render: () => (
    <AdminHeaderHost>
      <ScheduledPatientOutreach outreachTab="configuration" />
    </AdminHeaderHost>
  ),
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add Action' }));
  },
});

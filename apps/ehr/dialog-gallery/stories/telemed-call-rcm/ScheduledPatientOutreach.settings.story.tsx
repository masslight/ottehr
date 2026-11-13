import ScheduledPatientOutreach from 'src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach';
import { defineStory } from '../../harness/story';
import { AdminHeaderHost, outreachMocks } from './_outreach';

export default defineStory({
  title: 'Patient notification settings',
  source: 'apps/ehr/src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Outreach → Patient outreach → Configuration → settings (gear) header button',
  notes:
    'Real page with a mocked outreach config; the header buttons are portalled into a stand-in for the admin page header (AdminHeaderSlotProvider). Time restriction is enabled in the mocked config so the fields are active.',
  route: '/admin/outreach/patient-outreach/configuration',
  mocks: outreachMocks,
  render: () => (
    <AdminHeaderHost>
      <ScheduledPatientOutreach outreachTab="configuration" />
    </AdminHeaderHost>
  ),
  play: async ({ user, screen }) => {
    const icon = await screen.findByTestId('SettingsOutlinedIcon');
    await user.click(icon.closest('button') as HTMLElement);
  },
});

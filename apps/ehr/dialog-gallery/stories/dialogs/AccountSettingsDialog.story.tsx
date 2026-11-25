import { AccountSettingsDialog } from 'src/components/dialogs/AccountSettingsDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Patient account settings (login phone numbers)',
  source: 'apps/ehr/src/components/dialogs/AccountSettingsDialog.tsx',
  base: 'AppDialog',
  kind: 'form',
  where: 'Patient page → "Account settings"',
  mocks: [
    {
      url: 'get-login-phone-numbers',
      response: { status: 200, output: { phoneNumbers: ['+12025550143', '+12025550178'] } },
    },
  ],
  notes: 'Phone numbers are mocked.',
  render: () => <AccountSettingsDialog patientId="patient-1" handleClose={() => undefined} />,
  play: async ({ waitFor }) => {
    await waitFor(() => {
      if (document.querySelectorAll('.MuiDialog-paper input').length < 2) throw new Error('phones not loaded');
    });
  },
});

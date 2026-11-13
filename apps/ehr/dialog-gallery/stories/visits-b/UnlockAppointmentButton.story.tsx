import { UnlockAppointmentButton } from 'src/features/visits/shared/components/review-tab/UnlockAppointmentButton';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Unlock signed appointment',
  source: 'apps/ehr/src/features/visits/shared/components/review-tab/UnlockAppointmentButton.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Visit → Review & Sign tab of a signed (locked) visit → "Unlock" button',
  ...visitRoute,
  mocks: visitMocks({ locked: true }),
  notes: 'Mock appointment carries the locked meta tag; the button only renders for locked visits.',
  render: () => <UnlockAppointmentButton />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Unlock' }, { timeout: 10000 }));
    await screen.findByRole('dialog');
  },
});

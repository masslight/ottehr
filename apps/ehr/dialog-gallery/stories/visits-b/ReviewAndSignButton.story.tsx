import { ReviewAndSignButton } from 'src/features/visits/shared/components/review-tab/ReviewAndSignButton';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Review and sign visit note',
  source: 'apps/ehr/src/features/visits/shared/components/review-tab/ReviewAndSignButton.tsx',
  base: 'ConfirmationDialog',
  kind: 'confirm',
  where: 'Visit → Review & Sign tab → "Review & Sign" button',
  ...visitRoute,
  mocks: visitMocks(),
  notes:
    'Mock discharged in-person visit with a complete chart so the button is enabled. The "Require Supervisor approval" checkbox only renders when the supervisor-approval feature flag is on and the signed-in provider is not a physician.',
  render: () => <ReviewAndSignButton />,
  play: async ({ user, screen, waitFor }) => {
    const button = await screen.findByRole('button', { name: 'Review & Sign' });
    await waitFor(
      () => {
        if ((button as HTMLButtonElement).disabled) throw new Error('Review & Sign still disabled');
      },
      { timeout: 10000 }
    );
    await user.click(button);
    await screen.findByRole('dialog');
  },
});

import { CompleteIntakeButton } from 'src/features/visits/in-person/components/CompleteIntakeButton';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_fixtures';
import { abnormalVitals } from './_vitals';

export default defineStory({
  title: 'Abnormal vital value (before completing intake)',
  source: 'apps/ehr/src/features/visits/in-person/components/CompleteIntakeButton.tsx',
  base: 'InPersonModal',
  kind: 'confirm',
  where: 'In-person visit sidebar → "Complete Intake" while the visit has abnormal vitals',
  ...visitRoute,
  mocks: [...visitMocks(), { url: 'get-vitals', response: { status: 200, output: abnormalVitals } }],
  render: () => <CompleteIntakeButton isDisabled={false} handleCompleteIntake={() => undefined} status="intake" />,
  play: async ({ user, screen, waitFor }) => {
    // Clicking before the vitals have loaded would complete intake without a dialog.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    await user.click(await waitFor(() => screen.getByRole('button', { name: 'Complete Intake' })));
  },
  notes:
    'Not in the original file list (InPersonModal via useReactNavigationBlocker). Abnormal vitals come from a mocked get-vitals response.',
});

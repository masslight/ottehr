import { PatientEducationCard } from 'src/features/visits/shared/components/plan-tab/PatientEducationCard';
import { defineStory } from '../../harness/story';
import { educationMocks } from './_education';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Review patient education materials (edit before PDF)',
  source: 'apps/ehr/src/features/visits/shared/components/plan-tab/PatientEducationCard.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit → Plan tab → Patient Education → Generate → review step',
  ...visitRoute,
  mocks: visitMocks({ extra: educationMocks }),
  notes:
    'Reached through the real flow (open generate dialog, click Generate) with mocked AI content for two diagnoses. Content is taller than the viewport, so the dialog scrolls.',
  render: () => <PatientEducationCard />,
  play: async ({ user, screen, waitFor }) => {
    const button = await screen.findByRole('button', { name: 'Patient Education' }, { timeout: 10000 });
    await waitFor(
      () => {
        if ((button as HTMLButtonElement).disabled) throw new Error('diagnoses not loaded yet');
      },
      { timeout: 10000 }
    );
    await user.click(button);
    await user.click(await screen.findByRole('button', { name: /^Generate \(2\)$/ }));
    await screen.findByText('Review Patient Education Materials', undefined, { timeout: 10000 });
  },
});

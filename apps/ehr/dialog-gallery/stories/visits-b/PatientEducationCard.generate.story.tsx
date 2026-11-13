import { PatientEducationCard } from 'src/features/visits/shared/components/plan-tab/PatientEducationCard';
import { defineStory } from '../../harness/story';
import { educationMocks } from './_education';
import { visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'Generate patient education materials (select diagnoses)',
  source: 'apps/ehr/src/features/visits/shared/components/plan-tab/PatientEducationCard.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Visit → Plan tab → Patient Education card → "Patient Education" button',
  ...visitRoute,
  mocks: visitMocks({ extra: educationMocks }),
  notes: 'Mock visit with two diagnoses; no pre-approved PDFs, mocked AI generation responses.',
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
    await screen.findByText('Generate Patient Education Materials');
  },
});

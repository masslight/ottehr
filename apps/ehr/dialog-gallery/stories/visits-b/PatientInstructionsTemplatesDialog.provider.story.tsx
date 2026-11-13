import { PatientInstructionsTemplatesDialog } from 'src/features/visits/shared/components/plan-tab/components/PatientInstructionsTemplatesDialog';
import { defineStory } from '../../harness/story';

const picks = [
  { title: 'Fever care', text: 'Offer fluids often. Use acetaminophen or ibuprofen as directed for comfort.' },
  { title: 'Sprain / strain', text: 'Rest, ice 20 minutes at a time, compress with an elastic wrap, and elevate.' },
  {
    title: 'Strep throat',
    text: 'Finish the full course of antibiotics. Return to school after 24 hours of treatment.',
  },
];

export default defineStory({
  title: 'Patient instructions: My Quick Picks',
  source: 'apps/ehr/src/features/visits/shared/components/plan-tab/components/PatientInstructionsTemplatesDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Visit → Plan tab → Patient Instructions → "My Quick Picks"',
  mocks: [
    {
      url: 'get-patient-instructions',
      response: { status: 200, output: picks.map((pick, index) => ({ ...pick, resourceId: `instruction-${index}` })) },
    },
    {
      url: 'admin-get-quick-picks',
      response: { status: 200, output: { quickPicks: picks.map(({ title, text }) => ({ name: title, text })) } },
    },
  ],
  notes: 'type="provider" (the same component renders both quick-pick lists; only "provider" shows the delete icon).',
  render: () => (
    <PatientInstructionsTemplatesDialog open onClose={() => undefined} type="provider" onSelect={() => undefined} />
  ),
  play: async ({ screen }) => {
    await screen.findByText('Fever care', undefined, { timeout: 10000 });
  },
});

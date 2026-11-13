import { PickerDialog } from 'src/features/visits/shared/components/scribe-recommendations/PickerDialog';
import { useScribeRecommendationsStore } from 'src/features/visits/shared/components/scribe-recommendations/scribeRecommendations.store';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'AutoChart: choose between near-equal catalogue matches',
  source: 'apps/ehr/src/features/visits/shared/components/scribe-recommendations/PickerDialog.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Visit → AutoChart panel → apply a single recommendation whose catalogue match is ambiguous',
  setup: () => {
    useScribeRecommendationsStore.setState({
      pendingPick: {
        prompt: 'Which in-house lab did you mean?',
        query: 'rapid strep',
        options: [
          { id: 'lab-1', display: 'Rapid Strep A', score: 0.92 },
          { id: 'lab-2', display: 'Strep A Culture (throat)', score: 0.9 },
          { id: 'lab-3', display: 'Rapid Strep A + Flu A/B combo', score: 0.87 },
        ],
        resolve: () => undefined,
      },
    });
  },
  notes:
    'The dialog is driven by the scribe store’s pendingPick, which the executor sets mid-apply; it is seeded directly here with a mock question instead of running an apply.',
  render: () => <PickerDialog />,
});

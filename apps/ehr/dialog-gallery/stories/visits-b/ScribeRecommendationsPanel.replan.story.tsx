import { Box } from '@mui/material';
import { useScribeRecommendationsStore } from 'src/features/visits/shared/components/scribe-recommendations/scribeRecommendations.store';
import { ScribeRecommendationsPanel } from 'src/features/visits/shared/components/scribe-recommendations/ScribeRecommendationsPanel';
import { defineStory } from '../../harness/story';
import { ENCOUNTER_ID, visitMocks, visitRoute } from './_visit';

export default defineStory({
  title: 'AutoChart: replace the suggestions? (plan note again)',
  source: 'apps/ehr/src/features/visits/shared/components/scribe-recommendations/ScribeRecommendationsPanel.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'Visit → AutoChart panel → "Plan note" when a plan is already showing',
  ...visitRoute,
  mocks: visitMocks({ extra: [{ url: 'list-templates', response: { status: 200, output: { templates: [] } } }] }),
  setup: () => {
    // A finished plan for this encounter with a typed narrative: the state in which "Plan note" asks first.
    useScribeRecommendationsStore.setState({
      encounterId: ENCOUNTER_ID,
      phase: 'ready',
      planRequested: true,
      narrativeStatus: 'ready',
      narrativeDraft:
        'Seven-year-old with two days of sore throat and fever to 101.8. No cough. Rapid strep positive. Starting amoxicillin for ten days.',
    });
  },
  notes:
    'Scribe store seeded to the "plan ready" phase with a narrative (no model call is made); the dialog is opened by clicking the real "Plan note" button. The panel behind it shows an empty plan.',
  render: () => (
    <Box sx={{ width: 420, height: '100vh', ml: 'auto', borderLeft: '1px solid', borderColor: 'divider' }}>
      <ScribeRecommendationsPanel onCollapse={() => undefined} />
    </Box>
  ),
  play: async ({ user, screen, waitFor }) => {
    const button = await screen.findByRole('button', { name: 'Plan note' }, { timeout: 10000 });
    await waitFor(
      () => {
        if ((button as HTMLButtonElement).disabled) throw new Error('Plan note disabled');
      },
      { timeout: 10000 }
    );
    await user.click(button);
    await screen.findByText('Replace the suggestions?');
  },
});

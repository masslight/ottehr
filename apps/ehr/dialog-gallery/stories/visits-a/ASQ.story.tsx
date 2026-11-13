import { ASQ } from 'src/features/visits/in-person/components/screening/ASQ';
import { defineStory } from '../../harness/story';
import { visitMocks, visitRoute } from './_fixtures';

export default defineStory({
  title: 'Confirm ASQ Positive',
  source: 'apps/ehr/src/features/visits/in-person/components/screening/ASQ.tsx',
  base: 'InPersonModal',
  kind: 'confirm',
  where: 'In-person visit → Screening → ASQ dropdown → select "Positive"',
  ...visitRoute,
  mocks: visitMocks(),
  render: () => <ASQ />,
  play: async ({ user, screen, waitFor }) => {
    const select = await waitFor(
      () => {
        const el = screen.getByRole('combobox');
        if (el.getAttribute('aria-disabled') === 'true') throw new Error('ASQ select still disabled');
        return el;
      },
      { timeout: 10000 }
    );
    await user.click(select);
    await user.click(await waitFor(() => screen.getByRole('option', { name: 'Positive' })));
  },
  notes: 'Not in the original file list (uses the InPersonModal wrapper).',
});

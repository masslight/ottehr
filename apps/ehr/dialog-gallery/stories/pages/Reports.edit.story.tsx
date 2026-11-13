import Reports from 'src/pages/Reports';
import { defineStory } from '../../harness/story';
import { reportsMocks } from './_reports';

export default defineStory({
  title: 'Edit saved ad-hoc report (name + description)',
  source: 'apps/ehr/src/pages/Reports.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Reports → Saved reports → edit (pencil) icon on a saved report tile',
  route: '/reports',
  mocks: reportsMocks,
  render: () => <Reports />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Edit' }, { timeout: 10000 }));
    await screen.findByText('Edit report');
  },
  notes: 'Signed-in user mocked as Administrator; one saved report returned by a mocked list-adhoc-reports zambda.',
});

import Reports from 'src/pages/Reports';
import { defineStory } from '../../harness/story';
import { reportsMocks } from './_reports';

export default defineStory({
  title: 'Delete saved ad-hoc report',
  source: 'apps/ehr/src/pages/Reports.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Reports → Saved reports → delete (trash) icon on a saved report tile',
  route: '/reports',
  mocks: reportsMocks,
  render: () => <Reports />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Delete' }, { timeout: 10000 }));
    await screen.findByText('Delete saved report');
  },
  notes: 'Signed-in user mocked as Administrator; one saved report returned by a mocked list-adhoc-reports zambda.',
});

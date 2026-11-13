import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Add medication quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Medications tab → Add',
  notes:
    'QuickPickEditor is a generic list+dialog; its caller (QuickPicksAdminPage.tsx) supplies the title and fields, so the caller is rendered on the "medications" tab.',
  route: '/admin/quick-picks/medications',
  routePath: '/admin/quick-picks/:subTab',
  mocks: [
    quickPicks([
      { id: 'qp-1', name: 'Lisinopril', strength: '10 mg' },
      { id: 'qp-2', name: 'Metformin', strength: '500 mg' },
    ]),
  ],
  render: () => <QuickPicksAdminPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await screen.findByRole('dialog');
  },
});

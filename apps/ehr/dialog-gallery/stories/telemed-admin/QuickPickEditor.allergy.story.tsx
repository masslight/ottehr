import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Add allergy quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Allergies tab → Add',
  notes:
    'QuickPickEditor is a generic list+dialog; its caller (QuickPicksAdminPage.tsx) supplies the title and fields, so the caller is rendered on the "allergies" tab.',
  route: '/admin/quick-picks/allergies',
  routePath: '/admin/quick-picks/:subTab',
  mocks: [
    quickPicks([
      { id: 'qp-1', name: 'Penicillin', allergyId: 1 },
      { id: 'qp-2', name: 'Latex', allergyId: 2 },
    ]),
  ],
  render: () => <QuickPicksAdminPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await screen.findByRole('dialog');
  },
});

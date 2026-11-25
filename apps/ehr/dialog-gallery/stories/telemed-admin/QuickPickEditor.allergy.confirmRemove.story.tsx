import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Remove allergy quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  notes: 'Replaces a native window.confirm() prompt, so there is no "before" screenshot.',
  where: 'Admin → Quick Picks → Allergies tab → remove (trash) icon on a row',
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
    await user.click((await screen.findAllByRole('button', { name: 'Remove' }))[0]);
    await screen.findByRole('dialog');
  },
});

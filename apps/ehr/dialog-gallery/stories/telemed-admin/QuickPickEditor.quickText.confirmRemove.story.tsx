import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Remove quick text',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  notes: 'Replaces a native window.confirm() prompt, so there is no "before" screenshot.',
  where: 'Admin → Quick Picks → Quick Texts tab → remove (trash) icon on a row',
  route: '/admin/quick-picks/quick-texts',
  routePath: '/admin/quick-picks/:subTab',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Paperwork reminder',
        english: 'Please complete your paperwork before your visit.',
        spanish: 'Por favor complete su documentación antes de su visita.',
      },
    ]),
  ],
  render: () => <QuickPicksAdminPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Remove' }))[0]);
    await screen.findByRole('dialog');
  },
});

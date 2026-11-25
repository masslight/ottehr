import DmeQuickPicksPage from 'src/features/visits/telemed/components/admin/DmeQuickPicksPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Remove DME quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/DmeQuickPicksPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  notes: 'Replaces a native window.confirm() prompt, so there is no "before" screenshot.',
  where: 'Admin → Quick Picks → DME tab → remove (trash) icon on a row',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Ankle brace',
        itemName: 'Ankle stirrup brace',
        billingCodes: [{ code: 'L1906', display: 'Ankle foot orthosis' }],
        quantity: 1,
        laterality: 'Left',
      },
      {
        id: 'qp-2',
        name: 'Crutches',
        itemName: 'Underarm crutches, pair',
        billingCodes: [{ code: 'E0114', display: 'Crutches underarm' }],
        quantity: 1,
      },
    ]),
  ],
  render: () => <DmeQuickPicksPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: /^Remove / }))[0]);
    await screen.findByRole('dialog');
  },
});

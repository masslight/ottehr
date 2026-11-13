import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Add medical condition quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Medical Conditions tab → Add',
  notes:
    'QuickPickEditor is a generic list+dialog; its caller (QuickPicksAdminPage.tsx) supplies the title and fields, so the caller is rendered on the "medical-conditions" tab.',
  route: '/admin/quick-picks/medical-conditions',
  routePath: '/admin/quick-picks/:subTab',
  mocks: [
    quickPicks([
      { id: 'qp-1', display: 'Essential (primary) hypertension', code: 'I10' },
      { id: 'qp-2', display: 'Type 2 diabetes mellitus without complications', code: 'E11.9' },
    ]),
  ],
  render: () => <QuickPicksAdminPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    await screen.findByRole('dialog');
  },
});

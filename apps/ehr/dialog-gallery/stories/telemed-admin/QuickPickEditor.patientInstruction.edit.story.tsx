import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Edit patient instruction quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Patient Instructions tab → edit (pencil) icon on a row',
  notes:
    'QuickPickEditor is a generic list+dialog; its caller (QuickPicksAdminPage.tsx) supplies the title and fields, so the caller is rendered on the "patient-instructions" tab.',
  route: '/admin/quick-picks/patient-instructions',
  routePath: '/admin/quick-picks/:subTab',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Ankle sprain care',
        text: 'Rest, ice, compress and elevate the ankle for the first 48 hours. Return if swelling or pain worsens.',
      },
    ]),
  ],
  render: () => <QuickPicksAdminPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    await screen.findByRole('dialog');
  },
});

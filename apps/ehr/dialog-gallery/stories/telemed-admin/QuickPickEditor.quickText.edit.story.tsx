import QuickPicksAdminPage from 'src/features/visits/telemed/components/admin/QuickPicksAdminPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Edit quick text',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/QuickPickEditor.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Quick Texts tab → edit (pencil) icon on a row',
  notes:
    'QuickPickEditor is a generic list+dialog; its caller (QuickPicksAdminPage.tsx) supplies the title and fields, so the caller is rendered on the "quick-texts" tab.',
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
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    await screen.findByRole('dialog');
  },
});

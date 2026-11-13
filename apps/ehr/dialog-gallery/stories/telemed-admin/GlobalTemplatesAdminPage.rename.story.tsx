import GlobalTemplatesAdminPage from 'src/features/visits/telemed/components/admin/GlobalTemplatesAdminPage';
import { defineStory } from '../../harness/story';
import { zambda } from './_mocks';

export default defineStory({
  title: 'Rename global template',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/GlobalTemplatesAdminPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Global Templates → rename icon on a row',
  mocks: [
    zambda('list-templates', {
      templates: [
        { id: 'tpl-1', title: 'Ankle sprain', examVersion: '1' },
        { id: 'tpl-2', title: 'Strep pharyngitis', examVersion: '1' },
        { id: 'tpl-3', title: 'Upper respiratory infection', examVersion: '1' },
      ],
    }),
  ],
  render: () => <GlobalTemplatesAdminPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Rename template' }))[0]);
    await screen.findByRole('dialog');
  },
});

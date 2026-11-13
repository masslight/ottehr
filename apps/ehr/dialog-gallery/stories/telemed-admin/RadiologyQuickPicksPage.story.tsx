import RadiologyQuickPicksPage from 'src/features/visits/telemed/components/admin/RadiologyQuickPicksPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Rename radiology quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/RadiologyQuickPicksPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Radiology tab → rename (pencil) icon on a row',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Chest X-ray 2 views',
        studyName: 'X-ray chest',
        cptCode: '71046',
        cptDisplay: 'X-ray exam chest 2 views',
      },
      {
        id: 'qp-2',
        name: 'Left ankle X-ray',
        studyName: 'X-ray ankle',
        cptCode: '73610',
        cptDisplay: 'X-ray exam of ankle',
      },
    ]),
  ],
  render: () => <RadiologyQuickPicksPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Rename' }))[0]);
    await screen.findByRole('dialog');
  },
});

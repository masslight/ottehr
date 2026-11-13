import ProcedureQuickPicksPage from 'src/features/visits/telemed/components/admin/ProcedureQuickPicksPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Rename procedure quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/ProcedureQuickPicksPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Procedures tab → rename (pencil) icon on a row',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Laceration repair, simple',
        procedureType: 'Laceration Repair',
        cptCodes: [{ code: '12001', display: 'Simple repair of superficial wounds' }],
      },
      {
        id: 'qp-2',
        name: 'Splint application, forearm',
        procedureType: 'Splint Application',
        cptCodes: [{ code: '29125', display: 'Application of short arm splint' }],
      },
    ]),
  ],
  render: () => <ProcedureQuickPicksPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Rename' }))[0]);
    await screen.findByRole('dialog');
  },
});

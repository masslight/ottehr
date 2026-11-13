import InHouseMedicationQuickPicksPage from 'src/features/visits/telemed/components/admin/InHouseMedicationQuickPicksPage';
import { defineStory } from '../../harness/story';
import { quickPicks } from './_mocks';

export default defineStory({
  title: 'Rename in-house medication quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/InHouseMedicationQuickPicksPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → In-House Medications tab → rename (pencil) icon on a row',
  mocks: [
    quickPicks([
      { id: 'qp-1', name: 'Ibuprofen 600 mg PO', medicationName: 'Ibuprofen', dose: 600, units: 'mg', route: 'Oral' },
      {
        id: 'qp-2',
        name: 'Ketorolac 30 mg IM',
        medicationName: 'Ketorolac',
        dose: 30,
        units: 'mg',
        route: 'Intramuscular',
      },
    ]),
  ],
  render: () => <InHouseMedicationQuickPicksPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Rename' }))[0]);
    await screen.findByRole('dialog');
  },
});

import InsuranceQuickPickPage from 'src/features/visits/telemed/components/admin/InsuranceQuickPickPage';
import { defineStory } from '../../harness/story';
import { quickPicks, zambda } from './_mocks';

export default defineStory({
  title: 'Edit insurance quick pick',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/InsuranceQuickPickPage.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Quick Picks → Insurance tab → edit (pencil) icon on a row',
  mocks: [
    quickPicks([
      {
        id: 'qp-1',
        name: 'Aetna PPO',
        payerId: '60054',
        organizationReference: 'Organization/org-1',
        organizationDisplay: '60054 - Aetna',
        insuranceType: '12',
        relationship: 'Self',
        metadata: [{ key: 'mco', value: 'AETNA BETTER HEALTH' }],
      },
      {
        id: 'qp-2',
        name: 'UnitedHealthcare HMO',
        payerId: '87726',
        organizationReference: 'Organization/org-5',
        organizationDisplay: '87726 - UnitedHealthcare',
      },
    ]),
    zambda('get-all-insurance-payers', [
      { valueReference: { reference: 'Organization/org-1', display: '60054 - Aetna' } },
      { valueReference: { reference: 'Organization/org-5', display: '87726 - UnitedHealthcare' } },
    ]),
  ],
  render: () => <InsuranceQuickPickPage />,
  play: async ({ user, screen }) => {
    await user.click((await screen.findAllByRole('button', { name: 'Edit' }))[0]);
    await screen.findByRole('dialog');
  },
});

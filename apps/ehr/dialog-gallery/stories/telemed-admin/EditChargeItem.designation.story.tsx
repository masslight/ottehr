import EditChargeItem from 'src/features/visits/telemed/components/admin/EditChargeItem';
import { defineStory } from '../../harness/story';
import { chargeMaster, locations, payers, zambda } from './_mocks';

export default defineStory({
  title: 'Confirm charge master designation',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/EditChargeItem.tsx',
  base: 'MUI Dialog',
  kind: 'confirm',
  where: 'Admin → Billing → Charge Masters → a charge master → Settings → "Set as Default Insurance Charge Master"',
  route: '/admin/billing/charge-masters/cm-1',
  routePath: '/admin/billing/charge-masters/:id',
  mocks: [
    zambda('list-charge-masters', [chargeMaster]),
    zambda('list-employers', []),
    { url: '/payer', response: { data: payers, metadata: { nextCursor: null } } },
    {
      url: /\/Location/,
      response: { resourceType: 'Bundle', type: 'searchset', entry: locations.map((resource) => ({ resource })) },
    },
  ],
  render: () => <EditChargeItem mode="charge-master" />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Set as Default Insurance Charge Master' }));
    await screen.findByRole('dialog');
  },
});

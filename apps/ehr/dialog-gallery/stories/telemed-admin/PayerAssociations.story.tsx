import PayerAssociations from 'src/features/visits/telemed/components/admin/charge-items/PayerAssociations';
import { defineStory } from '../../harness/story';
import { employers, feeSchedule, payers, zambda } from './_mocks';

export default defineStory({
  title: 'Associate payers with a fee schedule',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/charge-items/PayerAssociations.tsx',
  base: 'MUI Dialog',
  kind: 'picker',
  where: 'Admin → Billing → Fee Schedules / Charge Masters → an entry → Payer Associations tab → Add payer',
  mocks: [
    { url: '/payer', response: { data: payers, metadata: { nextCursor: null } } },
    zambda('list-employers', employers),
  ],
  render: () => <PayerAssociations feeSchedule={feeSchedule} isFetching={false} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: /^Add / }));
    await screen.findByText('Cigna');
  },
});

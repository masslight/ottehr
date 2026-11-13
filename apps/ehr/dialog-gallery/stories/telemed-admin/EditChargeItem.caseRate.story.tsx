import EditChargeItem from 'src/features/visits/telemed/components/admin/EditChargeItem';
import { defineStory } from '../../harness/story';
import { feeSchedule, locations, payers, zambda } from './_mocks';

export default defineStory({
  title: 'Switch fee schedule to case rate',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/EditChargeItem.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Admin → Billing → Fee Schedules → a fee schedule → Settings → "Switch to Case Rate"',
  notes: 'Only shown when the fee schedule already has procedure codes (the mock has five).',
  route: '/admin/billing/fee-schedules/fs-1',
  routePath: '/admin/billing/fee-schedules/:id',
  mocks: [
    zambda('list-fee-schedules', [feeSchedule]),
    zambda('list-employers', []),
    { url: '/payer', response: { data: payers, metadata: { nextCursor: null } } },
    {
      url: /\/Location/,
      response: { resourceType: 'Bundle', type: 'searchset', entry: locations.map((resource) => ({ resource })) },
    },
  ],
  render: () => <EditChargeItem mode="fee-schedule" />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Switch to Case Rate' }));
    await screen.findByRole('dialog');
  },
});

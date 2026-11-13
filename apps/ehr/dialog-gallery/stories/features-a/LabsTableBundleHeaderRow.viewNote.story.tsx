import { defineStory } from '../../harness/story';
import { LabsTableHost, makeLabOrder } from './_labs';

export default defineStory({
  title: 'Lab order level note (view existing)',
  source: 'apps/ehr/src/features/external-labs/components/labs-orders/LabsTableBundleHeaderRow.tsx',
  base: 'CustomDialog',
  kind: 'info',
  where: 'In-person visit → External labs → order bundle header → "View order level note"',
  render: () => <LabsTableHost labOrders={[makeLabOrder({})]} orderBundleNote="Patient fasting since 8 pm." />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'View order level note' }));
    await screen.findByRole('dialog');
  },
  notes: 'Same dialog as the add-note story, in its read-only state for an order that already has a note.',
});

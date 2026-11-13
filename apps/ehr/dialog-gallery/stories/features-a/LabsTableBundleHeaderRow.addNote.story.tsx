import { defineStory } from '../../harness/story';
import { LabsTableHost, makeLabOrder } from './_labs';

export default defineStory({
  title: 'Lab order level note (add)',
  source: 'apps/ehr/src/features/external-labs/components/labs-orders/LabsTableBundleHeaderRow.tsx',
  base: 'CustomDialog',
  kind: 'form',
  where: 'In-person visit → External labs → order bundle header → "Add order level note"',
  render: () => <LabsTableHost labOrders={[makeLabOrder({})]} />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'Add order level note' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(dialog.querySelector('textarea') as HTMLTextAreaElement, 'Patient fasting since 8 pm.');
  },
  notes: 'Rendered through the real LabsTableContainer; a note is typed in.',
});

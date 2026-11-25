import { defineStory } from '../../harness/story';
import { LabsTableHost, makeLabOrder } from './_labs';

export default defineStory({
  title: 'Lab order level note (edit existing)',
  source: 'apps/ehr/src/features/external-labs/components/labs-orders/LabsTableBundleHeaderRow.tsx',
  base: 'AppDialog',
  kind: 'form',
  where: 'In-person visit → External labs → order bundle header → "View order level note" → "Edit note"',
  render: () => <LabsTableHost labOrders={[makeLabOrder({})]} orderBundleNote="Patient fasting since 8 pm." />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByRole('button', { name: 'View order level note' }));
    await user.click(await screen.findByRole('button', { name: /^Edit note$/i }));
    await screen.findByRole('textbox');
  },
  notes: 'Same dialog as the view-note story after pressing its edit button: the note becomes an editable field.',
});

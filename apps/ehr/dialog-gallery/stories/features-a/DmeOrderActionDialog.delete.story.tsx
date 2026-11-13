import { DmeOrderActionDialog } from 'src/features/dme/components/DmeOrderActionDialog';
import { defineStory } from '../../harness/story';
import { dmeOrder } from './_dme';

export default defineStory({
  title: 'Delete DME order',
  source: 'apps/ehr/src/features/dme/components/DmeOrderActionDialog.tsx',
  base: 'InPersonModal',
  kind: 'destructive-confirm',
  where: 'In-person visit → DME orders table / order details → delete',
  render: () => <DmeOrderActionDialog order={dmeOrder} action="delete" open onClose={() => undefined} />,
});

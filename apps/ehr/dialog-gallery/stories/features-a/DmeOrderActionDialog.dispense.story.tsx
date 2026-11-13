import { DmeOrderActionDialog } from 'src/features/dme/components/DmeOrderActionDialog';
import { defineStory } from '../../harness/story';
import { dmeOrder } from './_dme';

export default defineStory({
  title: 'Dispense DME order',
  source: 'apps/ehr/src/features/dme/components/DmeOrderActionDialog.tsx',
  base: 'InPersonModal',
  kind: 'confirm',
  where: 'In-person visit → DME orders table / order details → "Dispense"',
  render: () => <DmeOrderActionDialog order={dmeOrder} action="dispense" open onClose={() => undefined} />,
});

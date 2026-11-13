import { PaperworkFlowDialog } from 'src/features/visits/telemed/components/admin/paperwork-flows/components/PaperworkFlowDialog';
import { ServiceMode } from 'utils/lib/types/common';
import { defineStory } from '../../harness/story';
import { flowForms, flowServices } from './_flows';

export default defineStory({
  title: 'Edit paperwork flow',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/paperwork-flows/components/PaperworkFlowDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Paperwork Flows → edit a flow',
  render: () => (
    <PaperworkFlowDialog
      open
      editingFlowId="flow-1"
      initial={{
        name: 'Occupational medicine intake',
        formsSelected: flowForms.slice(0, 2),
        modes: [ServiceMode['in-person']],
        services: flowServices.slice(0, 2),
      }}
      formOptions={flowForms}
      serviceCategories={flowServices}
      onClose={() => undefined}
    />
  ),
});

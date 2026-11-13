import { PaperworkFlowDialog } from 'src/features/visits/telemed/components/admin/paperwork-flows/components/PaperworkFlowDialog';
import { defineStory } from '../../harness/story';
import { flowForms, flowServices } from './_flows';

export default defineStory({
  title: 'New paperwork flow',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/paperwork-flows/components/PaperworkFlowDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Paperwork Flows → New flow',
  render: () => (
    <PaperworkFlowDialog
      open
      initial={{ name: '', formsSelected: [], modes: [], services: [] }}
      formOptions={flowForms}
      serviceCategories={flowServices}
      onClose={() => undefined}
    />
  ),
});

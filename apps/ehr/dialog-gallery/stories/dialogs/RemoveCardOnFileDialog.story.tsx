import RemoveCardOnFileDialog from 'src/components/dialogs/RemoveCardOnFileDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Card on file (step 1)',
  source: 'apps/ehr/src/components/dialogs/RemoveCardOnFileDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Patient payment / card-on-file indicator → click',
  notes: 'First of two steps in the same Dialog; canRemove=true (Billing Admin).',
  render: () => <RemoveCardOnFileDialog open onClose={() => undefined} onRemove={() => undefined} />,
});

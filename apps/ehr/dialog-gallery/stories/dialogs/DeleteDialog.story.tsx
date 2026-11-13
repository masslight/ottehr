import DeleteDialog from 'src/components/dialogs/DeleteDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'DeleteDialog (base, default props)',
  source: 'apps/ehr/src/components/dialogs/DeleteDialog.tsx',
  base: 'DeleteDialog',
  kind: 'destructive-confirm',
  where: 'Shared base component (built directly on MUI Dialog)',
  notes: 'Generic placeholder title/description; each caller supplies its own.',
  render: () => (
    <DeleteDialog
      open
      title="Dialog title"
      description="Body text passed as a plain string description."
      closeButtonText="Cancel"
      deleteButtonText="Delete"
      handleClose={() => undefined}
      handleDelete={() => undefined}
    />
  ),
});

import { CustomDialog } from 'src/components/dialogs/CustomDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'CustomDialog (base, default props)',
  source: 'apps/ehr/src/components/dialogs/CustomDialog.tsx',
  base: 'CustomDialog',
  kind: 'confirm',
  where: 'Shared base component',
  render: () => (
    <CustomDialog
      open
      handleClose={() => undefined}
      title="Dialog title"
      description="Body text passed as a plain string description."
      closeButtonText="Cancel"
      handleConfirm={() => undefined}
      confirmText="Confirm"
    />
  ),
});

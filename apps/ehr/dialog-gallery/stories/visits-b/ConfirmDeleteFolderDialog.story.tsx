import { ConfirmDeleteFolderDialog } from 'src/features/visits/shared/components/patient/docs/ConfirmDeleteFolderDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Delete documents folder',
  source: 'apps/ehr/src/features/visits/shared/components/patient/docs/ConfirmDeleteFolderDialog.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'Patient → Documents → custom folder menu → Delete',
  render: () => (
    <ConfirmDeleteFolderDialog
      open
      folderName="Referral Letters"
      onConfirm={async () => undefined}
      onClose={() => undefined}
    />
  ),
});

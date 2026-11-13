import { FolderNameDialog } from 'src/features/visits/shared/components/patient/docs/FolderNameDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Rename documents folder',
  source: 'apps/ehr/src/features/visits/shared/components/patient/docs/FolderNameDialog.tsx',
  base: 'CustomDialog',
  kind: 'form',
  where: 'Patient → Documents → custom folder menu → Rename',
  render: () => (
    <FolderNameDialog
      open
      mode="rename"
      initialName="Referral Letters"
      existingNames={['Insurance Cards', 'Consent Forms', 'Referral Letters']}
      onSubmit={async () => undefined}
      onClose={() => undefined}
    />
  ),
});

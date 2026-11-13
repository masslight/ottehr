import { FolderNameDialog } from 'src/features/visits/shared/components/patient/docs/FolderNameDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Create documents folder',
  source: 'apps/ehr/src/features/visits/shared/components/patient/docs/FolderNameDialog.tsx',
  base: 'CustomDialog',
  kind: 'form',
  where: 'Patient → Documents → New folder',
  notes: 'Opens empty, as in the product; Create stays disabled until a name is typed.',
  render: () => (
    <FolderNameDialog
      open
      mode="create"
      existingNames={['Insurance Cards', 'Consent Forms']}
      onSubmit={async () => undefined}
      onClose={() => undefined}
    />
  ),
});

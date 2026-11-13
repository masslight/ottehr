import EMCodeDialog from 'src/features/visits/telemed/components/admin/EMCodeDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Edit E&M code',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/EMCodeDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → E&M Codes → edit icon on a row',
  render: () => (
    <EMCodeDialog
      open
      onClose={() => undefined}
      existingCode={{ code: '99214', display: '99214 Established Patient - E/M Level 4' }}
    />
  ),
});

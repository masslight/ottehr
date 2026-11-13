import EMCodeDeleteDialog from 'src/features/visits/telemed/components/admin/EMCodeDeleteDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Delete E&M code',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/EMCodeDeleteDialog.tsx',
  base: 'MUI Dialog',
  kind: 'destructive-confirm',
  where: 'Admin → E&M Codes → delete icon on a row',
  render: () => <EMCodeDeleteDialog code="99214" onClose={() => undefined} />,
});

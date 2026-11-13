import EMCodeDialog from 'src/features/visits/telemed/components/admin/EMCodeDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Add E&M code',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/EMCodeDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → E&M Codes → Add',
  render: () => <EMCodeDialog open onClose={() => undefined} />,
});

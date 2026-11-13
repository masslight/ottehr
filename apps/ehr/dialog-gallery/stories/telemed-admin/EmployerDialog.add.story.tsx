import EmployerDialog from 'src/features/visits/telemed/components/admin/employers/EmployerDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Add employer',
  source: 'apps/ehr/src/features/visits/telemed/components/admin/employers/EmployerDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Employers → Add new',
  render: () => <EmployerDialog open onClose={() => undefined} />,
});

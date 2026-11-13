import { ApprovedPatientEducationDialog } from 'src/features/admin/patient-education/ApprovedPatientEducationDialog';
import { defineStory } from '../../harness/story';
import { icdMocks } from './_icd';

export default defineStory({
  title: 'New approved patient education (step 1: pick diagnosis)',
  source: 'apps/ehr/src/features/admin/patient-education/ApprovedPatientEducationDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Patient Education → "New"',
  mocks: icdMocks,
  render: () => <ApprovedPatientEducationDialog open onClose={() => undefined} />,
  notes: 'Initial empty state, as first opened.',
});

import { EditApprovedPatientEducationCodesDialog } from 'src/features/admin/patient-education/EditApprovedPatientEducationCodesDialog';
import { ApprovedPatientEducationItem } from 'utils/lib/types/api/approved-patient-education.types';
import { defineStory } from '../../harness/story';
import { icdCodes, icdMocks } from './_icd';

const item: ApprovedPatientEducationItem = {
  documentReferenceId: 'docref-1',
  title: 'Patient Education: Sore throat',
  icdCodes,
  pdfPresignedUrl: 'https://mock.invalid/patient-education.pdf',
  language: 'en',
};

export default defineStory({
  title: 'Edit approved patient education ICD-10 codes',
  source: 'apps/ehr/src/features/admin/patient-education/EditApprovedPatientEducationCodesDialog.tsx',
  base: 'MUI Dialog',
  kind: 'form',
  where: 'Admin → Patient Education → row "edit codes" action',
  mocks: icdMocks,
  render: () => <EditApprovedPatientEducationCodesDialog open onClose={() => undefined} item={item} />,
});

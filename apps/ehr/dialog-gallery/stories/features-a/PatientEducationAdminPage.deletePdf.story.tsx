import { PatientEducationAdminPage } from 'src/features/admin/patient-education/PatientEducationAdminPage';
import { ApprovedPatientEducationItem } from 'utils/lib/types/api/approved-patient-education.types';
import { defineStory } from '../../harness/story';
import { icdCodes } from './_icd';

const items: ApprovedPatientEducationItem[] = [
  {
    documentReferenceId: 'docref-1',
    title: 'Patient Education: Sore throat',
    icdCodes,
    pdfPresignedUrl: 'https://mock.invalid/patient-education.pdf',
    language: 'en',
  },
];

export default defineStory({
  title: 'Delete approved patient education PDF',
  source: 'apps/ehr/src/features/admin/patient-education/PatientEducationAdminPage.tsx',
  base: 'AppDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Patient Education → row "Remove" (trash) icon',
  mocks: [{ url: 'list-approved-patient-education', response: { status: 200, output: { items } } }],
  render: () => <PatientEducationAdminPage />,
  play: async ({ user, screen }) => {
    await user.click(await screen.findByTitle('Remove', undefined, { timeout: 8000 }));
    await screen.findByText('Delete Approved PDF?');
  },
  notes:
    'New dialog: it replaces a native window.confirm, so there is no "before" screenshot. Opened through confirmDestructive() from the real admin page.',
});

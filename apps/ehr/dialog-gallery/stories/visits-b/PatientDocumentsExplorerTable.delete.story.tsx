import {
  DocumentTableActions,
  PatientDocumentsExplorerTable,
} from 'src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable';
import type { PatientDocumentInfo } from 'src/hooks/useGetPatientDocs';
import { defineStory } from '../../harness/story';

const documents: PatientDocumentInfo[] = [
  {
    id: 'doc-1',
    docName: 'Referral letter - ENT.pdf',
    whenAddedDate: '2026-11-10T14:12:00.000Z',
    whoAdded: 'Dana Whitfield',
    encounterId: 'enc-1',
  },
  {
    id: 'doc-2',
    docName: 'Insurance card front.jpg',
    whenAddedDate: '2026-11-08T09:40:00.000Z',
    whoAdded: 'Front Desk',
  },
];

const actions: DocumentTableActions = {
  isActionAllowed: () => true,
  onDocumentDownload: async () => undefined,
  onDocumentFax: () => undefined,
  onDocumentRename: async () => undefined,
  onDocumentDelete: async () => undefined,
};

export default defineStory({
  title: 'Delete document',
  source: 'apps/ehr/src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable.tsx',
  base: 'CustomDialog',
  kind: 'destructive-confirm',
  where: 'Patient → Documents → document row → ⋮ menu → Delete document',
  mocks: [
    {
      url: 'get-patient-visit-history',
      response: {
        status: 200,
        output: { visits: [{ encounterId: 'enc-1', appointmentId: 'appt-1', dateTime: '2026-11-10T14:00:00.000Z' }] },
      },
    },
  ],
  notes: 'Table rendered with two mock documents; dialog opened from the first row’s real menu.',
  render: () => (
    <PatientDocumentsExplorerTable
      isLoadingDocs={false}
      documents={documents}
      documentTableActions={actions}
      patientId="pat-1"
      selectedDocumentIds={[]}
      onSelectedDocumentIdsChange={() => undefined}
    />
  ),
  play: async ({ user, screen }) => {
    const menus = await screen.findAllByRole('button', { name: 'More actions' });
    await user.click(menus[0]);
    await user.click(await screen.findByRole('menuitem', { name: 'Delete document' }));
    await screen.findByRole('dialog');
  },
});

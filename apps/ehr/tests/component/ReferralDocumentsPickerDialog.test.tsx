import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BUCKET_NAMES } from 'utils/lib/fhir/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientDocumentInfo, PatientDocumentsFolder } from '../../src/hooks/useGetPatientDocs';
import type { PatientVisitOption } from '../../src/hooks/usePatientVisitOptions';

const PATIENT_ID = 'patient-1';

const doc = (id: string, encounterId: string, over: Partial<PatientDocumentInfo> = {}): PatientDocumentInfo => ({
  id,
  docName: `${id}.pdf`,
  whenAddedDate: '2026-11-02T12:00:00.000Z',
  encounterId,
  ...over,
});
// Visit 1 is the newest. Its Labs folder holds a result and an order form; Consent Forms is not offered.
const DOCUMENTS = [
  doc('note-1', 'encounter-1'),
  doc('lab-result-1', 'encounter-1', { isLabResult: true }),
  doc('lab-order-1', 'encounter-1', { isLabResult: false }),
  doc('consent-1', 'encounter-1'),
  doc('note-2', 'encounter-2'),
  doc('note-3', 'encounter-3'),
];
const folder = (internalName: string, folderName: string, ids: string[]): PatientDocumentsFolder => ({
  id: `list-${internalName}`,
  folderName,
  internalName,
  documentsCount: ids.length,
  documentsRefs: ids.map((id) => ({ reference: { reference: `DocumentReference/${id}` } })),
  isCustom: false,
});
const FOLDERS = [
  folder(BUCKET_NAMES.VISIT_NOTES, 'Visit Notes', ['note-1', 'note-2', 'note-3']),
  folder(BUCKET_NAMES.LABS, 'Labs', ['lab-result-1', 'lab-order-1']),
  folder(BUCKET_NAMES.CONSENT_FORMS, 'Consent Forms', ['consent-1']),
];
const visit = (n: number, dateTime: string): PatientVisitOption => ({
  encounterId: `encounter-${n}`,
  appointmentId: `appointment-${n}`,
  dateTime,
});
const VISITS = [
  visit(1, '2026-11-01T15:00:00.000Z'),
  visit(2, '2026-10-06T15:00:00.000Z'),
  visit(3, '2026-09-22T15:00:00.000Z'),
];

const { mockSearchDocuments, mockDownloadDocument } = vi.hoisted(() => ({
  mockSearchDocuments: vi.fn(),
  mockDownloadDocument: vi.fn(),
}));

vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({
    documents: DOCUMENTS,
    isLoadingDocuments: false,
    documentsFolders: FOLDERS,
    isLoadingFolders: false,
    searchDocuments: mockSearchDocuments,
    downloadDocument: mockDownloadDocument,
    renameDocument: vi.fn(),
    documentActions: { deleteDocumentAction: vi.fn(), uploadDocumentAction: vi.fn(), isUploading: false },
  }),
}));
vi.mock('../../src/hooks/usePatientVisitOptions', () => ({
  usePatientVisitOptions: () => ({
    visitOptions: VISITS,
    isLoading: false,
    visitsByEncounterId: new Map(VISITS.map((option) => [option.encounterId, option])),
    visitsByAppointmentId: new Map(VISITS.map((option) => [option.appointmentId, option])),
  }),
}));
vi.mock('../../src/hooks/useDownloadDocumentsZip', () => ({
  useDownloadDocumentsZip: () => ({ downloadDocumentsZip: vi.fn(), isDownloading: false }),
}));
vi.mock('src/features/fax/hooks/useSendFax', () => ({
  useSendFax: () => ({ isOpen: false, open: vi.fn(), close: vi.fn() }),
}));
vi.mock('src/features/fax/ui/SendFaxDialog', () => ({ SendFaxDialog: () => null }));
vi.mock('../../src/components/DateSearch', () => ({ default: () => <div /> }));
vi.mock('../../src/components/ScannerModal', () => ({ ScannerModal: () => null }));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentFoldersColumn', () => ({
  PatientDocumentFoldersColumn: ({ documentsFolders }: { documentsFolders: PatientDocumentsFolder[] }) => (
    <ul data-testid="folders">
      {documentsFolders.map((f) => (
        <li key={f.id}>{`${f.folderName} - ${f.documentsCount}`}</li>
      ))}
    </ul>
  ),
  PatientDocumentFoldersColumnSkeleton: () => null,
}));
// The real table is a DataGrid; this stand-in shows what the explorer hands it and lets a row be ticked.
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable', () => ({
  PatientDocumentsExplorerTable: ({ documents, selectedDocumentIds, onSelectedDocumentIdsChange, pickerMode }: any) => (
    <div data-testid="table" data-picker={String(pickerMode)}>
      {(documents ?? []).map((document: PatientDocumentInfo) => (
        <label key={document.id}>
          <input
            type="checkbox"
            aria-label={document.docName}
            checked={selectedDocumentIds.includes(document.id)}
            onChange={(event) =>
              onSelectedDocumentIdsChange(
                event.target.checked
                  ? [...selectedDocumentIds, document.id]
                  : selectedDocumentIds.filter((id: string) => id !== document.id)
              )
            }
          />
          {document.docName}
        </label>
      ))}
    </div>
  ),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { ReferralDocumentsPickerDialog } from '../../src/features/referrals/ReferralDocumentsPickerDialog';

const rowNames = (): string[] =>
  screen.queryAllByRole('checkbox').map((checkbox) => checkbox.getAttribute('aria-label') ?? '');

describe('ReferralDocumentsPickerDialog', () => {
  const onAdd = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("on a visit referral lists only other visits' visit notes and lab results, with nothing preset", async () => {
    render(
      <ReferralDocumentsPickerDialog
        patientId={PATIENT_ID}
        encounterId="encounter-1"
        selected={[]}
        onClose={vi.fn()}
        onAdd={onAdd}
      />
    );

    await waitFor(() => expect(rowNames()).toEqual(['note-2.pdf', 'note-3.pdf']));
    expect(screen.getByText('Add documents to referral')).toBeInTheDocument();
    expect(screen.getByText('0 documents selected')).toBeInTheDocument();
    expect(screen.getByTestId('table')).toHaveAttribute('data-picker', 'true');
    // Only the offered folders, counting what the picker lists.
    expect(screen.getByTestId('folders')).toHaveTextContent('Visit Notes - 2');
    expect(screen.getByTestId('folders')).toHaveTextContent('Labs - 0');
    expect(screen.getByTestId('folders')).not.toHaveTextContent('Consent Forms');
    // Picker mode drops the Docs page's own actions.
    expect(screen.queryByText('Upload')).toBeNull();
    expect(screen.queryByText('Scan')).toBeNull();
    expect(screen.queryByTestId(dataTestIds.patientDocsPage.downloadSelectedDocumentsButton)).toBeNull();
    // The referral's own visit is not offered as a filter either.
    await userEvent.setup().click(screen.getByRole('combobox', { name: 'Visit' }));
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('on a patient-record referral starts on the latest visit with its offered documents ticked', async () => {
    const user = userEvent.setup();
    render(<ReferralDocumentsPickerDialog patientId={PATIENT_ID} selected={[]} onClose={vi.fn()} onAdd={onAdd} />);

    await waitFor(() => expect(screen.getByText('2 documents selected')).toBeInTheDocument());
    expect(mockSearchDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ visit: { encounterId: 'encounter-1', appointmentId: 'appointment-1' } })
    );
    expect(rowNames()).not.toContain('lab-order-1.pdf');
    expect(rowNames()).not.toContain('consent-1.pdf');

    await user.click(screen.getByLabelText('note-3.pdf'));
    await user.click(screen.getByTestId(dataTestIds.referrals.documentsPickerAddButton));

    expect(onAdd).toHaveBeenCalledWith([
      { id: 'note-1', title: 'note-1.pdf', date: '2026-11-02T12:00:00.000Z', visitDate: '2026-11-01T15:00:00.000Z' },
      {
        id: 'lab-result-1',
        title: 'lab-result-1.pdf',
        date: '2026-11-02T12:00:00.000Z',
        visitDate: '2026-11-01T15:00:00.000Z',
      },
      { id: 'note-3', title: 'note-3.pdf', date: '2026-11-02T12:00:00.000Z', visitDate: '2026-09-22T15:00:00.000Z' },
    ]);
  });

  it('keeps the documents already chosen, in their order, and presets nothing when there are some', async () => {
    const user = userEvent.setup();
    const chosen = [
      { id: 'gone-from-list', title: 'Older.pdf' },
      { id: 'note-2', title: 'note-2.pdf' },
    ];
    render(<ReferralDocumentsPickerDialog patientId={PATIENT_ID} selected={chosen} onClose={vi.fn()} onAdd={onAdd} />);

    expect(await screen.findByText('2 documents selected')).toBeInTheDocument();
    expect(screen.getByLabelText('note-2.pdf')).toBeChecked();
    expect(screen.getByLabelText('note-1.pdf')).not.toBeChecked();

    await user.click(screen.getByLabelText('note-1.pdf'));
    await user.click(screen.getByTestId(dataTestIds.referrals.documentsPickerAddButton));

    expect(onAdd.mock.calls[0][0].map((document: { id: string }) => document.id)).toEqual([
      'gone-from-list',
      'note-2',
      'note-1',
    ]);
    // A chip not listed right now keeps what the form already knew about it.
    expect(onAdd.mock.calls[0][0][0]).toEqual(chosen[0]);
  });
});

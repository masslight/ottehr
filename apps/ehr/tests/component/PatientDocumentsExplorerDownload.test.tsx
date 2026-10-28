import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Patient } from 'fhir/r4b';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentsZipResult } from '../../src/hooks/useDownloadDocumentsZip';
import type { PatientDocumentInfo } from '../../src/hooks/useGetPatientDocs';

const { downloadState, mockDownloadDocumentsZip, mockEnqueueSnackbar } = vi.hoisted(() => ({
  downloadState: { isDownloading: false },
  mockDownloadDocumentsZip: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
}));

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const PATIENT: Patient = {
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: ['Oliver'], family: 'Black' }],
};

const makeDocument = (id: string, docName: string): PatientDocumentInfo => ({
  id,
  docName,
  attachments: [{ title: docName, z3Url: `https://project-api.test/z3/bucket/${docName}` }],
});

const DOCUMENTS = [
  makeDocument('doc-1', 'Visit Note.pdf'),
  makeDocument('doc-2', 'Lab Result.pdf'),
  makeDocument('doc-3', 'Scan.pdf'),
];

vi.mock('notistack', async (importOriginal) => ({
  ...(await importOriginal<typeof import('notistack')>()),
  enqueueSnackbar: mockEnqueueSnackbar,
}));
vi.mock('../../src/hooks/useDownloadDocumentsZip', () => ({
  useDownloadDocumentsZip: () => ({
    downloadDocumentsZip: mockDownloadDocumentsZip,
    isDownloading: downloadState.isDownloading,
  }),
}));
vi.mock('src/features/fax/hooks/useSendFax', () => ({
  useSendFax: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false, failures: [] }),
}));
vi.mock('src/features/fax/ui/SendFaxDialog', () => ({ SendFaxDialog: () => <div /> }));
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({ loading: false, patient: PATIENT }),
}));
vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({
    documents: DOCUMENTS,
    isLoadingDocuments: false,
    documentsFolders: [],
    isLoadingFolders: false,
    searchDocuments: vi.fn(),
    downloadDocument: vi.fn(),
    renameDocument: vi.fn(),
    documentActions: { deleteDocumentAction: vi.fn(), uploadDocumentAction: vi.fn(), isUploading: false },
  }),
}));
vi.mock('../../src/hooks/usePatientVisitOptions', () => ({
  usePatientVisitOptions: () => ({
    visitOptions: [],
    isLoading: false,
    visitsByEncounterId: new Map(),
    visitsByAppointmentId: new Map(),
  }),
}));
vi.mock('../../src/state/patient.store', () => ({ usePatientStore: { setState: vi.fn() } }));
vi.mock('src/features/visits/shared/components/patient/Header', () => ({ Header: () => <div /> }));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentFoldersColumn', () => ({
  PatientDocumentFoldersColumn: () => <div />,
  PatientDocumentFoldersColumnSkeleton: () => <div />,
}));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable', () => ({
  PatientDocumentsExplorerTable: ({ onSelectedDocumentIdsChange }: any) => (
    <>
      <button onClick={() => onSelectedDocumentIdsChange(['doc-1', 'doc-3'])}>Select two documents</button>
      <button onClick={() => onSelectedDocumentIdsChange(['doc-2'])}>Select one document</button>
    </>
  ),
}));
vi.mock('../../src/components/CustomBreadcrumbs', () => ({ default: () => <div /> }));
vi.mock('../../src/components/DateSearch', () => ({ default: () => <div /> }));
vi.mock('../../src/components/ScannerModal', () => ({ ScannerModal: () => <div /> }));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { PatientDocumentsExplorer } from '../../src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';
import PatientDocumentsExplorerPage from '../../src/pages/PatientDocumentsExplorerPage';

const renderPage = (): void => {
  render(
    <MemoryRouter initialEntries={[`/patient/${PATIENT_ID}/docs`]}>
      <Routes>
        <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
      </Routes>
    </MemoryRouter>
  );
};

const downloadButton = (): HTMLElement =>
  screen.getByTestId(dataTestIds.patientDocsPage.downloadSelectedDocumentsButton);

describe('PatientDocumentsExplorer bulk download', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    downloadState.isDownloading = false;
    mockDownloadDocumentsZip.mockResolvedValue({ status: 'saved', affectedDocumentNames: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('asks for a selection when nothing is selected', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(downloadButton());

    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Please select the documents you want to download.');
    expect(mockDownloadDocumentsZip).not.toHaveBeenCalled();
  });

  it('zips exactly the selected documents under the patient name and the current UTC minute', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-16T14:30:45Z'));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Select two documents' }));
    await user.click(downloadButton());

    expect(mockDownloadDocumentsZip).toHaveBeenCalledTimes(1);
    expect(mockDownloadDocumentsZip).toHaveBeenCalledWith(
      [DOCUMENTS[0], DOCUMENTS[2]],
      'docs-black_oliver-2026-10-16_14-30.zip'
    );
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it.each<[string, DocumentsZipResult, unknown[] | undefined]>([
    [
      'names the documents affected in a saved archive',
      { status: 'saved', affectedDocumentNames: ['Lab Result.pdf', 'Scan.pdf'] },
      [
        'Some files could not be downloaded and were left out of the archive. Affected documents: Lab Result.pdf, Scan.pdf.',
        { variant: 'warning' },
      ],
    ],
    [
      'names only the first three affected documents and counts the rest',
      {
        status: 'saved',
        affectedDocumentNames: ['Lab Result.pdf', 'Scan.pdf', 'Visit Note.pdf', 'Discharge Summary.pdf', 'Receipt.pdf'],
      },
      [
        'Some files could not be downloaded and were left out of the archive. Affected documents: Lab Result.pdf, Scan.pdf, Visit Note.pdf and 2 more.',
        { variant: 'warning' },
      ],
    ],
    [
      'reports an archive that is too large',
      { status: 'too-large' },
      ['The archive is too large. Please select fewer documents and try again.', { variant: 'error' }],
    ],
    [
      'reports when no document could be downloaded',
      { status: 'none-downloaded' },
      ['None of the selected documents could be downloaded. Please try again.', { variant: 'error' }],
    ],
    ['stays quiet when the download was cancelled', { status: 'cancelled' }, undefined],
  ])('%s', async (_label, result, expectedSnackbar) => {
    mockDownloadDocumentsZip.mockResolvedValue(result);
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Select two documents' }));
    await user.click(downloadButton());

    if (expectedSnackbar) {
      expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(...expectedSnackbar);
    } else {
      expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
    }
  });

  it('reports any other failure without calling it a size problem', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockDownloadDocumentsZip.mockRejectedValue(new Error('login_required'));
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Select two documents' }));
    await user.click(downloadButton());

    expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to download the selected documents. Please try again.', {
      variant: 'error',
    });
  });

  it.each<[string, () => void, string]>([
    [
      'a file too large to read',
      () => mockDownloadDocumentsZip.mockResolvedValue({ status: 'too-large' }),
      'The file is too large to download.',
    ],
    [
      'a file that could not be downloaded',
      () => mockDownloadDocumentsZip.mockResolvedValue({ status: 'none-downloaded' }),
      'The file could not be downloaded. Please try again.',
    ],
    [
      'any other failure',
      () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        mockDownloadDocumentsZip.mockRejectedValue(new Error('login_required'));
      },
      'The file could not be downloaded. Please try again.',
    ],
  ])(
    'talks about the file, not an archive, for %s when one single-file document is selected',
    async (_label, arrange, message) => {
      arrange();
      const user = userEvent.setup();
      renderPage();

      await user.click(screen.getByRole('button', { name: 'Select one document' }));
      await user.click(downloadButton());

      expect(mockDownloadDocumentsZip).toHaveBeenCalledWith([DOCUMENTS[1]], expect.any(String));
      expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1);
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(message, { variant: 'error' });
    }
  );

  it('offers Download in read-only views', () => {
    render(<PatientDocumentsExplorer patientId={PATIENT_ID} patient={PATIENT} readOnly />);

    expect(downloadButton()).toBeEnabled();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });

  it('shows the button as busy while a download runs', () => {
    downloadState.isDownloading = true;
    render(<PatientDocumentsExplorer patientId={PATIENT_ID} patient={PATIENT} />);

    expect(downloadButton()).toBeDisabled();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const DOCUMENT_ID = '22222222-2222-2222-2222-222222222222';
const mockUseSendFax = vi.fn();
const mockOpen = vi.fn();
const mockSearchDocuments = vi.fn();

// The fax slice owns sending; this page's job is to hand it the row the user picked.
vi.mock('src/features/fax', () => ({
  useSendFax: (source: unknown) => {
    mockUseSendFax(source);
    return { isOpen: false, open: mockOpen, close: vi.fn(), isSending: false, failures: [] };
  },
  SendFaxDialog: ({ title }: { title?: string }) => <div data-testid="fax-dialog" data-title={title} />,
}));
vi.mock('../../src/hooks/useGetPatient', () => ({
  useGetPatient: () => ({
    loading: false,
    patient: { resourceType: 'Patient', id: PATIENT_ID, name: [{ given: ['Oliver'], family: 'Black' }] },
  }),
}));
vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({
    documents: [],
    isLoadingDocuments: false,
    documentsFolders: [],
    isLoadingFolders: false,
    searchDocuments: mockSearchDocuments,
    downloadDocument: vi.fn(),
    renameDocument: vi.fn(),
    documentActions: {
      deleteDocumentAction: vi.fn(),
      uploadDocumentAction: vi.fn(),
      isUploading: false,
    },
  }),
}));
vi.mock('../../src/state/patient.store', () => ({ usePatientStore: { setState: vi.fn() } }));
vi.mock('src/features/visits/shared/components/patient/Header', () => ({ Header: () => <div /> }));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentFoldersColumn', () => ({
  PatientDocumentFoldersColumn: () => <div />,
  PatientDocumentFoldersColumnSkeleton: () => <div />,
}));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable', () => ({
  PatientDocumentsExplorerTable: ({ documentTableActions }: any) => (
    <button onClick={() => documentTableActions.onDocumentFax(DOCUMENT_ID)}>Fax document row</button>
  ),
}));
vi.mock('../../src/components/CustomBreadcrumbs', () => ({ default: () => <div /> }));
vi.mock('../../src/components/DateSearch', () => ({ default: () => <div /> }));
vi.mock('../../src/components/ScannerModal', () => ({ ScannerModal: () => <div /> }));

import PatientDocumentsExplorerPage from '../../src/pages/PatientDocumentsExplorerPage';

describe('PatientDocumentsExplorerPage fax action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('faxes only the document selected from its row', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/patient/${PATIENT_ID}/docs`]}>
        <Routes>
          <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Fax document row' }));

    expect(mockUseSendFax.mock.calls.at(-1)?.[0]).toEqual({
      type: 'document',
      patientId: PATIENT_ID,
      documentReferenceId: DOCUMENT_ID,
    });
    expect(mockOpen).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('fax-dialog')).toHaveAttribute('data-title', 'Fax Document');
  });

  it('names no source until a row is picked', () => {
    render(
      <MemoryRouter initialEntries={[`/patient/${PATIENT_ID}/docs`]}>
        <Routes>
          <Route path="/patient/:id/docs" element={<PatientDocumentsExplorerPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(mockUseSendFax).toHaveBeenCalledWith(undefined);
    expect(mockOpen).not.toHaveBeenCalled();
  });
});

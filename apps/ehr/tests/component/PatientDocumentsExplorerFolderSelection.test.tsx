import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PatientDocumentsFolder } from '../../src/hooks/useGetPatientDocs';

const { docsState, mockSearchDocuments } = vi.hoisted(() => ({
  docsState: { documentsFolders: [] as PatientDocumentsFolder[] },
  mockSearchDocuments: vi.fn(),
}));

const SYNTHETIC_FOLDER: PatientDocumentsFolder = {
  id: 'synthetic:referrals',
  internalName: 'referrals',
  folderName: 'Referrals',
  documentsCount: 0,
  isCustom: true,
};
const REAL_FOLDER: PatientDocumentsFolder = { ...SYNTHETIC_FOLDER, id: 'list-1', documentsCount: 1 };

vi.mock('src/features/send-documents/hooks/useSendDocuments', () => ({
  useSendDocuments: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false, failures: [] }),
}));
vi.mock('src/features/send-documents/ui/SendDocumentsDialog', () => ({ SendDocumentsDialog: () => <div /> }));
vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  useGetPatientDocs: () => ({
    documents: [],
    isLoadingDocuments: false,
    documentsFolders: docsState.documentsFolders,
    isLoadingFolders: false,
    searchDocuments: mockSearchDocuments,
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
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentFoldersColumn', () => ({
  PatientDocumentFoldersColumn: ({ documentsFolders, onFolderSelected }: any) => (
    <button onClick={() => onFolderSelected(documentsFolders[0])}>Select folder</button>
  ),
  PatientDocumentFoldersColumnSkeleton: () => <div />,
}));
vi.mock('src/features/visits/shared/components/patient/docs/PatientDocumentsExplorerTable', () => ({
  PatientDocumentsExplorerTable: () => <div />,
}));
vi.mock('../../src/components/DateSearch', () => ({ default: () => <div /> }));
vi.mock('src/features/visits/shared/components/patient/docs/UploadDocumentDialog', () => ({
  UploadDocumentDialog: ({ patientId }: { patientId: string }) => <div>Upload dialog for {patientId}</div>,
}));

import { PatientDocumentsExplorer } from '../../src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';

const explorerFor = (patientId: string): JSX.Element => (
  <MemoryRouter>
    <PatientDocumentsExplorer patientId={patientId} />
  </MemoryRouter>
);

const renderExplorer = (): ReturnType<typeof render> => render(explorerFor('patient-1'));

describe('PatientDocumentsExplorer folder selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    docsState.documentsFolders = [SYNTHETIC_FOLDER];
  });

  it('follows a selected catalog-only folder to the real List an upload elsewhere created', async () => {
    const user = userEvent.setup();
    const { rerender } = renderExplorer();
    await user.click(screen.getByText('Select folder'));
    expect(mockSearchDocuments).toHaveBeenLastCalledWith(
      expect.objectContaining({ documentsFolder: SYNTHETIC_FOLDER })
    );

    docsState.documentsFolders = [REAL_FOLDER];
    rerender(explorerFor('patient-1'));

    expect(mockSearchDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ documentsFolder: REAL_FOLDER }));
  });

  it('closes its upload dialog when reused for another patient', async () => {
    const user = userEvent.setup();
    const { rerender } = renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(screen.getByText('Upload dialog for patient-1')).toBeInTheDocument();

    rerender(explorerFor('patient-2'));

    expect(screen.queryByText(/Upload dialog for/)).not.toBeInTheDocument();
  });
});

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

vi.mock('src/features/fax/hooks/useSendFax', () => ({
  useSendFax: () => ({ isOpen: false, open: vi.fn(), close: vi.fn(), isSending: false, failures: [] }),
}));
vi.mock('src/features/fax/ui/SendFaxDialog', () => ({ SendFaxDialog: () => <div /> }));
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

import { PatientDocumentsExplorer } from '../../src/features/visits/shared/components/patient/docs/PatientDocumentsExplorer';

const renderExplorer = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <PatientDocumentsExplorer patientId="patient-1" />
    </MemoryRouter>
  );

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
    rerender(
      <MemoryRouter>
        <PatientDocumentsExplorer patientId="patient-1" />
      </MemoryRouter>
    );

    expect(mockSearchDocuments).toHaveBeenLastCalledWith(expect.objectContaining({ documentsFolder: REAL_FOLDER }));
  });
});

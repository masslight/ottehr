import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InboundFaxMatch } from '../../src/features/inbound-fax/pages/InboundFaxMatch';

// ============================================================================
// MOCKS
// ============================================================================

const mockFileInboundFax = vi.fn();
const mockDeleteInboundFax = vi.fn();

vi.mock('../../src/api/api', () => ({
  fileInboundFax: (...args: unknown[]) => mockFileInboundFax(...args),
  deleteInboundFax: (...args: unknown[]) => mockDeleteInboundFax(...args),
  GET_TASKS_KEY: 'tasks',
}));

const mockFhirSearch = vi.fn();
const mockFhirCreate = vi.fn();
const mockOystehr = {
  fhir: {
    search: mockFhirSearch,
    create: mockFhirCreate,
  },
};
const mockOystehrZambda = {
  zambda: { execute: vi.fn() },
};

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: mockOystehr,
    oystehrZambda: mockOystehrZambda,
  }),
}));

// Stable function identity, matching the real @auth0/auth0-react hook (a new identity per
// render would re-trigger the page's load effect forever).
const mockGetAccessTokenSilently = vi.fn().mockResolvedValue('test-token');

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    getAccessTokenSilently: mockGetAccessTokenSilently,
  }),
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="page-container">{children}</div>,
}));

const mockGetPresignedURL = vi.fn();

vi.mock('utils', () => ({
  FAX_TASK: {
    category: 'inbound-fax',
    system: 'inbound-fax-task',
    code: { matchInboundFax: 'match-inbound-fax' },
    input: {
      senderFaxNumber: 'sender-fax-number',
      pageCount: 'page-count',
      communicationId: 'communication-id',
      pdfUrl: 'pdf-url',
      receivedDate: 'received-date',
    },
  },
  getPresignedURL: (...args: unknown[]) => mockGetPresignedURL(...args),
  FOLDERS_CONFIG: [{ title: 'medical-records', display: 'Medical Records' }],
  isSyntheticFolderId: (id?: string) => !!id && id.startsWith('synthetic:'),
  parseSyntheticFolderId: (id?: string) => (id?.startsWith('synthetic:') ? id.slice('synthetic:'.length) : undefined),
  isCustomFolderList: () => false,
  createPatientDocumentList: (patientReference: string, config: { title: string }) => ({
    resourceType: 'List',
    title: config.title,
    subject: { reference: patientReference },
  }),
  createCustomPatientDocumentList: (patientReference: string, internalName: string) => ({
    resourceType: 'List',
    title: internalName,
    subject: { reference: patientReference },
  }),
}));

vi.mock('../../src/features/external-labs/components/unsolicited-results/UnsolicitedPatientMatchSearchCard', () => ({
  UnsolicitedPatientMatchSearchCard: ({
    setSelectedPatient,
  }: {
    selectedPatient: unknown;
    setSelectedPatient: (p: any) => void;
    handleConfirmPatientMatch: (p: any) => void;
  }) => (
    <div data-testid="patient-search">
      <button
        data-testid="select-patient-btn"
        onClick={() =>
          setSelectedPatient({
            id: 'patient-123',
            name: 'Frodo Baggins',
            birthDate: '1990-01-01',
          })
        }
      >
        Select Patient
      </button>
    </div>
  ),
}));

vi.mock('../../src/features/visits/in-person/hooks/useTasks', () => ({
  GET_TASKS_KEY: 'tasks',
  formatDate: (dateIso: string) => dateIso,
}));

const mockUseGetPatientDocsFolders = vi.fn();
const mockParsePatientDocsFolders = vi.fn();

vi.mock('../../src/hooks/useGetPatientDocs', () => ({
  QUERY_KEYS: {
    GET_PATIENT_DOCS_FOLDERS: 'get-patient-docs-folders',
    GET_SEARCH_PATIENT_DOCUMENTS: 'get-search-patient-documents',
  },
  useGetPatientDocsFolders: (args: { patientId: string }) => mockUseGetPatientDocsFolders(args),
  parsePatientDocsFolders: (...args: unknown[]) => mockParsePatientDocsFolders(...args),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

// ============================================================================
// HELPERS
// ============================================================================

const COMMUNICATION_ID = 'comm-test-123';

const MOCK_FOLDERS = [
  {
    id: 'folder-1',
    folderName: 'Medical Records',
    internalName: 'medical-records',
    documentsCount: 1,
    isCustom: false,
  },
  {
    id: 'folder-2',
    folderName: 'Lab Results',
    internalName: 'lab-results',
    documentsCount: 0,
    isCustom: false,
  },
];

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/inbound-fax/${COMMUNICATION_ID}/match`]}>
        <Routes>
          <Route path="/inbound-fax/:communicationId/match" element={children} />
          <Route path="/tasks" element={<div data-testid="tasks-page">Tasks</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
};

const makeFaxTask = (status: string): Record<string, unknown> => ({
  resourceType: 'Task',
  id: 'task-abc',
  status,
  input: [
    {
      type: { coding: [{ code: 'sender-fax-number' }] },
      valueString: '+15551234567',
    },
    {
      type: { coding: [{ code: 'page-count' }] },
      valueString: '3',
    },
    {
      type: { coding: [{ code: 'pdf-url' }] },
      valueString: 'https://z3.example.com/bucket/fax.pdf',
    },
    {
      type: { coding: [{ code: 'received-date' }] },
      valueString: '2026-03-13T10:00:00Z',
    },
  ],
});

const mockTaskSearchResult = {
  unbundle: () => [makeFaxTask('ready')],
};

const selectPatientAndFolder = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByTestId('patient-search')).toBeDefined();
  });
  await user.click(screen.getByTestId('select-patient-btn'));
  await waitFor(() => {
    expect(screen.getByText(/Medical Records/)).toBeDefined();
  });
  await user.click(screen.getByText(/Medical Records/));
};

// ============================================================================
// TESTS
// ============================================================================

describe('InboundFaxMatch page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPresignedURL.mockResolvedValue('https://presigned.example.com/fax.pdf');
    // Default: Task search returns a ready task
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve(mockTaskSearchResult);
      return Promise.resolve({ unbundle: () => [] });
    });
    // Folders hook: report folders once a patient is selected
    mockUseGetPatientDocsFolders.mockImplementation(({ patientId }: { patientId: string }) => ({
      isLoading: false,
      data: patientId ? { lists: [], catalogDefs: [] } : undefined,
    }));
    mockParsePatientDocsFolders.mockReturnValue(MOCK_FOLDERS);
  });

  it('renders the page title', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Match Inbound Fax')).toBeDefined();
    });
  });

  it('shows loading state initially', () => {
    // Make Task search never resolve
    mockFhirSearch.mockReturnValue(new Promise(() => {}));
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('shows error state when no task is found', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve({ unbundle: () => [] });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No matching task found for this fax')).toBeDefined();
    });
  });

  it('renders a read-only view (PDF preview, no match controls) when the task is completed', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve({ unbundle: () => [makeFaxTask('completed')] });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    // Read-only notice replaces the match panel
    await waitFor(() => {
      expect(screen.getByText('This fax has already been filed.')).toBeDefined();
    });

    // The PDF preview still loads (Communication + PDF survive filing)
    expect(mockGetPresignedURL).toHaveBeenCalledWith('https://z3.example.com/bucket/fax.pdf', 'test-token');
    await waitFor(() => {
      expect(screen.getByTitle('Inbound fax PDF preview')).toBeDefined();
    });
    expect(screen.getByText(/\+15551234567/)).toBeDefined();

    // No match controls: patient search, folder picker, Save, and Delete are all absent
    expect(screen.queryByTestId('patient-search')).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
    expect(screen.queryByText('Match to patient:')).toBeNull();
  });

  it('prefers the ready task (full match form) when both ready and completed tasks exist', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task')
        return Promise.resolve({ unbundle: () => [makeFaxTask('completed'), makeFaxTask('ready')] });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('patient-search')).toBeDefined();
    });
    expect(screen.getByText('Save')).toBeDefined();
    expect(screen.queryByText('This fax has already been filed.')).toBeNull();
  });

  it('shows a deleted message when the only matching task is cancelled', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve({ unbundle: () => [makeFaxTask('cancelled')] });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('This fax was deleted and is no longer available.')).toBeDefined();
    });
    // A deleted fax's PDF is gone — no presign attempt, no preview
    expect(mockGetPresignedURL).not.toHaveBeenCalled();
  });

  it('displays fax metadata after loading', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/\+15551234567/)).toBeDefined();
      expect(screen.getByText(/3 pages/)).toBeDefined();
    });
  });

  it('shows patient search when no patient is selected', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('patient-search')).toBeDefined();
    });
  });

  it('shows Save and Delete buttons', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Save')).toBeDefined();
      expect(screen.getByText('Delete')).toBeDefined();
    });
  });

  it('disables Save button when no patient or folder is selected', async () => {
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      const saveButton = screen.getByText('Save').closest('button');
      expect(saveButton?.disabled).toBe(true);
    });
  });

  it('shows confirmed patient and folders after patient selection', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('patient-search')).toBeDefined();
    });

    // Click the mock patient select button
    await user.click(screen.getByTestId('select-patient-btn'));

    // Should show confirmed patient info
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Frodo Baggins/)).toBeDefined();
    });

    // Should show folder list
    await waitFor(() => {
      expect(screen.getByText(/Medical Records/)).toBeDefined();
      expect(screen.getByText(/Lab Results/)).toBeDefined();
    });
  });

  it('allows clearing the selected patient', async () => {
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('patient-search')).toBeDefined();
    });

    // Select patient
    await user.click(screen.getByTestId('select-patient-btn'));
    await waitFor(() => {
      expect(screen.getByDisplayValue(/Frodo Baggins/)).toBeDefined();
    });

    // Click clear button (ClearIcon button)
    const clearButton = screen
      .getByDisplayValue(/Frodo Baggins/)
      .closest('.MuiInputBase-root')
      ?.querySelector('button');
    if (clearButton) {
      await user.click(clearButton);
    }

    // Should go back to search
    await waitFor(() => {
      expect(screen.getByTestId('patient-search')).toBeDefined();
    });
  });

  it('files the fax to the selected folder on Save', async () => {
    mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-1' });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await selectPatientAndFolder(user);

    const saveButton = screen.getByText('Save').closest('button');
    await waitFor(() => {
      expect(saveButton?.disabled).toBe(false);
    });
    await user.click(saveButton!);

    await waitFor(() => {
      expect(mockFileInboundFax).toHaveBeenCalledWith(expect.anything(), {
        taskId: 'task-abc',
        communicationId: COMMUNICATION_ID,
        patientId: 'patient-123',
        folderId: 'folder-1',
        documentName: 'Fax from +15551234567',
      });
    });

    // Navigates back to the tasks board
    await waitFor(() => {
      expect(screen.getByTestId('tasks-page')).toBeDefined();
    });
  });

  describe('delete confirmation dialog', () => {
    it('requires confirmation before deleting and shows the fax details', async () => {
      mockDeleteInboundFax.mockResolvedValue(undefined);
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InboundFaxMatch />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeDefined();
      });

      // One click must NOT delete — it opens the confirmation dialog
      await user.click(screen.getByText('Delete'));
      expect(mockDeleteInboundFax).not.toHaveBeenCalled();

      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Delete inbound fax?')).toBeDefined();
      // Dialog states sender number, page count, and received date
      expect(within(dialog).getByText(/\+15551234567/)).toBeDefined();
      expect(within(dialog).getByText(/3-page/)).toBeDefined();
      expect(within(dialog).getByText(/2026-03-13T10:00:00Z/)).toBeDefined();

      // Confirming performs the delete and navigates back to the tasks board
      await user.click(screen.getByTestId('dialog-proceed-button'));
      await waitFor(() => {
        expect(mockDeleteInboundFax).toHaveBeenCalledWith(expect.anything(), {
          taskId: 'task-abc',
          communicationId: COMMUNICATION_ID,
        });
      });
      await waitFor(() => {
        expect(screen.getByTestId('tasks-page')).toBeDefined();
      });
    });

    it('does not delete when the dialog is cancelled', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InboundFaxMatch />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Delete')).toBeDefined();
      });

      await user.click(screen.getByText('Delete'));
      const dialog = await screen.findByRole('dialog');
      await user.click(within(dialog).getByText('Cancel'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(mockDeleteInboundFax).not.toHaveBeenCalled();
    });
  });

  describe('PDF preview failure', () => {
    it('shows a retry option and keeps Save disabled until the preview loads', async () => {
      mockGetPresignedURL.mockRejectedValue(new Error('presign failed'));
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InboundFaxMatch />
        </Wrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('PDF preview unavailable')).toBeDefined();
      });
      expect(screen.getByText('Retry preview')).toBeDefined();

      // Even with patient + folder selected, Save stays disabled while the preview is broken
      await selectPatientAndFolder(user);
      expect(screen.getByText(/preview must load/i)).toBeDefined();
      expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
      expect(mockFileInboundFax).not.toHaveBeenCalled();

      // Retry succeeds -> preview renders and Save becomes enabled
      mockGetPresignedURL.mockResolvedValue('https://presigned.example.com/fax.pdf');
      await user.click(screen.getByText('Retry preview'));

      await waitFor(() => {
        expect(screen.getByTitle('Inbound fax PDF preview')).toBeDefined();
      });
      await waitFor(() => {
        expect(screen.getByText('Save').closest('button')?.disabled).toBe(false);
      });
    });
  });
});

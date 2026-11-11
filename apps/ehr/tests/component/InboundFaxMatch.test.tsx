import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { APIErrorCode } from 'utils/lib/types/errors';
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

// Split per declaring module: InboundFaxMatch reaches these directly, not through the barrel.
vi.mock('utils/lib/helpers/presigned-file-url/helpers', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getPresignedURL: (...args: unknown[]) => mockGetPresignedURL(...args),
}));

vi.mock('utils/lib/types/data/tasks/types', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
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
  // The folder-List builders and synthetic-id helpers are intentionally absent: resolving and
  // creating folder Lists is the file-inbound-fax zambda's job, so this page never touches them.
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

const mockUseGetPatientVisitHistory = vi.fn();

vi.mock('../../src/hooks/useGetPatientVisitHistory', () => ({
  useGetPatientVisitHistory: (patientId: string | undefined) => mockUseGetPatientVisitHistory(patientId),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetEmployees', () => ({
  useGetEmployeesWithDetails: () => ({
    isLoading: false,
    data: { providers: [], nonProviders: [{ id: 'prac-1', name: 'Samwise Gamgee' }] },
  }),
  toProviderDetails: (e: { id: string; name: string }) => ({ practitionerId: e.id, name: e.name }),
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

const MOCK_VISITS = {
  visits: [
    {
      appointmentId: 'appt-1',
      encounterId: 'enc-1',
      type: 'walk-in',
      serviceMode: 'in-person',
      dateTime: '2026-03-01T15:00:00Z',
    },
    // No encounter: nothing a document could be attached to.
    {
      appointmentId: 'appt-2',
      encounterId: undefined,
      type: 'pre-booked',
      serviceMode: 'in-person',
      dateTime: '2026-02-01T15:00:00Z',
    },
  ],
};

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

const selectPatientAndFolder = async (
  user: ReturnType<typeof userEvent.setup>,
  folderLabel: string | RegExp = /Medical Records/
): Promise<void> => {
  await waitFor(() => {
    expect(screen.getByTestId('patient-search')).toBeDefined();
  });
  await user.click(screen.getByTestId('select-patient-btn'));
  await waitFor(() => {
    expect(screen.getByText(folderLabel)).toBeDefined();
  });
  await user.click(screen.getByText(folderLabel));
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
    mockUseGetPatientVisitHistory.mockImplementation((patientId: string | undefined) => ({
      isLoading: false,
      data: patientId ? MOCK_VISITS : undefined,
    }));
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

    // Read-only notice replaces the match panel. Without the filed marker it can't claim the fax was filed.
    await waitFor(() => {
      expect(
        screen.getByText("This fax's task was completed. It may not have been filed to a patient's chart.")
      ).toBeDefined();
    });
    expect(screen.queryByText('This fax has already been filed.')).toBeNull();

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

  it('says the fax was filed when a completed task carries the filed marker', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task')
        return Promise.resolve({
          unbundle: () => [
            {
              ...makeFaxTask('completed'),
              businessStatus: { coding: [{ system: 'inbound-fax-task', code: 'filed' }], text: 'Filed' },
            },
          ],
        });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('This fax has already been filed.')).toBeDefined();
    });
    expect(screen.queryByText(/may not have been filed/)).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
  });

  it('renders read-only when the fax was filed but its task is still open awaiting a manual Complete', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task')
        return Promise.resolve({
          unbundle: () => [
            {
              ...makeFaxTask('in-progress'),
              businessStatus: { coding: [{ system: 'inbound-fax-task', code: 'filed' }], text: 'Filed' },
            },
          ],
        });
      return Promise.resolve({ unbundle: () => [] });
    });

    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('This fax has already been filed.')).toBeDefined();
    });
    expect(screen.queryByTestId('patient-search')).toBeNull();
    expect(screen.queryByText('Save')).toBeNull();
    expect(screen.queryByText('Delete')).toBeNull();
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

  it('shows the full match form when the task is assigned (in-progress)', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve({ unbundle: () => [makeFaxTask('in-progress')] });
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
    expect(screen.queryByText('No matching task found for this fax')).toBeNull();
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
        internalName: 'medical-records',
        documentName: 'Fax from +15551234567',
      });
    });

    // Folder Lists are materialized by the zambda, which validates against the folder catalog
    // and re-checks patient ownership. The page must not write FHIR directly.
    expect(mockFhirCreate).not.toHaveBeenCalled();

    // Navigates back to the tasks board
    await waitFor(() => {
      expect(screen.getByTestId('tasks-page')).toBeDefined();
    });
  });

  describe('visit link and review task', () => {
    const renderPage = (): void => {
      const Wrapper = createWrapper();
      render(
        <Wrapper>
          <InboundFaxMatch />
        </Wrapper>
      );
    };

    const chooseOption = async (
      user: ReturnType<typeof userEvent.setup>,
      testId: string,
      option: RegExp
    ): Promise<void> => {
      await user.click(within(screen.getByTestId(testId)).getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: option }));
    };

    const save = async (user: ReturnType<typeof userEvent.setup>): Promise<void> => {
      const saveButton = screen.getByText('Save').closest('button');
      await waitFor(() => {
        expect(saveButton?.disabled).toBe(false);
      });
      await user.click(saveButton!);
    };

    it('offers only visits that have an encounter, and attaches the document to the chosen one', async () => {
      mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-1' });
      const user = userEvent.setup();
      renderPage();

      await selectPatientAndFolder(user);
      expect(mockUseGetPatientVisitHistory).toHaveBeenCalledWith('patient-123');
      await user.click(within(screen.getByTestId('inbound-fax-visit-select')).getByRole('combobox'));
      expect(await screen.findAllByRole('option')).toHaveLength(1);
      await user.click(screen.getByRole('option', { name: /Walk-in In Person Visit/ }));
      await save(user);

      await waitFor(() => {
        expect(mockFileInboundFax).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ encounterId: 'enc-1' })
        );
      });
      expect(mockFileInboundFax.mock.calls[0][1]).not.toHaveProperty('reviewTaskAssignee');
    });

    it('drops the chosen visit when the patient changes, since it belongs to the previous patient', async () => {
      mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-1' });
      const user = userEvent.setup();
      renderPage();

      await selectPatientAndFolder(user);
      await chooseOption(user, 'inbound-fax-visit-select', /Walk-in In Person Visit/);
      const clearButton = screen
        .getByDisplayValue(/Frodo Baggins/)
        .closest('.MuiInputBase-root')
        ?.querySelector('button');
      await user.click(clearButton!);
      await selectPatientAndFolder(user);
      await save(user);

      await waitFor(() => {
        expect(mockFileInboundFax).toHaveBeenCalled();
      });
      expect(mockFileInboundFax.mock.calls[0][1]).not.toHaveProperty('encounterId');
    });

    it('requires an assignee before filing with a review task, then sends it along', async () => {
      mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-1' });
      const user = userEvent.setup();
      renderPage();

      await selectPatientAndFolder(user);
      expect(screen.queryByTestId('inbound-fax-review-assignee')).toBeNull();
      await user.click(screen.getByLabelText('Create task to review this fax'));

      expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
      await chooseOption(user, 'inbound-fax-review-assignee', /Samwise Gamgee/);
      await save(user);

      await waitFor(() => {
        expect(mockFileInboundFax).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({ reviewTaskAssignee: { id: 'prac-1', name: 'Samwise Gamgee' } })
        );
      });
      expect(mockFileInboundFax.mock.calls[0][1]).not.toHaveProperty('encounterId');
      expect(enqueueSnackbar).toHaveBeenCalledWith('Fax filed and review task created', { variant: 'success' });
    });

    it('does not create a review task once the checkbox is unticked again', async () => {
      mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-1' });
      const user = userEvent.setup();
      renderPage();

      await selectPatientAndFolder(user);
      await user.click(screen.getByLabelText('Create task to review this fax'));
      await chooseOption(user, 'inbound-fax-review-assignee', /Samwise Gamgee/);
      await user.click(screen.getByLabelText('Create task to review this fax'));
      await save(user);

      await waitFor(() => {
        expect(mockFileInboundFax).toHaveBeenCalled();
      });
      expect(mockFileInboundFax.mock.calls[0][1]).not.toHaveProperty('reviewTaskAssignee');
      expect(enqueueSnackbar).toHaveBeenCalledWith('Fax filed successfully', { variant: 'success' });
    });
  });

  it('passes a synthetic folder id through for the zambda to materialize', async () => {
    mockUseGetPatientDocsFolders.mockReturnValue({ data: {}, isLoading: false });
    mockParsePatientDocsFolders.mockReturnValue([
      {
        id: 'synthetic:labs',
        folderName: 'Labs',
        internalName: 'labs',
        documentsCount: 0,
        isCustom: false,
      },
    ]);
    mockFileInboundFax.mockResolvedValue({ documentRefId: 'doc-1', folderId: 'folder-created' });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await selectPatientAndFolder(user, 'Labs (0)');

    const saveButton = screen.getByText('Save').closest('button');
    await waitFor(() => {
      expect(saveButton?.disabled).toBe(false);
    });
    await user.click(saveButton!);

    await waitFor(() => {
      expect(mockFileInboundFax).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ folderId: 'synthetic:labs', internalName: 'labs' })
      );
    });

    // No client-side List creation for a folder that does not exist yet.
    expect(mockFhirCreate).not.toHaveBeenCalled();
  });

  const staleError = { code: APIErrorCode.PRECONDITION_FAILED, message: 'Task/task-abc has already been filed' };
  it.each([
    ['a top-level', staleError],
    ['a nested output', { output: staleError }],
  ])('refreshes into the read-only view when someone else filed the fax first (%s error code)', async (_, apiError) => {
    let filedElsewhere = false;
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType !== 'Task') return Promise.resolve({ unbundle: () => [] });
      const task = filedElsewhere
        ? { ...makeFaxTask('ready'), businessStatus: { coding: [{ system: 'inbound-fax-task', code: 'filed' }] } }
        : makeFaxTask('ready');
      return Promise.resolve({ unbundle: () => [task] });
    });
    mockFileInboundFax.mockImplementation(async () => {
      filedElsewhere = true;
      throw apiError;
    });
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
      expect(screen.getByText('This fax has already been filed.')).toBeDefined();
    });
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.stringContaining('changed by someone else'), {
      variant: 'error',
    });
    expect(enqueueSnackbar).not.toHaveBeenCalledWith(expect.stringContaining('Please try again'), expect.anything());
    expect(screen.queryByTestId('tasks-page')).toBeNull();
  });

  it('offers only Delete for a fax whose earlier delete did not finish', async () => {
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType !== 'Task') return Promise.resolve({ unbundle: () => [] });
      return Promise.resolve({
        unbundle: () => [
          { ...makeFaxTask('ready'), businessStatus: { coding: [{ system: 'inbound-fax-task', code: 'deleting' }] } },
        ],
      });
    });
    const user = userEvent.setup();
    const Wrapper = createWrapper();
    render(
      <Wrapper>
        <InboundFaxMatch />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/previous attempt to delete this fax did not finish/)).toBeDefined();
    });
    await selectPatientAndFolder(user);
    expect(screen.getByText('Save').closest('button')?.disabled).toBe(true);
    expect(screen.getByText('Delete').closest('button')?.disabled).toBe(false);
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

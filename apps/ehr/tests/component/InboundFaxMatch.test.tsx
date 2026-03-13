import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
const mockOystehr = {
  fhir: {
    search: mockFhirSearch,
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

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({
    getAccessTokenSilently: vi.fn().mockResolvedValue('test-token'),
  }),
}));

vi.mock('../../src/layout/PageContainer', () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="page-container">{children}</div>,
}));

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
  getPresignedURL: vi.fn().mockResolvedValue('https://presigned.example.com/fax.pdf'),
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
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

// ============================================================================
// HELPERS
// ============================================================================

const COMMUNICATION_ID = 'comm-test-123';

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

const mockTaskSearchResult = {
  unbundle: () => [
    {
      resourceType: 'Task',
      id: 'task-abc',
      status: 'ready',
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
    },
  ],
};

const mockFolderSearchResult = {
  unbundle: () => [
    {
      resourceType: 'List',
      id: 'folder-1',
      status: 'current',
      code: { coding: [{ code: 'patient-docs-folder', display: 'Medical Records' }] },
      entry: [{ item: { reference: 'DocumentReference/doc-1' } }],
    },
    {
      resourceType: 'List',
      id: 'folder-2',
      status: 'current',
      code: { coding: [{ code: 'patient-docs-folder', display: 'Lab Results' }] },
      entry: [],
    },
  ],
};

// ============================================================================
// TESTS
// ============================================================================

describe('InboundFaxMatch page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: Task search returns a task, folder search returns empty initially
    mockFhirSearch.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Task') return Promise.resolve(mockTaskSearchResult);
      if (resourceType === 'List') return Promise.resolve(mockFolderSearchResult);
      return Promise.resolve({ unbundle: () => [] });
    });
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
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'test-appointment-id' }),
  };
});

const mockCreateTemplate = vi.fn();
const mockDeleteTemplate = vi.fn();
const mockApplyTemplate = vi.fn();
const mockListTemplates = vi.fn();

vi.mock('src/api/api', () => ({
  createTemplate: (...args: any[]) => mockCreateTemplate(...args),
  deleteTemplate: (...args: any[]) => mockDeleteTemplate(...args),
  applyTemplate: (...args: any[]) => mockApplyTemplate(...args),
  listTemplates: (...args: any[]) => mockListTemplates(...args),
}));

const mockOystehrZambda = { zambda: { execute: vi.fn() } };

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehrZambda: mockOystehrZambda,
  }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    encounter: { id: 'test-encounter-id' },
  }),
}));

let mockIsReadOnly = false;

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({
    isAppointmentReadOnly: mockIsReadOnly,
  }),
}));

const mockResetExamObservationsStore = vi.fn();

vi.mock('../../src/features/visits/shared/stores/appointment/reset-exam-observations', () => ({
  resetExamObservationsStore: (...args: any[]) => mockResetExamObservationsStore(...args),
}));

const mockEnqueueSnackbar = vi.fn();

vi.mock('notistack', () => ({
  enqueueSnackbar: (...args: any[]) => mockEnqueueSnackbar(...args),
}));

vi.mock('src/constants', () => ({
  CHART_DATA_QUERY_KEY: 'chart-data',
  CHART_FIELDS_QUERY_KEY: 'chart-fields',
  QUERY_STALE_TIME: 5 * 60 * 1000,
}));

// ============================================================================
// IMPORTS (must come after vi.mock calls)
// ============================================================================

import { ApplyTemplate } from '../../src/features/visits/shared/components/templates/ApplyTemplate';

// ============================================================================
// HELPERS
// ============================================================================

const mockTemplatesData = {
  templates: [
    { title: 'Sore Throat', id: 'template-1' },
    { title: 'Ear Infection', id: 'template-2' },
    { title: 'Well Child Visit', id: 'template-3' },
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
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

// ============================================================================
// TESTS
// ============================================================================

describe('ApplyTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReadOnly = false;
    mockListTemplates.mockResolvedValue(mockTemplatesData);
    mockCreateTemplate.mockResolvedValue({ templateName: 'New Template', templateId: 'new-id' });
    mockDeleteTemplate.mockResolvedValue({ message: 'Deleted' });
    mockApplyTemplate.mockResolvedValue({ message: 'Applied' });
  });

  it('should render the template select autocomplete', async () => {
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });
  });

  it('should show "+ Add or Update Template From Note" as first option when dropdown opens', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });
  });

  it('should open create dialog when "+ Add or Update Template From Note" is selected', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ Add or Update Template From Note'));

    await waitFor(() => {
      expect(screen.getByText('Save Note As Template')).toBeInTheDocument();
    });
  });

  it('should show template name input and section list in create dialog', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });

    await user.click(screen.getByText('+ Add or Update Template From Note'));

    await waitFor(() => {
      expect(screen.getByLabelText('Template name *')).toBeInTheDocument();
    });

    // Check that section list is displayed
    expect(screen.getByText(/HPI \(History of Present Illness\)/)).toBeInTheDocument();
    expect(screen.getByText(/Review of Systems \(ROS\)/)).toBeInTheDocument();
    expect(screen.getByText(/Exam findings/)).toBeInTheDocument();
    expect(screen.getByText(/Medical Decision Making \(MDM\)/)).toBeInTheDocument();
    expect(screen.getByText(/CPT Codes/)).toBeInTheDocument();
    expect(screen.getByText(/E&M Code/)).toBeInTheDocument();
  });

  it('should call createTemplate when saving a new template name', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    // Open create dialog
    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);
    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });
    await user.click(screen.getByText('+ Add or Update Template From Note'));

    await waitFor(() => {
      expect(screen.getByLabelText('Template name *')).toBeInTheDocument();
    });

    // Type a new template name
    const nameInput = screen.getByLabelText('Template name *');
    await user.type(nameInput, 'Brand New Template');

    // Click Save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          encounterId: 'test-encounter-id',
          templateName: 'Brand New Template',
          examType: 'inPerson',
        })
      );
    });
  });

  it('should show overwrite confirmation when entering an existing template name', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    // Open create dialog
    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);
    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });
    await user.click(screen.getByText('+ Add or Update Template From Note'));

    await waitFor(() => {
      expect(screen.getByLabelText('Template name *')).toBeInTheDocument();
    });

    // Type an existing template name
    const nameInput = screen.getByLabelText('Template name *');
    await user.type(nameInput, 'Sore Throat');

    // Click Save
    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.click(saveButton);

    // Should show overwrite confirmation
    await waitFor(() => {
      expect(screen.getByText('Update Existing Template?')).toBeInTheDocument();
      expect(screen.getByText(/already exists/)).toBeInTheDocument();
    });
  });

  it('should call deleteTemplate then createTemplate when confirming overwrite', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    // Open create dialog
    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);
    await waitFor(() => {
      expect(screen.getByText('+ Add or Update Template From Note')).toBeInTheDocument();
    });
    await user.click(screen.getByText('+ Add or Update Template From Note'));

    await waitFor(() => {
      expect(screen.getByLabelText('Template name *')).toBeInTheDocument();
    });

    // Type an existing template name
    const nameInput = screen.getByLabelText('Template name *');
    await user.type(nameInput, 'Sore Throat');

    // Click Save to trigger overwrite confirmation
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(screen.getByText('Update Existing Template?')).toBeInTheDocument();
    });

    // Confirm the overwrite by clicking Replace
    await user.click(screen.getByRole('button', { name: 'Replace' }));

    await waitFor(() => {
      expect(mockDeleteTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({ templateId: 'template-1' })
      );
    });

    await waitFor(() => {
      expect(mockCreateTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          encounterId: 'test-encounter-id',
          templateName: 'Sore Throat',
          examType: 'inPerson',
        })
      );
    });
  });

  it('should show apply confirmation dialog when selecting a regular template', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('Sore Throat')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sore Throat'));

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to apply/)).toBeInTheDocument();
      // Dialog title and confirm button both say "Apply Template"
      expect(screen.getAllByText('Apply Template').length).toBeGreaterThanOrEqual(2);
    });
  });

  it('should call applyTemplate when confirming apply', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    const autocomplete = screen.getByLabelText('Select condition');
    await user.click(autocomplete);

    await waitFor(() => {
      expect(screen.getByText('Sore Throat')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Sore Throat'));

    await waitFor(() => {
      expect(screen.getByText(/Are you sure you want to apply/)).toBeInTheDocument();
    });

    // Click the "Apply Template" button in the dialog (the second one, in DialogActions)
    const applyButtons = screen.getAllByText('Apply Template');
    const confirmButton = applyButtons[applyButtons.length - 1];
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockApplyTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          encounterId: 'test-encounter-id',
          templateName: 'Sore Throat',
          examType: 'inPerson',
        })
      );
    });
  });

  it('should disable autocomplete when in read-only mode', async () => {
    mockIsReadOnly = true;

    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Select condition')).toBeDisabled();
  });
});

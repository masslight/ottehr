import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
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
const mockGetTemplateDetail = vi.fn();

vi.mock('src/api/api', () => ({
  createTemplate: (...args: any[]) => mockCreateTemplate(...args),
  deleteTemplate: (...args: any[]) => mockDeleteTemplate(...args),
  applyTemplate: (...args: any[]) => mockApplyTemplate(...args),
  listTemplates: (...args: any[]) => mockListTemplates(...args),
  getTemplateDetail: (...args: any[]) => mockGetTemplateDetail(...args),
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

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({
    hasRole: () => true,
  }),
}));

const mockResetRosObservationsStore = vi.fn();

vi.mock('../../src/features/visits/shared/stores/appointment/reset-ros-observations', () => ({
  resetRosObservationsStore: (...args: any[]) => mockResetRosObservationsStore(...args),
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

const mockTemplateDetail = {
  templateName: 'Sore Throat',
  templateId: 'template-1',
  examVersion: '2025-09-25',
  isCurrentVersion: true,
  sections: {
    hpiNote: 'Patient reports sore throat for 3 days.',
    moiNote: null,
    rosNote: 'Negative except as documented.',
    rosFindings: [],
    examFindings: [
      { fieldName: 'tender', label: 'Tender', isAbnormal: true, note: 'RLQ' },
      { fieldName: 'soft', label: 'Soft', isAbnormal: false, note: '' },
    ],
    mdm: 'Streptococcal pharyngitis suspected.',
    diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }],
    patientInstructions: [{ title: 'Hydration', text: 'Drink plenty of fluids.' }],
    cptCodes: [{ code: '99213', display: 'Office visit' }],
    emCode: { code: '99213', display: 'Office visit' },
  },
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
    mockGetTemplateDetail.mockResolvedValue(mockTemplateDetail);
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
    expect(screen.getByText(/Exam Findings/)).toBeInTheDocument();
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
        })
      );
    });
  });

  it('should open the preview dialog with section cards when selecting a regular template', async () => {
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
      expect(screen.getByText('Apply Template: Sore Throat')).toBeInTheDocument();
      expect(screen.getByText(/Review what will be applied/)).toBeInTheDocument();
    });

    // Only sections with content in the fixture should render. moiNote is null.
    await waitFor(() => {
      expect(screen.getByTestId('template-section-hpi')).toBeInTheDocument();
    });
    expect(screen.getByTestId('template-section-mdm')).toBeInTheDocument();
    expect(screen.getByTestId('template-section-examFindings')).toBeInTheDocument();
    expect(screen.queryByTestId('template-section-moi')).not.toBeInTheDocument();
  });

  it('should send default actions to applyTemplate when applied without changes', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByLabelText('Select condition')).toBeInTheDocument();
    });

    await user.click(screen.getByLabelText('Select condition'));
    await waitFor(() => {
      expect(screen.getByText('Sore Throat')).toBeInTheDocument();
    });
    await user.click(screen.getByText('Sore Throat'));

    await waitFor(() => {
      expect(screen.getByTestId('template-section-hpi')).toBeInTheDocument();
    });

    const applyButton = screen.getByRole('button', { name: 'Apply Template' });
    await user.click(applyButton);

    await waitFor(() => {
      expect(mockApplyTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          encounterId: 'test-encounter-id',
          templateName: 'Sore Throat',
          sectionActions: {
            hpi: 'append',
            // moi section is hidden because the template carries no MOI content; the
            // client sends 'skip' explicitly so the server doesn't fall back to its
            // per-section default and silently touch existing chart data.
            moi: 'skip',
            ros: 'overwrite',
            examFindings: 'overwrite',
            mdm: 'overwrite',
            diagnoses: 'append',
            patientInstructions: 'overwrite',
            cptCodes: 'append',
            emCode: 'overwrite',
          },
        })
      );
    });
  });

  it('should not render an Append button for sections that disallow it', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const examCard = await screen.findByTestId('template-section-examFindings');
    expect(within(examCard).queryByRole('button', { name: 'Append' })).toBeNull();
    expect(within(examCard).getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(within(examCard).getByRole('button', { name: 'Overwrite' })).toBeInTheDocument();

    const emCard = screen.getByTestId('template-section-emCode');
    expect(within(emCard).queryByRole('button', { name: 'Append' })).toBeNull();
  });

  it('should forward the user-selected per-section actions to applyTemplate', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const mdmCard = await screen.findByTestId('template-section-mdm');
    await user.click(within(mdmCard).getByRole('button', { name: 'Skip' }));

    const hpiCard = screen.getByTestId('template-section-hpi');
    await user.click(within(hpiCard).getByRole('button', { name: 'Overwrite' }));

    await user.click(screen.getByRole('button', { name: 'Apply Template' }));

    await waitFor(() => {
      expect(mockApplyTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          sectionActions: expect.objectContaining({
            mdm: 'skip',
            hpi: 'overwrite',
          }),
        })
      );
    });
  });

  it('should render sections collapsed by default with a summary, expanding on click', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const examCard = await screen.findByTestId('template-section-examFindings');
    // Summary is rendered in the header
    expect(within(examCard).getByText('1 abnormal, 1 normal')).toBeInTheDocument();
    // Body contents are NOT in the DOM while collapsed (Collapse uses unmountOnExit)
    expect(within(examCard).queryByText('Abdomen')).toBeNull();

    // Click the section header to expand (stable testid - resilient to label copy changes)
    await user.click(within(examCard).getByTestId('template-section-examFindings-header'));

    await waitFor(() => {
      // Body-system grouping renders the section header
      expect(within(examCard).getByText('Abdomen')).toBeInTheDocument();
    });
    // And the chips appear underneath the header
    expect(within(examCard).getByText('Tender: RLQ')).toBeInTheDocument();
    expect(within(examCard).getByText('Soft')).toBeInTheDocument();
  });

  it('should disable Apply when every section is set to Skip', async () => {
    const user = userEvent.setup();
    mockGetTemplateDetail.mockResolvedValue({
      ...mockTemplateDetail,
      sections: {
        ...mockTemplateDetail.sections,
        rosNote: null,
        examFindings: [],
        diagnoses: [],
        patientInstructions: [],
        cptCodes: [],
        emCode: null,
        mdm: null,
        // Only HPI has content.
      },
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const hpiCard = await screen.findByTestId('template-section-hpi');
    await user.click(within(hpiCard).getByRole('button', { name: 'Skip' }));

    const applyButton = screen.getByRole('button', { name: 'Apply Template' });
    expect(applyButton).toBeDisabled();
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

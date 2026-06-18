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
    patient: { id: 'test-patient-id' },
    location: { id: 'test-location-id', name: 'Test Office' },
  }),
}));

const mockUseGetCreateExternalLabResources = vi.fn();

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCreateExternalLabResources: (...args: any[]) => mockUseGetCreateExternalLabResources(...args),
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
    inHouseLabs: [
      {
        planId: 'plan-1',
        testName: 'Strep test',
        activityDefinitionRef: 'http://example.com/ad/strep|1',
        code: 'strep',
        diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }],
        notes: [],
        cptCodes: [{ code: '87880', display: 'Strep rapid', modifiers: [] }],
        missing: false,
      },
      {
        planId: 'plan-2',
        testName: 'Retired Test',
        activityDefinitionRef: 'http://example.com/ad/retired|1',
        code: 'retired',
        diagnoses: [],
        notes: [],
        cptCodes: [],
        missing: true,
      },
    ],
    externalLabs: [
      {
        planId: 'ext-plan-1',
        labGuid: 'lab-guid-1',
        labName: 'Quest Diagnostics',
        testName: 'CBC With Differential',
        testCode: '7788',
        diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }],
        note: 'fasting required',
        psc: true,
        missing: false,
      },
      {
        planId: 'ext-plan-2',
        labGuid: 'lab-guid-1',
        labName: 'Quest Diagnostics',
        testName: 'Discontinued Panel',
        testCode: '9999',
        diagnoses: [],
        note: null,
        psc: false,
        missing: true,
      },
    ],
    procedures: [
      {
        planId: 'proc-1',
        procedureType: 'Splint application',
        performerType: 'Provider',
        bodySite: 'Wrist',
        bodySide: 'Left',
        technique: ['Closed reduction'],
        medicationUsed: 'Lidocaine 1%',
        suppliesUsed: 'Splint kit',
        procedureDetails: 'Applied volar splint after reduction.',
        specimenSent: false,
        complications: undefined,
        patientResponse: 'Tolerated well',
        postInstructions: 'Keep splint dry. Follow up in 1 week.',
        timeSpent: '15 minutes',
        documentedBy: 'Provider',
        consentObtained: true,
        diagnoses: [{ code: 'S62.001A', display: 'Fracture of left wrist' }],
        cptCodes: [{ code: '29105', display: 'Application of long arm splint', modifiers: [] }],
      },
    ],
  },
};

const mockExternalLabResources = {
  coverages: [{ coverageName: 'Aetna', coverageId: 'cov-1', isPrimary: true }],
  appointmentIsWorkersComp: false,
  orderingLocations: [{ id: 'test-location-id', name: 'Test Office', enabledLabs: [] }],
  orderingLocationIds: ['test-location-id'],
  labs: [],
  labSets: undefined,
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
    mockUseGetCreateExternalLabResources.mockReturnValue({
      data: mockExternalLabResources,
      isLoading: false,
      isError: false,
    });
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
            inHouseLabs: 'append',
            externalLabs: 'append',
            procedures: 'append',
          },
          // The payment method auto-selects from the visit's payment details
          // ('insurance' because the patient has coverage) and rides along
          // with the apply call.
          externalLabs: { paymentMethod: 'insurance' },
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

  it('should render the in-house lab plans, hide Overwrite, and mark missing ADs', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-inHouseLabs');
    // Summary calls out the missing-AD count in addition to the test names.
    expect(within(labCard).getByText(/Strep test/)).toBeInTheDocument();
    expect(within(labCard).getByText(/1 unavailable/)).toBeInTheDocument();

    // In-house labs are append-or-skip only; the Overwrite toggle should not render.
    expect(within(labCard).queryByRole('button', { name: 'Overwrite' })).toBeNull();
    expect(within(labCard).getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(within(labCard).getByRole('button', { name: 'Append' })).toBeInTheDocument();

    await user.click(within(labCard).getByTestId('template-section-inHouseLabs-header'));

    // Both plans appear in the expanded preview, with the missing one flagged.
    await waitFor(() => {
      expect(within(labCard).getByText('Retired Test')).toBeInTheDocument();
    });
    expect(within(labCard).getByText(/unavailable in this environment/)).toBeInTheDocument();
  });

  it('should surface zambda warnings as snackbars after apply', async () => {
    const user = userEvent.setup();
    mockApplyTemplate.mockResolvedValue({
      warnings: [{ section: 'inHouseLabs', message: 'Skipped "Retired Test" — definition not found.' }],
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));
    await screen.findByTestId('template-section-inHouseLabs');
    await user.click(screen.getByRole('button', { name: 'Apply Template' }));

    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Template applied successfully!', { variant: 'success' });
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Skipped "Retired Test" — definition not found.', {
      variant: 'warning',
    });
  });

  it('should render the procedures section and hide Overwrite', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const procCard = await screen.findByTestId('template-section-procedures');
    // Summary surfaces the procedure type so the user can identify the entry while collapsed.
    expect(within(procCard).getByText(/Splint application/)).toBeInTheDocument();

    // Procedures are append-or-skip only, like in-house labs.
    expect(within(procCard).queryByRole('button', { name: 'Overwrite' })).toBeNull();
    expect(within(procCard).getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(within(procCard).getByRole('button', { name: 'Append' })).toBeInTheDocument();

    await user.click(within(procCard).getByTestId('template-section-procedures-header'));

    // Expanding shows the linked CPT/diagnosis codes and a few of the form fields.
    await waitFor(() => {
      expect(within(procCard).getByText(/29105/)).toBeInTheDocument();
    });
    expect(within(procCard).getByText(/S62.001A/)).toBeInTheDocument();
    expect(within(procCard).getByText(/Wrist/)).toBeInTheDocument();
    expect(within(procCard).getByText(/Closed reduction/)).toBeInTheDocument();
  });

  it('should not render the procedures section when the template carries no procedures', async () => {
    mockGetTemplateDetail.mockResolvedValue({
      ...mockTemplateDetail,
      sections: { ...mockTemplateDetail.sections, procedures: [] },
    });
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    // Other sections still render; the procedures card is suppressed when empty.
    await screen.findByTestId('template-section-hpi');
    expect(screen.queryByTestId('template-section-procedures')).toBeNull();
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
        inHouseLabs: [],
        externalLabs: [],
        procedures: [],
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

  it('should render the external lab plans with apply controls, hide Overwrite, and mark missing tests', async () => {
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-externalLabs');
    // Summary calls out the missing-test count and echoes the payment method
    // that will be used (defaulted from the visit's payment details -
    // insurance, since the patient has coverage) so the user gets a reminder
    // without expanding the card.
    const header = within(labCard).getByTestId('template-section-externalLabs-header');
    expect(header).toHaveTextContent(/CBC With Differential/);
    expect(header).toHaveTextContent(/1 unavailable/);
    expect(header).toHaveTextContent(/Payment: Insurance/);

    // External labs are append-or-skip only; the Overwrite toggle should not render.
    expect(within(labCard).queryByRole('button', { name: 'Overwrite' })).toBeNull();
    expect(within(labCard).getByRole('button', { name: 'Skip' })).toBeInTheDocument();
    expect(within(labCard).getByRole('button', { name: 'Append' })).toBeInTheDocument();

    // The apply controls live in the expanded body - not in the DOM while collapsed.
    expect(within(labCard).queryByTestId('template-section-externalLabs-controls')).toBeNull();

    await user.click(within(labCard).getByTestId('template-section-externalLabs-header'));

    // Expanding reveals the auto-selected ordering office and the payment
    // method select for the rare case where the user wants to change it.
    const controls = await within(labCard).findByTestId('template-section-externalLabs-controls');
    expect(within(controls).getByTestId('template-external-labs-ordering-office')).toHaveTextContent('Test Office');
    expect(within(controls).getByTestId('template-external-labs-payment-method')).toHaveTextContent('Insurance');

    // Both plans appear in the expanded preview with their saved ordering
    // details (the test name also shows in the collapsed summary, hence 2).
    expect(within(labCard).getAllByText(/Discontinued Panel/)).toHaveLength(2);
    expect(within(labCard).getByText(/unavailable in this environment/)).toBeInTheDocument();
    expect(within(labCard).getByText('PSC Hold')).toBeInTheDocument();
    expect(within(labCard).getByText(/fasting required/)).toBeInTheDocument();
  });

  it('should require a payment method before Apply when none can be auto-selected', async () => {
    const user = userEvent.setup();
    // No coverage info at all: nothing to auto-select from, so the user must
    // pick a payment method before the section can be appended.
    mockUseGetCreateExternalLabResources.mockReturnValue({
      data: { ...mockExternalLabResources, coverages: undefined },
      isLoading: false,
      isError: false,
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-externalLabs');
    const applyButton = screen.getByRole('button', { name: 'Apply Template' });
    expect(applyButton).toBeDisabled();

    // The header summary flags the missing requirement while collapsed.
    expect(within(labCard).getByTestId('template-section-externalLabs-header')).toHaveTextContent(
      /payment method needed/
    );

    // Expanding the card and selecting a payment method satisfies the requirement.
    await user.click(within(labCard).getByTestId('template-section-externalLabs-header'));
    const paymentSelect = await within(labCard).findByTestId('template-external-labs-payment-method');
    await user.click(within(paymentSelect).getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: 'Self Pay' }));

    expect(applyButton).toBeEnabled();
    await user.click(applyButton);

    await waitFor(() => {
      expect(mockApplyTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.objectContaining({
          sectionActions: expect.objectContaining({ externalLabs: 'append' }),
          externalLabs: { paymentMethod: 'selfPay' },
        })
      );
    });
  });

  it('should not require a payment method when the external labs section is skipped', async () => {
    const user = userEvent.setup();
    mockUseGetCreateExternalLabResources.mockReturnValue({
      data: { ...mockExternalLabResources, coverages: undefined },
      isLoading: false,
      isError: false,
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-externalLabs');
    await user.click(within(labCard).getByRole('button', { name: 'Skip' }));

    // Skipping unblocks Apply (the controls stay tucked away in the collapsed body).
    expect(within(labCard).queryByTestId('template-section-externalLabs-controls')).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Apply Template' }));

    await waitFor(() => {
      expect(mockApplyTemplate).toHaveBeenCalledWith(
        mockOystehrZambda,
        expect.not.objectContaining({ externalLabs: expect.anything() })
      );
    });
    expect(mockApplyTemplate.mock.calls[0][1].sectionActions.externalLabs).toBe('skip');
  });

  it('should block Apply when payment options fail to load, until the section is skipped', async () => {
    const user = userEvent.setup();
    // Templates carry no payment method, so a failed options fetch means no
    // payment method can be confirmed - appending is blocked and the user is
    // told to skip the section.
    mockUseGetCreateExternalLabResources.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-externalLabs');
    expect(screen.getByRole('button', { name: 'Apply Template' })).toBeDisabled();
    // The header summary flags the problem; expanding shows the explanation.
    expect(within(labCard).getByTestId('template-section-externalLabs-header')).toHaveTextContent(
      /payment options unavailable/i
    );
    await user.click(within(labCard).getByTestId('template-section-externalLabs-header'));
    expect(await within(labCard).findByTestId('template-external-labs-resources-error')).toBeInTheDocument();

    await user.click(within(labCard).getByRole('button', { name: 'Skip' }));
    expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled();
  });

  it('should warn without blocking Apply when the visit office is not configured for external labs', async () => {
    const user = userEvent.setup();
    mockUseGetCreateExternalLabResources.mockReturnValue({
      data: {
        ...mockExternalLabResources,
        orderingLocations: [{ id: 'some-other-location', name: 'Other Office', enabledLabs: [] }],
        orderingLocationIds: ['some-other-location'],
      },
      isLoading: false,
      isError: false,
    });
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    const labCard = await screen.findByTestId('template-section-externalLabs');
    // Orders will be skipped server-side with a warning, so there is no
    // payment method to require and Apply stays enabled.
    expect(screen.getByRole('button', { name: 'Apply Template' })).toBeEnabled();
    // Expanding shows the office warning instead of the payment selector.
    await user.click(within(labCard).getByTestId('template-section-externalLabs-header'));
    expect(await within(labCard).findByTestId('template-external-labs-office-warning')).toBeInTheDocument();
    expect(within(labCard).queryByTestId('template-external-labs-payment-method')).toBeNull();
  });

  it('should not render the external labs section when the template carries none', async () => {
    mockGetTemplateDetail.mockResolvedValue({
      ...mockTemplateDetail,
      sections: { ...mockTemplateDetail.sections, externalLabs: [] },
    });
    const user = userEvent.setup();
    render(<ApplyTemplate />, { wrapper: createWrapper() });

    await user.click(await screen.findByLabelText('Select condition'));
    await user.click(await screen.findByText('Sore Throat'));

    await screen.findByTestId('template-section-hpi');
    expect(screen.queryByTestId('template-section-externalLabs')).toBeNull();
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

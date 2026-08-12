import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { PaperworkFlow, ServiceMode } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockListPaperworkFlows = vi.fn<(...args: any[]) => Promise<any>>();
const mockDeletePaperworkFlow = vi.fn<(...args: any[]) => Promise<any>>();
const mockListServiceCategories = vi.fn<(...args: any[]) => Promise<any>>();
const mockPracticeManagedQuestionnaireList = vi.fn<(...args: any[]) => Promise<any>>();

vi.mock('src/api/api', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    listPaperworkFlows: (...args: any[]) => mockListPaperworkFlows(...args),
    deletePaperworkFlow: (...args: any[]) => mockDeletePaperworkFlow(...args),
    listServiceCategories: (...args: any[]) => mockListServiceCategories(...args),
    practiceManagedQuestionnaireList: (...args: any[]) => mockPracticeManagedQuestionnaireList(...args),
  };
});

const mockOystehrZambda = {} as any;
let mockUseApiClientsReturn: any = { oystehrZambda: mockOystehrZambda };

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => mockUseApiClientsReturn,
}));

vi.mock('notistack', async () => {
  const actual = (await vi.importActual('notistack')) as any;
  return { ...actual, enqueueSnackbar: vi.fn() };
});

vi.mock('utils', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    // BOOKING_CONFIG is a lazy proxy; replace it outright rather than spreading it (spreading
    // triggers a "non-configurable property" proxy trap error) since the component only reads
    // `.serviceCategories`.
    BOOKING_CONFIG: {
      serviceCategories: [
        { category: { code: 'urgent-care', display: 'Urgent Care' } },
        { category: { code: 'pediatrics', display: 'Pediatrics' } },
      ],
    },
  };
});

// The dialog is a large, independently-owned component; stub it so these tests focus on what the
// list page itself is responsible for: fetching, rendering rows, row actions, and the props it
// hands off to open/edit/duplicate a flow.
vi.mock('src/features/visits/telemed/components/admin/paperwork-flows/components/PaperworkFlowDialog', () => ({
  PaperworkFlowDialog: (props: any) => (
    <div
      data-testid="paperwork-flow-dialog"
      data-open={String(props.open)}
      data-editing-flow-id={props.editingFlowId ?? ''}
      data-seed-name={props.initial.name}
      data-seed-forms={props.initial.formsSelected.map((f: any) => f.id).join(',')}
      data-seed-modes={props.initial.modes.join(',')}
      data-seed-services={props.initial.services.map((s: any) => s.id).join(',')}
      data-form-options={props.formOptions.map((f: any) => f.id).join(',')}
      data-service-options={props.serviceCategories.map((s: any) => s.id).join(',')}
    />
  ),
}));

import { enqueueSnackbar } from 'notistack';
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
import PaperworkFlowsAdminPage from 'src/features/visits/telemed/components/admin/paperwork-flows/PaperworkFlowsAdminPage';

const flowFixture = (overrides: Partial<PaperworkFlow> = {}): PaperworkFlow => ({
  qId: 'flow-1',
  name: 'Standard Intake',
  forms: [{ id: 'form-1', url: 'https://ottehr.com/FHIR/Questionnaire/form-1', label: 'Consent Form' }],
  modes: [ServiceMode['in-person'], ServiceMode.virtual],
  services: [{ id: 'svc-1', label: 'Urgent Care', ottehrManagedService: true }],
  url: 'https://fhir.ottehr.com/Questionnaire/flow-1',
  version: '1',
  status: 'active',
  ...overrides,
});

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  // The "New flow" CTA portals into the shared admin header slot; provide a target so it renders.
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AdminHeaderSlotProvider value={document.body}>{children}</AdminHeaderSlotProvider>
    </QueryClientProvider>
  );
};

const getDialog = (): HTMLElement => screen.getByTestId('paperwork-flow-dialog');

describe('PaperworkFlowsAdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseApiClientsReturn = { oystehrZambda: mockOystehrZambda };
    mockListPaperworkFlows.mockResolvedValue({ flows: [flowFixture()], ottehrManagedQuestionnaires: [] });
    mockListServiceCategories.mockResolvedValue({ serviceCategories: [] });
    mockPracticeManagedQuestionnaireList.mockResolvedValue({ practiceManagedQuestionnaires: [] });
  });

  it('shows a loading spinner while the flow list is loading', async () => {
    mockListPaperworkFlows.mockReturnValue(new Promise(() => {}));

    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows an empty state when there are no flows', async () => {
    mockListPaperworkFlows.mockResolvedValue({ flows: [], ottehrManagedQuestionnaires: [] });

    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText(/No paperwork flows yet/i)).toBeInTheDocument());
  });

  it('renders a flow row with its forms, services, and visit modality chips', async () => {
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    expect(screen.getByText('Consent Form')).toBeInTheDocument();
    expect(screen.getByText('Urgent Care')).toBeInTheDocument();
    expect(screen.getByText('In-Person')).toBeInTheDocument();
    expect(screen.getByText('Virtual')).toBeInTheDocument();
  });

  it('shows a dash placeholder in the forms column when a flow has no forms', async () => {
    mockListPaperworkFlows.mockResolvedValue({ flows: [flowFixture({ forms: [] })], ottehrManagedQuestionnaires: [] });

    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('disables the New flow button until the zambda client is ready', async () => {
    mockUseApiClientsReturn = { oystehrZambda: undefined };

    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText(/No paperwork flows yet/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'New flow' })).toBeDisabled();
  });

  it('opens the dialog with a blank draft when New flow is clicked', async () => {
    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New flow' }));

    const dialog = getDialog();
    expect(dialog).toHaveAttribute('data-open', 'true');
    expect(dialog).toHaveAttribute('data-editing-flow-id', '');
    expect(dialog).toHaveAttribute('data-seed-name', '');
    expect(dialog).toHaveAttribute('data-seed-forms', '');
    expect(dialog).toHaveAttribute('data-seed-modes', '');
    expect(dialog).toHaveAttribute('data-seed-services', '');
  });

  it('opens the dialog pre-filled with the flow being edited', async () => {
    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const dialog = getDialog();
    expect(dialog).toHaveAttribute('data-open', 'true');
    expect(dialog).toHaveAttribute('data-editing-flow-id', 'flow-1');
    expect(dialog).toHaveAttribute('data-seed-name', 'Standard Intake');
    expect(dialog).toHaveAttribute('data-seed-forms', 'form-1');
    expect(dialog).toHaveAttribute('data-seed-modes', 'in-person,virtual');
    expect(dialog).toHaveAttribute('data-seed-services', 'svc-1');
  });

  it('opens the dialog as a fresh copy (name and services cleared, forms and modes kept) on Duplicate', async () => {
    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    const dialog = getDialog();
    expect(dialog).toHaveAttribute('data-open', 'true');
    expect(dialog).toHaveAttribute('data-editing-flow-id', '');
    expect(dialog).toHaveAttribute('data-seed-name', '');
    expect(dialog).toHaveAttribute('data-seed-forms', 'form-1');
    expect(dialog).toHaveAttribute('data-seed-modes', 'in-person,virtual');
    expect(dialog).toHaveAttribute('data-seed-services', '');
  });

  it('builds formOptions from ottehr-managed forms plus non-retired practice-managed forms, sorted by label', async () => {
    mockListPaperworkFlows.mockResolvedValue({
      flows: [flowFixture()],
      ottehrManagedQuestionnaires: [{ id: 'consent', label: 'Consent' }],
    });
    mockPracticeManagedQuestionnaireList.mockResolvedValue({
      practiceManagedQuestionnaires: [
        { id: 'q-banana', title: 'Banana Form', status: 'active' },
        { id: 'q-apple', title: 'Apple Form', status: 'active' },
        { id: 'q-retired', title: 'Retired Form', status: 'retired' },
      ],
    });

    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New flow' }));

    expect(getDialog()).toHaveAttribute('data-form-options', 'consent,q-apple,q-banana');
  });

  it('builds service options from BOOKING_CONFIG categories not already admin-managed, plus admin service categories', async () => {
    mockListServiceCategories.mockResolvedValue({
      serviceCategories: [{ id: 'admin-1', code: 'pediatrics', name: 'Pediatrics Admin', active: true, config: {} }],
    });

    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'New flow' }));

    // 'pediatrics' is admin-managed, so it's excluded from the BOOKING_CONFIG-derived options;
    // only 'urgent-care' (booking-config-only) and 'admin-1' (admin-managed) should remain.
    expect(getDialog()).toHaveAttribute('data-service-options', 'urgent-care,admin-1');
  });

  it('does nothing when delete is not confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Standard Intake'));
    expect(mockDeletePaperworkFlow).not.toHaveBeenCalled();
  });

  it('deletes the flow, shows a success toast, and refreshes the list when confirmed', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockListPaperworkFlows
      .mockResolvedValueOnce({ flows: [flowFixture()], ottehrManagedQuestionnaires: [] })
      .mockResolvedValueOnce({ flows: [], ottehrManagedQuestionnaires: [] });
    mockDeletePaperworkFlow.mockResolvedValue(undefined);

    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(mockDeletePaperworkFlow).toHaveBeenCalledWith(mockOystehrZambda, { flowId: 'flow-1' }));
    expect(enqueueSnackbar).toHaveBeenCalledWith('Flow deleted', { variant: 'success' });
    await waitFor(() => expect(screen.queryByText('Standard Intake')).not.toBeInTheDocument());
    expect(screen.getByText(/No paperwork flows yet/i)).toBeInTheDocument();
  });

  it('shows an error toast when the delete request fails', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockDeletePaperworkFlow.mockRejectedValue(new Error('boom'));

    const user = userEvent.setup();
    render(<PaperworkFlowsAdminPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Standard Intake')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Could not delete flow: boom', { variant: 'error' })
    );
    expect(screen.getByText('Standard Intake')).toBeInTheDocument();
  });
});

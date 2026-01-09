import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { GetChartDataResponse, ProcedureDTO, TelemedAppointmentStatusEnum } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dataTestIds } from '../../src/constants/data-test-ids';
import Procedures from '../../src/features/visits/in-person/pages/Procedures';

// Mock PageTitle to avoid theme issues
vi.mock('../../src/features/visits/shared/components/PageTitle', () => ({
  PageTitle: ({ label, dataTestId }: any) => <h1 data-testid={dataTestId}>{label}</h1>,
}));

// Mock the hooks and stores
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useChartData: vi.fn(),
  useDeleteChartData: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/stores/contexts/useAppFlags', () => ({
  useAppFlags: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
    useParams: vi.fn(),
  };
});

// Mock notistack
vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

import { enqueueSnackbar } from 'notistack';
import { useNavigate, useParams } from 'react-router-dom';
import { useGetAppointmentAccessibility } from '../../src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import {
  useChartData,
  useDeleteChartData,
} from '../../src/features/visits/shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../src/features/visits/shared/stores/contexts/useAppFlags';

const mockUseChartData = vi.mocked(useChartData);
const mockUseDeleteChartData = vi.mocked(useDeleteChartData);
const mockUseGetAppointmentAccessibility = vi.mocked(useGetAppointmentAccessibility);
const mockUseAppFlags = vi.mocked(useAppFlags);
const mockNavigate = vi.mocked(useNavigate);
const mockUseParams = vi.mocked(useParams);
const mockEnqueueSnackbar = vi.mocked(enqueueSnackbar);

describe('Procedures - Delete Procedure Tests', () => {
  const mockMutateAsync = vi.fn();
  const mockRefetch = vi.fn();

  // Backend filters out deleted procedures (status=entered-in-error)
  // So mockProcedures should only contain active/completed procedures
  const mockProcedures: ProcedureDTO[] = [
    {
      resourceId: 'proc1',
      procedureType: 'Colonoscopy',
      procedureDateTime: '2024-12-20T10:00:00Z',
      cptCodes: [{ code: '45378', display: 'Diagnostic colonoscopy' }],
    },
    {
      resourceId: 'proc2',
      procedureType: 'Endoscopy',
      procedureDateTime: '2024-12-19T14:30:00Z',
      cptCodes: [{ code: '43239', display: 'Upper gastrointestinal endoscopy' }],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    const chartData: Partial<GetChartDataResponse> = {
      procedures: mockProcedures,
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      isChartDataLoading: false,
      chartData: chartData as GetChartDataResponse,
      refetch: mockRefetch,
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    mockUseDeleteChartData.mockReturnValue({
      mutateAsync: mockMutateAsync,
      data: undefined,
      error: null,
      isError: false,
      isIdle: true,
      isPending: false,
      isSuccess: false,
      failureCount: 0,
      failureReason: null,
      isPaused: false,
      status: 'idle',
      variables: undefined,
      submittedAt: 0,
      mutate: vi.fn(),
      reset: vi.fn(),
      context: undefined,
    });

    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: false,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
      isStatusEditable: true,
      isCurrentUserHasAccessToAppointment: true,
      status: TelemedAppointmentStatusEnum.ready,
      isAppointmentLocked: false,
      visitType: 'main',
    });

    mockUseAppFlags.mockReturnValue({
      isInPerson: true,
    });

    mockNavigate.mockReturnValue(vi.fn());
    mockUseParams.mockReturnValue({ id: 'appointment123' });
  });

  const renderComponent = (): ReturnType<typeof render> => {
    return render(
      <BrowserRouter>
        <Procedures />
      </BrowserRouter>
    );
  };

  it('displays active procedures (backend filters deleted ones)', () => {
    renderComponent();

    // Check that active procedures are displayed (backend already filtered deleted ones)
    expect(screen.getByText('Colonoscopy')).toBeInTheDocument();
    expect(screen.getByText('Endoscopy')).toBeInTheDocument();
  });

  it('shows delete buttons for procedures when not read-only', () => {
    renderComponent();

    // Check that delete buttons are present for active procedures
    const deleteButtons = screen.getAllByRole('button').filter(
      (button) => button.querySelector('svg') // Delete icon buttons
    );
    expect(deleteButtons.length).toBeGreaterThan(0);
  });

  it('does not show delete buttons when chart is read-only', () => {
    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: true,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
      isStatusEditable: false,
      isCurrentUserHasAccessToAppointment: true,
      status: undefined,
      isAppointmentLocked: false,
      visitType: 'main',
    });

    renderComponent();

    // Check that delete icons are not present
    const deleteIcons = screen.queryAllByTestId('DeleteOutlinedIcon');
    expect(deleteIcons.length).toBe(0);
  });

  it('shows confirmation dialog when delete button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Find delete icon button - using testid for DeleteIcon
    const deleteIcons = screen.getAllByTestId('DeleteOutlinedIcon');
    const deleteButton = deleteIcons[0].closest('button');
    expect(deleteButton).toBeInTheDocument();

    await user.click(deleteButton!);

    // Check that confirmation dialog appears
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Procedure' })).toBeInTheDocument();
    });
    expect(screen.getByText(/Are you sure you want to delete this procedure/i)).toBeInTheDocument();
  });

  it('deletes procedure successfully when confirmed', async () => {
    const user = userEvent.setup();
    mockMutateAsync.mockResolvedValueOnce(undefined);
    mockRefetch.mockResolvedValueOnce(undefined);

    renderComponent();

    // Open delete dialog
    const deleteIcons = screen.getAllByTestId('DeleteOutlinedIcon');
    const deleteButton = deleteIcons[0].closest('button');
    await user.click(deleteButton!);

    // Wait for dialog to appear and confirm deletion
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Procedure' })).toBeInTheDocument();
    });

    const deleteConfirmButton = screen.getByRole('button', { name: 'Delete Procedure' });
    await user.click(deleteConfirmButton);

    // Verify the API was called with correct data
    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalled();
    });

    // Extract and call the onSuccess callback
    const call = mockMutateAsync.mock.calls[0];
    expect(call[0]).toEqual({ procedures: [mockProcedures[0]] });
    expect(call[1]).toMatchObject({
      onSuccess: expect.any(Function),
      onError: expect.any(Function),
    });

    // Call the onSuccess callback to trigger the snackbar
    await call[1].onSuccess();

    // Verify success message
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Procedure deleted successfully', { variant: 'success' });
    });

    // Verify data was refetched
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('shows error message when deletion fails', async () => {
    const user = userEvent.setup();
    const error = new Error('Network error');
    mockMutateAsync.mockRejectedValueOnce(error);

    renderComponent();

    // Open delete dialog
    const deleteIcons = screen.getAllByTestId('DeleteOutlinedIcon');
    const deleteButton = deleteIcons[0].closest('button');
    await user.click(deleteButton!);

    // Wait for dialog and confirm deletion
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Procedure' })).toBeInTheDocument();
    });

    const deleteConfirmButton = screen.getByRole('button', { name: 'Delete Procedure' });
    await user.click(deleteConfirmButton);

    // Verify error message
    await waitFor(() => {
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Failed to delete procedure. Please try again.', {
        variant: 'error',
      });
    });
  });

  it('closes dialog when Keep button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    // Open delete dialog
    const deleteIcons = screen.getAllByTestId('DeleteOutlinedIcon');
    const deleteButton = deleteIcons[0].closest('button');
    await user.click(deleteButton!);

    // Wait for dialog and click Keep button
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Delete Procedure' })).toBeInTheDocument();
    });

    const keepButton = screen.getByText('Keep');
    await user.click(keepButton);

    // Verify dialog is closed
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete Procedure' })).not.toBeInTheDocument();
    });

    // Verify API was not called
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it('navigates to new procedure page when Add button is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigateFn = vi.fn();
    mockNavigate.mockReturnValue(mockNavigateFn);

    renderComponent();

    const addButton = screen.getByRole('button', { name: /Procedure/i });
    await user.click(addButton);

    expect(mockNavigateFn).toHaveBeenCalledWith('/in-person/appointment123/procedures/new');
  });

  it('navigates to procedure details when procedure row is clicked', async () => {
    const user = userEvent.setup();
    const mockNavigateFn = vi.fn();
    mockNavigate.mockReturnValue(mockNavigateFn);

    renderComponent();

    // Click on a procedure row
    const procedureRow = screen.getByText('Colonoscopy').closest('tr');
    await user.click(procedureRow!);

    expect(mockNavigateFn).toHaveBeenCalledWith('/in-person/appointment123/procedures/proc1');
  });

  it('shows loading state when chart data is loading', () => {
    mockUseChartData.mockReturnValue({
      isChartDataLoading: true,
      chartData: { procedures: [] } as unknown as GetChartDataResponse,
      refetch: mockRefetch,
      isLoading: true,
      isFetching: true,
      isPending: true,
      error: null,
      queryKey: [],
      isFetched: false,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    renderComponent();

    // When loading, component shows Loader instead of page content
    // Title should not be present during loading
    expect(screen.queryByTestId(dataTestIds.proceduresPage.title)).not.toBeInTheDocument();
  });

  it('shows empty state when no procedures are available', () => {
    const emptyChartData: Partial<GetChartDataResponse> = {
      procedures: [],
      patientId: 'patient123',
    };

    mockUseChartData.mockReturnValue({
      isChartDataLoading: false,
      chartData: emptyChartData as GetChartDataResponse,
      refetch: mockRefetch,
      isLoading: false,
      isFetching: false,
      isPending: false,
      error: null,
      queryKey: [],
      isFetched: true,
      setPartialChartData: vi.fn(),
      updateObservation: vi.fn(),
      chartDataSetState: vi.fn(),
      chartDataRefetch: vi.fn(),
      chartDataError: null,
    });

    renderComponent();

    // Should show some indication of no procedures
    expect(screen.getByTestId(dataTestIds.proceduresPage.title)).toBeInTheDocument();
  });

  it('disables Add button when chart is read-only', () => {
    mockUseGetAppointmentAccessibility.mockReturnValue({
      isAppointmentReadOnly: true,
      isPractitionerLicensedInState: true,
      isEncounterAssignedToCurrentPractitioner: true,
      isStatusEditable: false,
      isCurrentUserHasAccessToAppointment: true,
      status: undefined,
      isAppointmentLocked: false,
      visitType: 'main',
    });

    renderComponent();

    const addButton = screen.getByRole('button', { name: /Procedure/i });
    expect(addButton).toBeDisabled();
  });
});

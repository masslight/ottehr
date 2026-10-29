import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { GetErxRequestResponse } from 'utils/lib/types/api/erx.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RefillRequestDialog } from '../../src/features/visits/in-person/components/erx/RefillRequestDialog';

const PHARMACY = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};

const mocks = vi.hoisted(() => ({
  getErxRequest: vi.fn(),
  respondToRenewal: vi.fn(),
  orderPrescription: vi.fn(),
  completeTask: vi.fn(),
  chartSectionOptions: [] as unknown[],
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({
  getErxRequest: mocks.getErxRequest,
  respondToRenewal: mocks.respondToRenewal,
  createPrescriptionQuickPick: vi.fn(),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));
vi.mock('src/hooks/useAuthToken', () => ({ useAuthToken: () => 'user-token' }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ profileResource: { id: 'practitioner-1' }, hasRole: () => false }),
}));
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedPrescriptionQuickPicks: () => ({ quickPicks: [], refetch: vi.fn() }),
  useMergedPrescriptionSetQuickPicks: () => ({ quickPicks: [] }),
}));
vi.mock('../../src/features/visits/in-person/hooks/useTasks', () => ({
  GET_TASKS_KEY: 'get-tasks',
  useCompleteErxTask: () => ({ mutateAsync: mocks.completeTask }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: { diagnosis: [] }, setPartialChartData: vi.fn() }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: (_section: string, options: unknown) => {
    mocks.chartSectionOptions.push(options);
    return { data: { preferredPharmacies: [{ name: PHARMACY.name, primary: true }] }, refetch: vi.fn() };
  },
}));
vi.mock('../../src/features/visits/shared/hooks/useErxPharmacies', () => ({
  usePreferredPharmacy: () => ({ data: PHARMACY }),
}));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [], isFetching: false, isError: false }),
}));
// The original visit is signed: the lock doesn't apply to a refill request.
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: true }),
}));
vi.mock('../../src/features/visits/shared/hooks/useOrderPrescription', () => ({
  useOrderPrescription: () => ({ mutateAsync: mocks.orderPrescription }),
}));
// No visit page: the Tasks page.
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({}),
  useSaveChartData: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: ({ encounterId }: { encounterId?: string }) => <div>Allergies of {encounterId}</div>,
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicationsContainer', () => ({
  MedicationsContainer: () => null,
}));
vi.mock('../../src/features/visits/in-person/components/erx/useVisitWeight', () => ({
  useVisitWeight: () => undefined,
  useVisitHeight: () => undefined,
}));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const PRESCRIPTION: GetErxRequestResponse['prescription'] = {
  resourceId: 'rx-1',
  name: 'Lisinopril 10 mg tablet',
  instructions: 'Take 1 tablet by mouth once daily',
  encounterId: 'encounter-9',
  sent: '2026-09-14T15:00:00.000Z',
  order: {
    ndc: '00093111101',
    medicationDescription: 'Lisinopril 10 mg tablet',
    quantityValue: 30,
    quantityUnit: 'Tablet',
    daysSupply: 30,
    numberOfRefills: 1,
    substitutionAllowed: true,
    diagnosisCode: 'I10',
    diagnosisDescription: 'Essential hypertension',
  },
};
const PATIENT: GetErxRequestResponse['patient'] = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Maria'], family: 'Lopez' }],
};
const PHARMACY_REQUEST: GetErxRequestResponse = {
  taskId: 'task-1',
  pharmacyRequest: {
    renewalTaskId: 'renewal-1',
    pharmacy: { name: 'CVS Pharmacy #7741', ncpdpId: '0000001', npi: '1234567890', phone: '5125550142' },
    medication: {
      description: 'Lisinopril 10 mg tablet',
      ndc: '00093111101',
      quantityValue: 90,
      quantityUnit: 'Tablet',
      sig: 'Take 1 tablet by mouth once daily',
      substitutionAllowed: true,
      requestedRefills: 3,
    },
    received: '2026-10-27T16:12:00.000Z',
    withdrawn: false,
    closed: false,
  },
  prescription: PRESCRIPTION,
  patient: PATIENT,
};

const open = async (request: GetErxRequestResponse): Promise<ReturnType<typeof userEvent.setup>> => {
  mocks.getErxRequest.mockResolvedValue(request);
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RefillRequestDialog taskId="task-1" onClose={vi.fn()} />
    </QueryClientProvider>
  );
  await screen.findByText(/^Original prescription/);
  return userEvent.setup();
};

describe('Refill request dialog: the order form outside a visit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chartSectionOptions = [];
    mocks.respondToRenewal.mockResolvedValue({
      taskId: 'renewal-1',
      messageId: 'm',
      responseType: 'Replace',
      status: {},
    });
    mocks.orderPrescription.mockResolvedValue({});
    mocks.completeTask.mockResolvedValue(undefined);
  });

  it('Change and approve answers the pharmacy with the prescription as the form holds it', async () => {
    const user = await open(PHARMACY_REQUEST);
    await user.click(screen.getByRole('button', { name: 'Change and approve' }));
    // The original's visit, though signed and not the page's.
    expect(screen.getByText('Allergies of encounter-9')).toBeInTheDocument();
    expect(mocks.chartSectionOptions).toContainEqual({ encounterId: 'encounter-9' });
    expect(screen.queryByRole('button', { name: /Add another prescription/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 'task-1' }));
    expect(mocks.orderPrescription).not.toHaveBeenCalled();
    expect(mocks.respondToRenewal).toHaveBeenCalledWith('user-token', {
      taskId: 'renewal-1',
      decision: 'approve',
      // 3 fills asked: written as 2 refills, sent as 3 fills.
      numberOfRefills: 3,
      changes: {
        medicationDescription: 'Lisinopril 10 mg tablet',
        ndc: '00093111101',
        quantityValue: 90,
        quantityUnit: 'Tablet',
        // Left out by the pharmacy: the original's.
        daysSupply: 30,
        substitutionAllowed: true,
        patientInstructions: 'Take 1 tablet by mouth once daily',
      },
    });
    expect(await screen.findByText('Approved with your changes. Sent to CVS Pharmacy #7741.')).toBeInTheDocument();
  });

  it('shows a failed Change and approve like other send errors, and leaves the task open', async () => {
    mocks.respondToRenewal.mockRejectedValue(new Error('Amoxicillin is no longer available. Pick it again.'));
    const user = await open(PHARMACY_REQUEST);
    await user.click(screen.getByRole('button', { name: 'Change and approve' }));
    await user.click(screen.getByRole('button', { name: 'Send to CVS Pharmacy #7741' }));
    await waitFor(() =>
      expect(enqueueSnackbar).toHaveBeenCalledWith('Amoxicillin is no longer available. Pick it again.', {
        variant: 'error',
      })
    );
    expect(mocks.completeTask).not.toHaveBeenCalled();
  });

  it('answers a patient’s request with a new prescription to the original visit, then completes the task', async () => {
    const user = await open({
      taskId: 'task-1',
      patientRequest: { note: 'Called; out in 2 days.', takenBy: 'Kim Front', taken: '2026-10-28T10:00:00.000Z' },
      prescription: PRESCRIPTION,
      patient: PATIENT,
    });
    expect(screen.getByText('Called; out in 2 days.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Deny' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send prescription' }));
    await waitFor(() => expect(mocks.completeTask).toHaveBeenCalledWith({ taskId: 'task-1' }));
    expect(mocks.orderPrescription).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: 'patient-1',
        encounterId: 'encounter-9',
        ndc: '00093111101',
        quantityValue: 30,
        numberOfRefills: 1,
        pharmacyId: PHARMACY.ncpdpId,
        diagnosisCode: 'I10',
      })
    );
    expect(mocks.respondToRenewal).not.toHaveBeenCalled();
    expect(await screen.findByText('New prescription sent.')).toBeInTheDocument();
  });
});

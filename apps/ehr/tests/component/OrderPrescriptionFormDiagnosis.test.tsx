import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPrescriptionForm } from '../../src/features/visits/in-person/components/erx/OrderPrescriptionForm';
import { detailed } from './helpers/erxProducts';

const STREP = { code: 'J02.0', display: 'Streptococcal pharyngitis' };
const PHARMACY = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};
const AMOX_STREP: PrescriptionQuickPickData = {
  id: 'qp-strep',
  name: 'Amox strep',
  ...detailed({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' }),
  medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
  quantityValue: 100,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  numberOfRefills: 0,
  patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
  diagnosis: STREP,
};

const mocks = vi.hoisted(() => ({
  orderPrescription: vi.fn(),
  saveChartData: vi.fn(),
  setPartialChartData: vi.fn(),
  chartDiagnoses: [] as { code: string; display: string; isPrimary?: boolean }[],
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ createPrescriptionQuickPick: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ profileResource: { id: 'practitioner-1' }, hasRole: () => false }),
}));
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedPrescriptionQuickPicks: () => ({ quickPicks: [AMOX_STREP], refetch: vi.fn() }),
  useMergedPrescriptionSetQuickPicks: () => ({ quickPicks: [] }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({
    chartData: { diagnosis: mocks.chartDiagnoses },
    setPartialChartData: mocks.setPartialChartData,
  }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: () => ({
    data: { preferredPharmacies: [{ name: PHARMACY.name, primary: true }] },
    refetch: vi.fn(),
  }),
}));
// The saved pharmacy matches the directory.
vi.mock('../../src/features/visits/shared/hooks/useErxPharmacies', () => ({
  usePreferredPharmacy: () => ({ data: PHARMACY }),
}));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [], isFetching: false, isError: false }),
}));
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('../../src/features/visits/shared/hooks/useOrderPrescription', () => ({
  useOrderPrescription: () => ({ mutateAsync: mocks.orderPrescription }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    patient: { resourceType: 'Patient', id: 'patient-1' },
    encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' },
  }),
  useSaveChartData: () => ({ mutateAsync: mocks.saveChartData }),
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: () => null,
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicationsContainer', () => ({
  MedicationsContainer: () => null,
}));
vi.mock('../../src/features/visits/in-person/components/erx/useVisitWeight', () => ({
  useVisitWeight: () => undefined,
}));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const sendQuickPick = async (): Promise<void> => {
  const user = userEvent.setup();
  render(<OrderPrescriptionForm />);
  await user.click(screen.getByRole('button', { name: /^medication/ }));
  await user.click(
    within(screen.getByRole('listbox', { name: 'Prescription sets and quick picks' })).getByText('Amox strep')
  );
  await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
  await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
};

describe('Order prescription form: a quick pick’s diagnosis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.chartDiagnoses = [];
    mocks.orderPrescription.mockResolvedValue({});
    mocks.saveChartData.mockResolvedValue({ chartData: { diagnosis: [] } });
  });

  it('goes with the prescription and is added to a visit without it, as its primary diagnosis', async () => {
    await sendQuickPick();
    expect(mocks.orderPrescription.mock.calls[0][0]).toMatchObject({
      diagnosisCode: STREP.code,
      diagnosisDescription: STREP.display,
    });
    await waitFor(() => expect(mocks.saveChartData).toHaveBeenCalledTimes(1));
    expect(mocks.saveChartData).toHaveBeenCalledWith({ diagnosis: [{ ...STREP, isPrimary: true }] });
  });

  it('is added after the visit’s own diagnoses, not as the primary one', async () => {
    mocks.chartDiagnoses = [{ code: 'R50.9', display: 'Fever, unspecified', isPrimary: true }];
    await sendQuickPick();
    await waitFor(() => expect(mocks.saveChartData).toHaveBeenCalledTimes(1));
    expect(mocks.saveChartData).toHaveBeenCalledWith({ diagnosis: [{ ...STREP, isPrimary: false }] });
  });

  it('is not added again when the visit already has it', async () => {
    mocks.chartDiagnoses = [{ ...STREP, isPrimary: true }];
    await sendQuickPick();
    await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
    expect(mocks.saveChartData).not.toHaveBeenCalled();
  });
});

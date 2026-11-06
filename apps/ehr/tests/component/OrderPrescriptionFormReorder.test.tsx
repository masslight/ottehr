import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ErxDirectoryPharmacy } from 'utils/lib/types/api/erx-search.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPrescriptionForm } from '../../src/features/visits/in-person/components/erx/OrderPrescriptionForm';
import { reorderPrescription } from '../../src/features/visits/in-person/components/erx/reorderPrescription.store';

const PREFERRED = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};
const ORIGINAL_PHARMACY: ErxDirectoryPharmacy = {
  ncpdpId: '0000031',
  npi: '1245319599',
  name: 'Sample Pharmacy Two',
  phone: '5125550123',
  address1: '456 Oak Ave',
  city: 'Washington',
  state: 'DC',
  zipCode: '20001',
} as ErxDirectoryPharmacy;
// A sent prescription with no stored directions blanks (as one sent through DoseSpot): its sig comes back as text.
const SENT: PrescribedMedicationDTO = {
  resourceId: 'mr-amox',
  name: 'Amoxicillin 400 mg/5ml Susp',
  status: 'active',
  instructions: 'Take 5 mL by mouth twice daily for 10 days.',
  pharmacyId: ORIGINAL_PHARMACY.ncpdpId,
  encounterId: 'encounter-1',
  order: {
    patientId: 'patient-1',
    ndc: '00093416173',
    medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
    quantityValue: 100,
    quantityUnit: 'Milliliter',
    daysSupply: 10,
    numberOfRefills: 1,
    substitutionAllowed: true,
    noteToPharmacy: 'Shake well',
    diagnosisCode: 'J02.0',
    diagnosisDescription: 'Streptococcal pharyngitis',
  },
};

const mocks = vi.hoisted(() => ({
  orderPrescription: vi.fn(),
  directoryRow: undefined as ErxDirectoryPharmacy | undefined,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ createPrescriptionQuickPick: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ profileResource: { id: 'practitioner-1' }, hasRole: () => false }),
}));
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedPrescriptionQuickPicks: () => ({ quickPicks: [], refetch: vi.fn() }),
  useMergedPrescriptionSetQuickPicks: () => ({ quickPicks: [] }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({
    chartData: { diagnosis: [{ code: 'J02.0', display: 'Streptococcal pharyngitis', isPrimary: true }] },
    setPartialChartData: vi.fn(),
  }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartSection', () => ({
  useChartSection: () => ({
    data: { preferredPharmacies: [{ name: PREFERRED.name, primary: true }], prescribedMedications: [] },
    refetch: vi.fn(),
  }),
}));
// The saved pharmacy matches the directory; the original's NCPDP ID finds its row, or none when it's gone.
vi.mock('../../src/features/visits/shared/hooks/useErxPharmacies', () => ({
  usePreferredPharmacy: () => ({ data: PREFERRED }),
  usePharmaciesByNcpdpId: (ncpdpIds: string[]) =>
    ncpdpIds.map((ncpdpId) => ({ ncpdpId, row: mocks.directoryRow, status: 'success' })),
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
  useSaveChartData: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: () => null,
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

const reorderAndSend = async (): Promise<void> => {
  const user = userEvent.setup();
  render(<OrderPrescriptionForm />);
  act(() => reorderPrescription(SENT));
  await user.click(await screen.findByRole('button', { name: 'Send Prescription' }));
  await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
};

describe('Order prescription form: Reorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.directoryRow = ORIGINAL_PHARMACY;
    mocks.orderPrescription.mockResolvedValue({});
  });

  it('fills the empty line with the prescription as sent, to its pharmacy', async () => {
    await reorderAndSend();
    expect(mocks.orderPrescription.mock.calls[0][0]).toMatchObject({
      ndc: '00093416173',
      medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
      quantityValue: 100,
      quantityUnit: 'Milliliter',
      daysSupply: 10,
      numberOfRefills: 1,
      substitutionAllowed: true,
      patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
      noteToPharmacy: 'Shake well',
      diagnosisCode: 'J02.0',
      pharmacyId: ORIGINAL_PHARMACY.ncpdpId,
      pharmacyName: ORIGINAL_PHARMACY.name,
    });
  });

  it('keeps the form’s pharmacy and warns when the original no longer takes e-prescriptions', async () => {
    mocks.directoryRow = undefined;
    await reorderAndSend();
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      "The original pharmacy can't take e-prescriptions now. Pick another pharmacy.",
      { variant: 'warning' }
    );
    expect(mocks.orderPrescription.mock.calls[0][0]).toMatchObject({ pharmacyId: PREFERRED.ncpdpId });
  });
});

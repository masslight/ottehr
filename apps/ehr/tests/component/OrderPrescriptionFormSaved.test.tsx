import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { enqueueSnackbar } from 'notistack';
import { PrescribedMedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ErxSavedForm, erxSavedFormIsEmpty, ErxSavedFormResponse } from 'utils/lib/types/api/erx.types';
import { ErxDirectoryPharmacy } from 'utils/lib/types/api/erx-search.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPrescriptionForm } from '../../src/features/visits/in-person/components/erx/OrderPrescriptionForm';
import { PrescriptionLine } from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { refillLine } from '../../src/features/visits/in-person/components/erx/refillRequest';
import { reorderPrescription } from '../../src/features/visits/in-person/components/erx/reorderPrescription.store';

const PREFERRED = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};
const PICKED = { ...PREFERRED, ncpdpId: '0000031', name: 'Sample Pharmacy Two' };
const sentPrescription = (name: string, ndc: string): PrescribedMedicationDTO => ({
  name,
  status: 'active',
  instructions: 'Take 5 mL by mouth twice daily for 10 days.',
  order: {
    patientId: 'patient-1',
    ndc,
    medicationDescription: name,
    quantityValue: 100,
    quantityUnit: 'Milliliter',
    daysSupply: 10,
    numberOfRefills: 0,
    substitutionAllowed: true,
  },
});
// Two finished lines, as a medical assistant saved them.
const AMOXICILLIN = refillLine(sentPrescription('Amoxicillin 400 mg/5ml Susp', '00093416173'));
const CEPHALEXIN = refillLine(sentPrescription('Cephalexin 250 mg/5ml Susp', '00093406373'));
const savedWith = (
  lines: PrescriptionLine[],
  pharmacy: typeof PICKED | null = PICKED
): ErxSavedFormResponse['saved'] => ({
  form: { pharmacy, lines: lines as unknown as ErxSavedForm['lines'] },
  savedBy: 'Jamie Rivera',
  savedAt: '2026-11-18T17:31:00Z',
});

const mocks = vi.hoisted(() => ({
  orderPrescription: vi.fn(),
  directoryRow: undefined as ErxDirectoryPharmacy | undefined,
  roles: [] as string[],
  loading: false,
  failed: undefined as string | undefined,
  readOnly: false,
  preferred: undefined as typeof PREFERRED | undefined,
  refetchQuickPicks: vi.fn(),
  refetchSets: vi.fn(),
  drugs: [] as unknown[],
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('src/api/api', () => ({ createPrescriptionQuickPick: vi.fn() }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));
vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({
    profileResource: { id: 'practitioner-1' },
    hasRole: (roles: string[]) => roles.some((role) => mocks.roles.includes(role)),
  }),
}));
vi.mock('src/hooks/useMergedQuickPicks', () => ({
  useMergedPrescriptionQuickPicks: () => ({ quickPicks: [], refetch: mocks.refetchQuickPicks }),
  useMergedPrescriptionSetQuickPicks: () => ({ quickPicks: [], refetch: mocks.refetchSets }),
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
  usePreferredPharmacy: () => ({ data: mocks.preferred }),
  usePharmaciesByNcpdpId: (ncpdpIds: string[]) =>
    ncpdpIds.map((ncpdpId) => ({ ncpdpId, row: mocks.directoryRow, status: 'success' })),
}));
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: mocks.drugs, isFetching: false, isError: false }),
}));
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: mocks.readOnly }),
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
  useVisitAllergies: () => undefined,
  useErxSendDataLoading: () => mocks.loading,
  useErxSendDataFailed: () => mocks.failed,
}));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

const onSaveForm = vi.fn<(form: ErxSavedForm) => Promise<ErxSavedFormResponse>>();
const savedForm = (): ErxSavedForm => onSaveForm.mock.calls.at(-1)![0];

describe('Order prescription form: saving for the provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.orderPrescription.mockResolvedValue({});
    mocks.roles = [];
    mocks.loading = false;
    mocks.failed = undefined;
    mocks.readOnly = false;
    mocks.preferred = PREFERRED;
    mocks.drugs = [];
    onSaveForm.mockImplementation(async (form) => ({
      // As the server: an empty form removes the saved one.
      saved: erxSavedFormIsEmpty(form) ? null : { form, savedBy: 'Jamie Rivera', savedAt: 'now' },
    }));
  });

  // 53a: staff not enrolled with Surescripts save the form; only an enrolled prescriber sends it.
  it('lets someone not enrolled save, and says why the send button is off', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm notEnrolled onSaveForm={onSaveForm} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    const send = screen.getByRole('button', { name: 'Send Prescription' });
    expect(send).toBeDisabled();
    await user.hover(send.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Only an enrolled prescriber can send');
  });

  it('has no Save without a saved form to save to, as in a pharmacy request', () => {
    render(<OrderPrescriptionForm />);
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('says why Save is off on a signed visit', async () => {
    mocks.readOnly = true;
    const user = userEvent.setup();
    render(<OrderPrescriptionForm onSaveForm={onSaveForm} />);
    const save = screen.getByRole('button', { name: 'Save' });
    expect(save).toBeDisabled();
    await user.hover(save.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('The visit is signed');
  });

  // 53b: opening the page fills the form with the saved one, and says who saved it and when.
  it('opens with the saved lines and pharmacy, and "Saved by …" in local time', () => {
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN, CEPHALEXIN])} onSaveForm={onSaveForm} />);
    expect(screen.getAllByText('Amoxicillin 400 mg/5ml Susp').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cephalexin 250 mg/5ml Susp').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /^pharmacy/ })).toHaveTextContent(PICKED.name);
    expect(screen.getByRole('button', { name: 'Send 2 Prescriptions' })).toBeInTheDocument();
    expect(screen.getByText(/^Saved by Jamie Rivera, \d\d\/\d\d\/2026 \d\d:\d\d [AP]M$/)).toBeInTheDocument();
  });

  // 53c: Save keeps an unfinished form as it is, and shows no problems; they show only on Send.
  it('saves an unfinished form as it is, without showing its problems', async () => {
    const user = userEvent.setup();
    const unfinished = { ...AMOXICILLIN, patientInstructions: '', quantityValue: '' };
    render(<OrderPrescriptionForm notEnrolled saved={savedWith([unfinished], null)} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(savedForm().lines).toHaveLength(1);
    expect(savedForm().lines[0]).toMatchObject({ patientInstructions: '' });
    expect(screen.queryByText(/Enter the directions/)).not.toBeInTheDocument();
    expect(enqueueSnackbar).toHaveBeenCalledWith('Saved', { variant: 'success' });
  });

  it('saves the picked pharmacy and every line, and replaces the saved form', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(savedForm().pharmacy).toEqual(PICKED);
    expect(savedForm().lines).toMatchObject([{ medication: { description: 'Amoxicillin 400 mg/5ml Susp' } }]);
  });

  // 53b: saving an empty form, for example after Clear Form, removes the saved one.
  it('removes the saved form when an empty form is saved after Clear Form', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Clear Form' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(savedForm().pharmacy).toBeNull();
    expect(enqueueSnackbar).toHaveBeenCalledWith('Saved form removed', { variant: 'success' });
  });

  it('saves nothing when the form is empty and nothing was saved', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSaveForm).not.toHaveBeenCalled();
    expect(enqueueSnackbar).toHaveBeenCalledWith('Nothing to save', { variant: 'info' });
  });

  // 53d: each line goes out under whoever sends it; a sent line leaves the saved form, a failed one stays.
  it('takes a sent line out of the saved form and keeps the one that failed', async () => {
    mocks.orderPrescription.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Pharmacy unavailable'));
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN, CEPHALEXIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Send 2 Prescriptions' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(mocks.orderPrescription.mock.calls[0][0]).toMatchObject({ practitionerId: 'practitioner-1' });
    expect(savedForm()).toMatchObject({
      pharmacy: PICKED,
      lines: [{ medication: { description: 'Cephalexin 250 mg/5ml Susp' } }],
    });
  });

  it('removes the saved form once every saved line is sent', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN, CEPHALEXIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Send 2 Prescriptions' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(mocks.orderPrescription).toHaveBeenCalledTimes(2);
    expect(savedForm()).toEqual({ pharmacy: null, lines: [] });
  });

  it('keeps a saved line that left the form unsent, after Clear Form and another line sent', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Clear Form' }));
    act(() =>
      reorderPrescription({ ...sentPrescription('Cephalexin 250 mg/5ml Susp', '00093406373'), pharmacyId: '1' })
    );
    await user.click(await screen.findByRole('button', { name: 'Send Prescription' }));
    await waitFor(() => expect(onSaveForm).toHaveBeenCalledTimes(1));
    expect(savedForm()).toMatchObject({ lines: [{ medication: { description: 'Amoxicillin 400 mg/5ml Susp' } }] });
  });

  it('leaves the saved form alone when nothing was sent', async () => {
    mocks.orderPrescription.mockRejectedValue(new Error('Pharmacy unavailable'));
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([AMOXICILLIN])} onSaveForm={onSaveForm} />);
    await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
    await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
    expect(onSaveForm).not.toHaveBeenCalled();
  });

  // 53e with 48b: a saved controlled drug shows the block at once and can't be sent.
  it("blocks a saved line's controlled drug, from the schedule saved with it", async () => {
    const controlled = {
      ...AMOXICILLIN,
      medication: { ...AMOXICILLIN.medication!, description: 'Methylphenidate 10 mg Tab', schedule: 2 },
    };
    const user = userEvent.setup();
    render(<OrderPrescriptionForm saved={savedWith([controlled])} onSaveForm={onSaveForm} />);
    const error = 'Controlled drug: prescribe it on the eRX page until this page supports controlled drugs.';
    expect(screen.getByText(error)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
    expect(mocks.orderPrescription).not.toHaveBeenCalled();
    expect(within(document.body).getAllByText(/^Controlled drug/).length).toBeGreaterThan(0);
  });
});

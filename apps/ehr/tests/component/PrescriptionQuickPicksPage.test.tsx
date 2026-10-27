import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineToQuickPick,
  quickPickOverwrite,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import {
  emptyPrescriptionQuickPickForm,
  prescriptionQuickPickFromForm,
} from '../../src/features/visits/telemed/components/admin/prescriptionQuickPickForm';
import PrescriptionQuickPicksPage from '../../src/features/visits/telemed/components/admin/PrescriptionQuickPicksPage';

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args) }));

const api = vi.hoisted(() => ({
  getPrescriptionQuickPicks: vi.fn(),
  createPrescriptionQuickPick: vi.fn(),
  updatePrescriptionQuickPick: vi.fn(),
  removeQuickPick: vi.fn(),
}));
vi.mock('src/api/api', async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));

const AMOXICILLIN_DRUG = {
  name: 'Amoxicillin',
  strengths: [
    { strength: '250 mg Cap', ndcs: ['00093310701'] },
    { strength: '400 mg/5ml Susp', ndcs: ['00093416173'] },
  ],
};
vi.mock('src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [AMOXICILLIN_DRUG], isFetching: false, isError: false }),
}));

const BY_WEIGHT: PrescriptionQuickPickData = {
  id: 'qp-1',
  name: 'Amoxicillin otitis',
  ndc: '00093416173',
  medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
  numberOfRefills: 0,
  substitutionAllowed: true,
  dosing: {
    rate: 25,
    basis: 'mg/kg/dose',
    dosesPerDay: 2,
    frequency: 'twice daily',
    durationDays: 10,
    maxPerDoseMg: 500,
  },
  source: { label: 'AAP otitis guideline', url: 'https://example.org/aom' },
};
const AS_WRITTEN: PrescriptionQuickPickData = {
  id: 'qp-2',
  name: 'Amoxicillin caps',
  ndc: '00093310701',
  medicationDescription: 'Amoxicillin 250 mg Cap',
  quantityValue: 30,
  quantityUnit: 'Capsule',
  daysSupply: 10,
  numberOfRefills: 1,
  substitutionAllowed: false,
  patientInstructions: 'Take 1 capsule by mouth three times daily for 10 days.',
};

const renderPage = (): void => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  );
  render(<PrescriptionQuickPicksPage />, { wrapper: Wrapper });
};

const chooseOption = async (user: ReturnType<typeof userEvent.setup>, label: string, option: string): Promise<void> => {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(await screen.findByRole('option', { name: option }));
};

describe('Prescription quick picks admin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPrescriptionQuickPicks.mockResolvedValue({ quickPicks: [BY_WEIGHT, AS_WRITTEN] });
    api.createPrescriptionQuickPick.mockResolvedValue({ quickPick: { id: 'new' } });
    api.updatePrescriptionQuickPick.mockResolvedValue({ quickPick: { id: 'qp-2' } });
    api.removeQuickPick.mockResolvedValue(undefined);
  });

  it('lists each quick pick with its product, dose summary and source', async () => {
    renderPage();
    const row = (await screen.findByText('Amoxicillin otitis')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Amoxicillin 400 mg/5ml Susp')).toBeInTheDocument();
    expect(within(row).getByText('25 mg/kg per dose, twice daily, 10 days, max 500 mg per dose')).toBeInTheDocument();
    expect(within(row).getByRole('link', { name: 'AAP otitis guideline' })).toHaveAttribute(
      'href',
      'https://example.org/aom'
    );
    const written = screen.getByText('Amoxicillin caps').closest('tr') as HTMLElement;
    expect(within(written).getByText(AS_WRITTEN.patientInstructions!)).toBeInTheDocument();
  });

  it('adds a quick pick dosed by weight, with the product from the search and the strength picker', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Amox by weight');
    await user.type(within(dialog).getByRole('combobox', { name: 'Medication' }), 'amox');
    await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
    await chooseOption(user, 'Strength', '400 mg/5ml Susp');
    expect(within(dialog).getByText('Product: Amoxicillin 400 mg/5ml Susp')).toBeInTheDocument();
    await user.click(within(dialog).getByLabelText('By weight or fixed dose'));
    await user.type(within(dialog).getByLabelText(/^Dose\W*$/), '45');
    await chooseOption(user, 'Per', 'mg/kg per day');
    await chooseOption(user, 'Frequency', 'twice daily');
    expect(within(dialog).getByLabelText('Doses a day')).toHaveValue(2);
    await user.type(within(dialog).getByLabelText('Duration (days)'), '10');
    await user.type(within(dialog).getByLabelText('Max per day (mg)'), '4000');
    await user.type(within(dialog).getByLabelText('Source (optional)'), 'AAP');
    await user.type(within(dialog).getByLabelText('Source link (optional)'), 'https://example.org/aap');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.createPrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.createPrescriptionQuickPick.mock.calls[0][1]).toEqual({
      quickPick: {
        name: 'Amox by weight',
        ndc: '00093416173',
        medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
        dosing: {
          rate: 45,
          basis: 'mg/kg/day',
          dosesPerDay: 2,
          frequency: 'twice daily',
          durationDays: 10,
          maxPerDayMg: 4000,
        },
        numberOfRefills: 0,
        substitutionAllowed: true,
        source: { label: 'AAP', url: 'https://example.org/aap' },
      },
    });
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Quick pick created', { variant: 'success' });
  });

  it('edits a quick pick as written, keeping the fields it was saved with', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Product: Amoxicillin 250 mg Cap')).toBeInTheDocument();
    const quantity = within(dialog).getByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '21');
    await user.type(within(dialog).getByLabelText(/^Note to pharmacy/), 'Dispense in original bottle');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    const [, id, quickPick] = api.updatePrescriptionQuickPick.mock.calls[0];
    expect(id).toBe('qp-2');
    expect(quickPick).toEqual({
      name: 'Amoxicillin caps',
      ndc: '00093310701',
      medicationDescription: 'Amoxicillin 250 mg Cap',
      patientInstructions: AS_WRITTEN.patientInstructions,
      quantityValue: 21,
      quantityUnit: 'Capsule',
      daysSupply: 10,
      numberOfRefills: 1,
      substitutionAllowed: false,
      noteToPharmacy: 'Dispense in original bottle',
    });
  });

  it('shows the validation errors and saves nothing; shows the backend’s error when it refuses', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByLabelText('By weight or fixed dose'));
    await chooseOption(user, 'Per', 'mg/kg per day');
    await user.type(within(dialog).getByLabelText('Source link (optional)'), 'http://example.org');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(within(dialog).getByText('Name is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Pick a medication and strength to dose by weight')).toBeInTheDocument();
    expect(within(dialog).getByText('Dose must be greater than 0')).toBeInTheDocument();
    expect(within(dialog).getByText('Doses a day is required for mg/kg per day')).toBeInTheDocument();
    expect(within(dialog).getByText('Link must be an https link')).toBeInTheDocument();
    expect(within(dialog).getByText('Source is required with a link')).toBeInTheDocument();
    expect(api.createPrescriptionQuickPick).not.toHaveBeenCalled();

    await user.click(within(dialog).getByLabelText('As written'));
    await user.clear(within(dialog).getByLabelText('Source link (optional)'));
    await user.type(within(dialog).getByLabelText(/^Name/), 'Something');
    api.createPrescriptionQuickPick.mockRejectedValueOnce({
      output: { message: 'quickPick.ndc: must be an 11-digit NDC' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('quickPick.ndc: must be an 11-digit NDC', { variant: 'error' })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('removes a quick pick only after the confirmation', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin otitis')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Remove'));
    const confirm = await screen.findByRole('dialog');
    expect(within(confirm).getByText('Remove Quick Pick "Amoxicillin otitis"?')).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(api.removeQuickPick).not.toHaveBeenCalled();

    await user.click(within(row).getByTitle('Remove'));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.removeQuickPick).toHaveBeenCalledWith({}, 'qp-1'));
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('Quick pick removed', { variant: 'success' });
  });
});

describe('"+ Add or Update Quick Pick" over an existing quick pick', () => {
  const line: PrescriptionLine = {
    ...emptyPrescriptionLine(),
    medication: { ndc: '00093310701', description: 'Amoxicillin 250 mg Cap' },
    quantityValue: '20',
    quantityUnit: 'Capsule',
    patientInstructions: 'Take 2 capsules by mouth twice daily.',
  };

  it('keeps the existing source and anything else the line doesn’t set; the line’s own fields replace it', () => {
    const saved = quickPickOverwrite(
      { ...BY_WEIGHT, extra: 'kept' } as PrescriptionQuickPickData,
      prescriptionLineToQuickPick(line, 'Amoxicillin otitis')
    );
    expect(saved.source).toEqual(BY_WEIGHT.source);
    expect((saved as Record<string, unknown>).extra).toBe('kept');
    expect(saved).not.toHaveProperty('id');
    // The line has no calculator settings, so the old dosing goes: its directions are the line's now.
    expect(saved.dosing).toBeUndefined();
    expect(saved.ndc).toBe('00093310701');
    expect(saved.quantityValue).toBe(20);
    expect(saved.patientInstructions).toBe('Take 2 capsules by mouth twice daily.');
  });

  it('a new quick pick is the line as it is', () => {
    expect(quickPickOverwrite(undefined, prescriptionLineToQuickPick(line, 'New'))).toEqual(
      prescriptionLineToQuickPick(line, 'New')
    );
  });
});

describe('prescriptionQuickPickFromForm: frequency and doses a day', () => {
  const dosed = {
    ...emptyPrescriptionQuickPickForm(),
    name: 'Amox',
    ndc: '00093416173',
    medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
    doseMode: 'dosing' as const,
    rate: '25',
    basis: 'mg/kg/dose' as const,
  };

  it('takes only the form’s own frequencies, never a key every object has', () => {
    expect(prescriptionQuickPickFromForm({ ...dosed, frequency: 'constructor' }).errors?.frequency).toBe(
      'Pick a frequency'
    );
    expect(prescriptionQuickPickFromForm({ ...dosed, frequency: 'toString' }).errors?.frequency).toBe(
      'Pick a frequency'
    );
  });

  it('wants the doses a day the frequency gives, when it gives a count', () => {
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'twice daily', dosesPerDay: '3' }).errors?.dosesPerDay
    ).toBe('Doses a day must be 2 for twice daily');
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'twice daily', dosesPerDay: '2' }).errors
    ).toBeUndefined();
    // "As needed" gives no count: any doses a day will do.
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'as needed', dosesPerDay: '3' }).errors
    ).toBeUndefined();
  });

  it('wants a count of doses a day for a maximum per day', () => {
    expect(prescriptionQuickPickFromForm({ ...dosed, maxPerDayMg: '1000' }).errors?.maxPerDayMg).toBe(
      'A maximum per day needs the doses a day or a frequency that gives them'
    );
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'as needed', maxPerDayMg: '1000' }).errors?.maxPerDayMg
    ).toBe('A maximum per day needs the doses a day or a frequency that gives them');
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'twice daily', maxPerDayMg: '1000' }).errors
    ).toBeUndefined();
    expect(prescriptionQuickPickFromForm({ ...dosed, dosesPerDay: '2', maxPerDayMg: '1000' }).errors).toBeUndefined();
  });
});

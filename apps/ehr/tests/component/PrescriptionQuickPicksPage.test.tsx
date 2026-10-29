import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionQuickPickForm,
  prescriptionQuickPickFormValues,
  prescriptionQuickPickFromForm,
} from '../../src/features/visits/telemed/components/admin/prescriptionQuickPickForm';
import PrescriptionQuickPicksPage, {
  setsRemovalText,
} from '../../src/features/visits/telemed/components/admin/PrescriptionQuickPicksPage';
import { detailed, ERX_PRODUCT_DETAILS } from './helpers/erxProducts';

const mockEnqueueSnackbar = vi.fn();
vi.mock('notistack', () => ({ enqueueSnackbar: (...args: unknown[]) => mockEnqueueSnackbar(...args) }));

const api = vi.hoisted(() => ({
  getPrescriptionQuickPicks: vi.fn(),
  getPrescriptionSetQuickPicks: vi.fn(),
  createPrescriptionQuickPick: vi.fn(),
  updatePrescriptionQuickPick: vi.fn(),
  removeQuickPick: vi.fn(),
}));
vi.mock('src/api/api', async (importOriginal) => ({ ...(await importOriginal<object>()), ...api }));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {}, oystehr: undefined }) }));

const AMOXICILLIN_DRUG = {
  name: 'Amoxicillin',
  strengths: [
    detailed({ strength: '250 mg Cap', ndcs: ['00093310701'] }),
    detailed({ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }),
  ],
};
vi.mock('src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [AMOXICILLIN_DRUG], isFetching: false, isError: false }),
}));

// The diagnosis field's ICD-10 search is a network call; it answers with one code whatever is typed.
const STREP = { code: 'J02.0', display: 'Streptococcal pharyngitis' };
vi.mock('src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [STREP], isFetching: false }),
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
    api.getPrescriptionSetQuickPicks.mockResolvedValue({ quickPicks: [] });
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
    expect(within(dialog).queryByLabelText('Doses a day')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Duration (days)'), '10');
    await user.type(within(dialog).getByLabelText('Max per day (mg)'), '4000');
    await user.type(within(dialog).getByLabelText(/^Additional instructions/), 'Shake well. Take with food.');
    await user.type(within(dialog).getByLabelText('Source (optional)'), 'AAP');
    await user.type(within(dialog).getByLabelText('Source link (optional)'), 'https://example.org/aap');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.createPrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.createPrescriptionQuickPick.mock.calls[0][1]).toEqual({
      quickPick: {
        name: 'Amox by weight',
        ndc: '00093416173',
        medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
        // The picked strength's details, so the order form needn't read the product's name.
        ...ERX_PRODUCT_DETAILS['00093416173'],
        dosing: {
          rate: 45,
          basis: 'mg/kg/day',
          frequency: 'twice daily',
          durationDays: 10,
          maxPerDayMg: 4000,
        },
        additionalInstructions: 'Shake well. Take with food.',
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
    // Additional instructions are for a dose the order form works out; as written, the directions say it all.
    expect(within(dialog).queryByLabelText(/^Additional instructions/)).not.toBeInTheDocument();
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

  it('saves the diagnosis picked from the ICD-10 search, and lists it', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    await chooseOption(user, 'Diagnosis', 'J02.0 — Streptococcal pharyngitis');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.updatePrescriptionQuickPick.mock.calls[0][2]).toMatchObject({ diagnosis: STREP });
  });

  it('lists a quick pick’s diagnosis as the order form words it, and keeps it when edited', async () => {
    api.getPrescriptionQuickPicks.mockResolvedValue({ quickPicks: [{ ...AS_WRITTEN, diagnosis: STREP }] });
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Streptococcal pharyngitis J02.0')).toBeInTheDocument();
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.updatePrescriptionQuickPick.mock.calls[0][2]).toMatchObject({ diagnosis: STREP });
  });

  it('won’t save a quick pick under another one’s name, trimmed and in any case; its own name stays', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText(/^Name/);
    await user.clear(name);
    await user.type(name, ' amoxicillin OTITIS ');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('A quick pick named "amoxicillin OTITIS" already exists')).toBeInTheDocument();
    expect(api.updatePrescriptionQuickPick).not.toHaveBeenCalled();
    await user.clear(name);
    await user.type(name, 'AMOXICILLIN CAPS');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.updatePrescriptionQuickPick.mock.calls[0][2]).toMatchObject({ name: 'AMOXICILLIN CAPS' });
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
    expect(within(dialog).getByText('Pick a medication and strength')).toBeInTheDocument();
    expect(within(dialog).getByText('Dose must be greater than 0')).toBeInTheDocument();
    expect(within(dialog).getByText('A scheduled frequency is required for mg/kg per day')).toBeInTheDocument();
    expect(within(dialog).getByText('Link must be an https link')).toBeInTheDocument();
    expect(within(dialog).getByText('Source is required with a link')).toBeInTheDocument();
    expect(api.createPrescriptionQuickPick).not.toHaveBeenCalled();

    await user.click(within(dialog).getByLabelText('As written'));
    await user.clear(within(dialog).getByLabelText('Source link (optional)'));
    await user.type(within(dialog).getByLabelText(/^Name/), 'Something');
    // As written needs its product too.
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    expect(within(dialog).getByText('Pick a medication and strength')).toBeInTheDocument();
    expect(api.createPrescriptionQuickPick).not.toHaveBeenCalled();
    await user.type(within(dialog).getByRole('combobox', { name: 'Medication' }), 'amox');
    await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
    await chooseOption(user, 'Strength', '250 mg Cap');
    api.createPrescriptionQuickPick.mockRejectedValueOnce({
      output: { message: 'quickPick.ndc: must be an 11-digit NDC' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));
    await waitFor(() =>
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith('quickPick.ndc: must be an 11-digit NDC', { variant: 'error' })
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('loads a quick pick saved without a product, and asks for one before saving it again', async () => {
    const { ndc: _ndc, medicationDescription: _description, ...noProduct } = AS_WRITTEN;
    api.getPrescriptionQuickPicks.mockResolvedValue({ quickPicks: [noProduct] });
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    expect(within(row).getByText(AS_WRITTEN.patientInstructions!)).toBeInTheDocument();
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Product: none')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Pick a medication and strength')).toBeInTheDocument();
    expect(api.updatePrescriptionQuickPick).not.toHaveBeenCalled();

    await user.type(within(dialog).getByRole('combobox', { name: 'Medication' }), 'amox');
    await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
    await chooseOption(user, 'Strength', '250 mg Cap');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    expect(api.updatePrescriptionQuickPick.mock.calls[0][2]).toMatchObject({
      ndc: '00093310701',
      medicationDescription: 'Amoxicillin 250 mg Cap',
    });
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

  it('names the sets a quick pick is in before removing it, and fetches the sets again after', async () => {
    api.getPrescriptionSetQuickPicks.mockResolvedValue({
      quickPicks: [
        { id: 'set-1', name: 'Ear infection', status: 'Active', memberIds: ['qp-1', 'qp-2'] },
        { id: 'set-2', name: 'Strep throat', status: 'Active', memberIds: ['qp-1'] },
        { id: 'set-3', name: 'Cough', status: 'Active', memberIds: ['qp-2'] },
      ],
    });
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin otitis')).closest('tr') as HTMLElement;
    await waitFor(() => expect(api.getPrescriptionSetQuickPicks).toHaveBeenCalledTimes(1));
    await user.click(within(row).getByTitle('Remove'));
    const confirm = await screen.findByRole('dialog');
    expect(
      within(confirm).getByText(
        "It's in 2 sets: Ear infection, Strep throat. Removing it takes it out of both and makes them Inactive until someone reviews them."
      )
    ).toBeInTheDocument();
    await user.click(within(confirm).getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(api.getPrescriptionSetQuickPicks).toHaveBeenCalledTimes(2));
  });

  it('says nothing about sets for a quick pick in none', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Amoxicillin caps')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Remove'));
    expect(within(await screen.findByRole('dialog')).queryByText(/It's in/)).not.toBeInTheDocument();
  });
});

// Test compound: the NDCs are made up.
const RINSE: PrescriptionQuickPickData = {
  id: 'qp-rinse',
  name: 'Mouth rinse',
  compound: {
    description: 'Amoxicillin rinse',
    ingredients: [
      { description: 'Amoxicillin 400 mg/5ml Susp', ndc: '00093416173', strength: { value: 80, unit: 'mg/mL' } },
      { description: 'Amoxicillin 250 mg Cap', ndc: '00093310701', base: true },
    ],
  },
  quantityValue: 100,
  quantityUnit: 'Milliliter',
  numberOfRefills: 0,
  patientInstructions: 'Swish and spit 5 mL four times daily.',
};

describe('Prescription quick picks admin: compounds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getPrescriptionQuickPicks.mockResolvedValue({ quickPicks: [AS_WRITTEN, RINSE] });
    api.getPrescriptionSetQuickPicks.mockResolvedValue({ quickPicks: [] });
    api.createPrescriptionQuickPick.mockResolvedValue({ quickPick: { id: 'new' } });
    api.updatePrescriptionQuickPick.mockResolvedValue({ quickPick: { id: 'qp-rinse' } });
  });

  it('lists a compound as its name with its ingredients underneath', async () => {
    renderPage();
    const row = (await screen.findByText('Mouth rinse')).closest('tr') as HTMLElement;
    expect(within(row).getByText('Compound: Amoxicillin rinse')).toBeInTheDocument();
    expect(
      within(row).getByText('Amoxicillin 400 mg/5ml Susp 80 mg/mL · Amoxicillin 250 mg Cap base')
    ).toBeInTheDocument();
  });

  it('adds a compound with the order form’s ingredient rows, as written and without substitution', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole('button', { name: 'Add' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/^Name/), 'Rinse');
    await user.click(within(dialog).getByLabelText('Compound'));
    expect(within(dialog).queryByLabelText('By weight or fixed dose')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('Substitution')).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText('Compound name'), 'Amoxicillin rinse');

    await user.click(within(dialog).getByRole('button', { name: 'ingredient 1 (empty)' }));
    await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
    await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
    await user.click(within(dialog).getByRole('button', { name: 'ingredient 1 strength (empty)' }));
    await user.click(screen.getByRole('option', { name: '400 mg/5ml Susp' }));
    await user.type(within(dialog).getByRole('spinbutton', { name: 'ingredient 1 amount' }), '80');
    await user.click(within(dialog).getByRole('button', { name: 'ingredient 1 unit (empty)' }));
    await user.click(screen.getByRole('option', { name: 'mg/mL' }));
    await user.click(within(dialog).getByRole('button', { name: '+ ingredient (empty)' }));
    await user.click(within(dialog).getByRole('button', { name: 'ingredient 2 (empty)' }));
    await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'amox');
    await user.click(await screen.findByRole('option', { name: 'Amoxicillin' }));
    await user.click(within(dialog).getByRole('button', { name: 'ingredient 2 strength (empty)' }));
    await user.click(screen.getByRole('option', { name: '250 mg Cap' }));
    await user.click(within(dialog).getByRole('button', { name: 'ingredient 2 unit (empty)' }));
    await user.click(screen.getByRole('option', { name: /^base/ }));

    await user.type(within(dialog).getByLabelText('Patient instructions'), 'Swish and spit 5 mL four times daily.');
    await user.type(within(dialog).getByLabelText('Quantity'), '100');
    await chooseOption(user, 'Unit', 'Milliliter');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    await waitFor(() => expect(api.createPrescriptionQuickPick).toHaveBeenCalledTimes(1));
    const { id: _id, ...expected } = RINSE;
    expect(api.createPrescriptionQuickPick.mock.calls[0][1]).toEqual({
      quickPick: {
        ...expected,
        name: 'Rinse',
        compound: {
          ...RINSE.compound,
          // With the picked strengths' RxCUIs.
          ingredients: [
            { ...RINSE.compound!.ingredients[0], rxcui: ERX_PRODUCT_DETAILS['00093416173'].rxcui },
            { ...RINSE.compound!.ingredients[1], rxcui: ERX_PRODUCT_DETAILS['00093310701'].rxcui },
          ],
        },
      },
    });
  });

  it('edits a compound, keeping its ingredients, and says what an unfinished one needs', async () => {
    const user = userEvent.setup();
    renderPage();
    const row = (await screen.findByText('Mouth rinse')).closest('tr') as HTMLElement;
    await user.click(within(row).getByTitle('Edit'));
    const dialog = await screen.findByRole('dialog');
    const name = within(dialog).getByLabelText('Compound name');
    expect(name).toHaveValue('Amoxicillin rinse');
    expect(
      within(dialog).getByRole('button', { name: 'ingredient 1: Amoxicillin 400 mg/5ml Susp' })
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'ingredient 2 unit: base' })).toBeInTheDocument();

    await user.clear(name);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(within(dialog).getByText('Enter the compound name')).toBeInTheDocument();
    expect(api.updatePrescriptionQuickPick).not.toHaveBeenCalled();

    await user.type(name, 'Amoxicillin oral rinse');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.updatePrescriptionQuickPick).toHaveBeenCalledTimes(1));
    const [, id, quickPick] = api.updatePrescriptionQuickPick.mock.calls[0];
    expect(id).toBe('qp-rinse');
    const { id: _id, ...saved } = RINSE;
    expect(quickPick).toEqual({ ...saved, compound: { ...RINSE.compound, description: 'Amoxicillin oral rinse' } });
  });
});

describe('setsRemovalText', () => {
  it('words one set, two and more', () => {
    expect(setsRemovalText(['Ear infection'])).toBe(
      "It's in 1 set: Ear infection. Removing it takes it out of the set and makes the set Inactive until someone reviews it."
    );
    expect(setsRemovalText(['A', 'B', 'C'])).toBe(
      "It's in 3 sets: A, B, C. Removing it takes it out of all of them and makes them Inactive until someone reviews them."
    );
    expect(setsRemovalText([])).toBeUndefined();
  });
});

describe('prescriptionQuickPickFromForm: the name', () => {
  const saved = [
    { id: 'qp-1', name: 'Amoxicillin otitis' },
    { id: 'qp-2', name: 'Amoxicillin caps' },
  ];

  it('is another quick pick’s only when no other one has it; the one being edited keeps its own', () => {
    const values = { ...prescriptionQuickPickFormValues(AS_WRITTEN), name: ' amoxicillin OTITIS ' };
    expect(prescriptionQuickPickFromForm(values, saved).errors).toEqual({
      name: 'A quick pick named "amoxicillin OTITIS" already exists',
    });
    expect(prescriptionQuickPickFromForm(values, saved, 'qp-2').errors?.name).toBeDefined();
    expect(prescriptionQuickPickFromForm(values, saved, 'qp-1').errors).toBeUndefined();
    expect(prescriptionQuickPickFromForm({ ...values, name: 'Amox 2' }, saved).errors).toBeUndefined();
  });

  it('is reported with the other fields’ problems', () => {
    const values = { ...prescriptionQuickPickFormValues(AS_WRITTEN), name: 'Amoxicillin caps', ndc: '' };
    expect(prescriptionQuickPickFromForm(values, saved).errors).toMatchObject({
      name: 'A quick pick named "Amoxicillin caps" already exists',
      ndc: 'Pick a medication and strength',
    });
  });
});

describe('prescriptionQuickPickFromForm: the product’s details', () => {
  it('keeps the details a quick pick was saved with, and saves none for one saved before them', () => {
    const saved = {
      name: 'Amox',
      ndc: '00093416173',
      medicationDescription: 'Amoxicillin 400 mg/5ml Susp',
      ...ERX_PRODUCT_DETAILS['00093416173'],
    };
    expect(prescriptionQuickPickFromForm(prescriptionQuickPickFormValues(saved))).toMatchObject({ quickPick: saved });
    const older = { name: 'Amox', ndc: '00093416173', medicationDescription: 'Amoxicillin 400 mg/5ml Susp' };
    const { quickPick: resaved } = prescriptionQuickPickFromForm(prescriptionQuickPickFormValues(older)) as {
      quickPick: object;
    };
    expect(resaved).not.toHaveProperty('doseForm');
    expect(resaved).not.toHaveProperty('ingredients');
  });
});

describe('prescriptionQuickPickFromForm: additional instructions', () => {
  it('keeps them with dosing, up to 500 characters, and drops them as written', () => {
    const saved = { ...BY_WEIGHT, additionalInstructions: 'Shake well.' };
    const values = prescriptionQuickPickFormValues(saved);
    expect(values.additionalInstructions).toBe('Shake well.');
    expect(prescriptionQuickPickFromForm(values)).toMatchObject({
      quickPick: { additionalInstructions: 'Shake well.' },
    });
    const { quickPick } = prescriptionQuickPickFromForm({ ...values, doseMode: 'as-written' }) as { quickPick: object };
    expect(quickPick).not.toHaveProperty('additionalInstructions');
    expect(prescriptionQuickPickFromForm({ ...values, additionalInstructions: 'x'.repeat(501) }).errors).toEqual({
      additionalInstructions: 'Additional instructions must be up to 500 characters',
    });
  });
});

describe('prescriptionQuickPickFromForm: frequency', () => {
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

  it('wants a scheduled frequency for a per-day rate; per dose any frequency, or none, will do', () => {
    const perDay = { ...dosed, basis: 'mg/kg/day' as const };
    for (const frequency of ['', 'as needed', 'as directed', 'per package instructions']) {
      expect(prescriptionQuickPickFromForm({ ...perDay, frequency }).errors?.frequency).toBe(
        'A scheduled frequency is required for mg/kg per day'
      );
      expect(prescriptionQuickPickFromForm({ ...dosed, frequency }).errors).toBeUndefined();
    }
    expect(prescriptionQuickPickFromForm({ ...perDay, frequency: 'twice daily' })).toMatchObject({
      quickPick: { dosing: { rate: 25, basis: 'mg/kg/day', frequency: 'twice daily' } },
    });
  });

  it('wants a scheduled frequency for a maximum per day', () => {
    expect(prescriptionQuickPickFromForm({ ...dosed, maxPerDayMg: '1000' }).errors?.maxPerDayMg).toBe(
      'A maximum per day needs a scheduled frequency'
    );
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'as needed', maxPerDayMg: '1000' }).errors?.maxPerDayMg
    ).toBe('A maximum per day needs a scheduled frequency');
    expect(
      prescriptionQuickPickFromForm({ ...dosed, frequency: 'twice daily', maxPerDayMg: '1000' }).errors
    ).toBeUndefined();
  });

  it('no longer saves an older quick pick’s doses a day when it is edited', () => {
    const older = { ...BY_WEIGHT, dosing: { ...BY_WEIGHT.dosing!, dosesPerDay: 2 } };
    const { quickPick } = prescriptionQuickPickFromForm(prescriptionQuickPickFormValues(older)) as {
      quickPick: PrescriptionQuickPickData;
    };
    expect(quickPick.dosing).not.toHaveProperty('dosesPerDay');
  });
});

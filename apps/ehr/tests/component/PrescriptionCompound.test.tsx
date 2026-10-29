import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderPrescriptionForm } from '../../src/features/visits/in-person/components/erx/OrderPrescriptionForm';
import {
  CompoundIngredientLine,
  emptyCompoundIngredient,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  productOf,
  withCompound,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';

const PHARMACY = {
  ncpdpId: '0002026',
  npi: '1234567893',
  name: 'Sample Pharmacy One',
  phone: '5125559999',
  address: '123 Main St, Washington, DC 20001',
};

// Test products: the NDCs and RxCUIs are made up.
const KETOPROFEN = { name: 'Ketoprofen', strengths: [{ strength: 'Powder', ndcs: ['00000000001'], rxcui: '1001' }] };
const GABAPENTIN = { name: 'Gabapentin', strengths: [{ strength: 'Powder', ndcs: ['00000000002'] }] };
const LIDOCAINE = { name: 'Lidocaine', strengths: [{ strength: '4% Cream', ndcs: ['00000000003'], rxcui: '1003' }] };

const mocks = vi.hoisted(() => ({ orderPrescription: vi.fn() }));

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
  useChartData: () => ({ chartData: { diagnosis: [] }, setPartialChartData: vi.fn() }),
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
// The medication search answers with the test drugs whose name starts with what's typed.
vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: (query: string) => ({
    data:
      query.trim().length < 2
        ? []
        : [KETOPROFEN, GABAPENTIN, LIDOCAINE].filter((drug) =>
            drug.name.toLowerCase().startsWith(query.trim().toLowerCase())
          ),
    isFetching: false,
    isError: false,
  }),
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
  useSaveChartData: () => ({ mutateAsync: vi.fn().mockResolvedValue({ chartData: { diagnosis: [] } }) }),
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

type User = ReturnType<typeof userEvent.setup>;

const medicationsListbox = (): HTMLElement => screen.getByRole('listbox', { name: 'Medications' });

/** Opens the line's medication menu and types into it. */
const openMenu = async (user: User, typed = ''): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: /^medication/ }));
  const field = screen.getByRole('combobox', { name: 'Medication' });
  await user.click(field);
  if (typed) await user.type(field, typed);
  return field;
};

/** Picks an ingredient's drug from its search, then the drug's only strength. */
const pickIngredient = async (user: User, n: number, typed: string, name: string, strength: string): Promise<void> => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^ingredient ${n}( \\(empty\\)|:)`) }));
  const field = screen.getByRole('combobox', { name: 'Medication' });
  await user.clear(field);
  await user.type(field, typed);
  await user.click(await screen.findByRole('option', { name }));
  await user.click(screen.getByRole('button', { name: `ingredient ${n} strength (empty)` }));
  await user.click(screen.getByRole('option', { name: strength }));
};

/** Long text goes in at once: typing it key by key is slow under a full test run. */
const paste = async (user: User, field: HTMLElement, text: string): Promise<void> => {
  await user.click(field);
  await user.paste(text);
};

const pickUnit = async (user: User, label: string, option: string | RegExp): Promise<void> => {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
  await user.click(screen.getByRole('option', { name: option }));
};

describe('Compound prescriptions: starting one from the medication menu', () => {
  it('offers "+ compound" before anything is typed', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    await openMenu(user);
    expect(within(medicationsListbox()).getByText(/Type to search medications or/)).toBeInTheDocument();
    await user.click(within(medicationsListbox()).getByRole('option', { name: '+ compound' }));
    expect(screen.getByRole('textbox', { name: 'compound name' })).toBeInTheDocument();
    expect(screen.getByText('0/105')).toBeInTheDocument();
    // The dosage form is a required blank, as the unit menu's are.
    const form = screen.getByRole('button', { name: 'form (empty)' });
    expect(form).toHaveAttribute('data-needed', 'true');
    await user.click(form);
    const forms = screen.getByRole('listbox', { name: 'Dosage form' });
    expect(within(forms).getAllByRole('option')).toHaveLength(49);
    await user.click(within(forms).getByRole('option', { name: 'Nasal Spray' }));
    expect(screen.getByRole('button', { name: 'form: nasal spray' })).not.toHaveAttribute('data-needed');
    expect(screen.getByRole('button', { name: 'ingredient 1 (empty)' })).toBeInTheDocument();
    // No substitution for a compound.
    expect(screen.queryByRole('button', { name: /^substitution/ })).not.toBeInTheDocument();
  });

  it('offers it after a search with no match, by keyboard, and the first ingredient searches for the text', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    const field = await openMenu(user, 'zzcompound');
    expect(
      await within(medicationsListbox()).findByText(/Nothing found for this search criteria ·/)
    ).toBeInTheDocument();
    await user.keyboard('{ArrowDown}');
    const option = within(medicationsListbox()).getByRole('option', { name: '+ compound' });
    expect(field).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');

    await user.click(screen.getByRole('button', { name: 'ingredient 1 (empty)' }));
    expect(screen.getByRole('combobox', { name: 'Medication' })).toHaveValue('zzcompound');
    expect(await screen.findByRole('option', { name: "use 'zzcompound' as typed ingredient" })).toBeInTheDocument();
  });

  it('offers it as the results’ last row, starting with the first drug found', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    const field = await openMenu(user, 'keto');
    await within(medicationsListbox()).findByRole('option', { name: 'Ketoprofen' });
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const option = within(medicationsListbox()).getByRole('option', { name: '+ compound starting with Ketoprofen' });
    expect(field).toHaveAttribute('aria-activedescendant', option.id);
    await user.keyboard('{Enter}');
    expect(screen.getByRole('button', { name: 'ingredient 1: Ketoprofen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ingredient 1 strength (empty)' })).toBeInTheDocument();
  });
});

describe('Compound prescriptions: ingredients', () => {
  it('takes a typed-in ingredient, which needs "This is not a controlled substance" checked', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    await openMenu(user, 'zzbase');
    await user.click(await within(medicationsListbox()).findByRole('option', { name: '+ compound' }));
    await user.click(screen.getByRole('button', { name: 'ingredient 1 (empty)' }));
    await user.click(await screen.findByRole('option', { name: "use 'zzbase' as typed ingredient" }));
    expect(screen.getByRole('button', { name: 'ingredient 1: zzbase' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
    expect(screen.getByText(/Confirm ingredient 1 is not a controlled substance/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'This is not a controlled substance' }));
    expect(screen.queryByText(/Confirm ingredient 1 is not a controlled substance/)).not.toBeInTheDocument();
  });

  it('groups the unit menu as strengths, the base and then amounts; the base has no number and is offered once', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    await openMenu(user);
    await user.click(within(medicationsListbox()).getByRole('option', { name: '+ compound' }));

    await user.click(screen.getByRole('button', { name: 'ingredient 1 unit (empty)' }));
    const units = screen.getByRole('listbox', { name: 'Unit' });
    // The short groups first, ahead of the long list of amounts.
    const headings = ['Strength in the finished product', 'Other', 'Amount'].map((heading) =>
      within(units).getByText(heading)
    );
    for (const [before, after] of [headings.slice(0, 2), headings.slice(1)]) {
      expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    expect(within(units).getAllByRole('option')[0]).toHaveTextContent('%');
    for (const unit of ['Milliliters', 'Grams', '%', 'mg/mL', 'mg/g', 'mg each']) {
      expect(within(units).getByRole('option', { name: unit })).toBeInTheDocument();
    }
    await user.click(within(units).getByRole('option', { name: /^base/ }));
    expect(screen.getByRole('button', { name: 'ingredient 1 unit: base' })).toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'ingredient 1 amount' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '+ ingredient (empty)' }));
    await user.click(screen.getByRole('button', { name: 'ingredient 2 unit (empty)' }));
    expect(within(screen.getByRole('listbox', { name: 'Unit' })).queryByRole('option', { name: /^base/ })).toBeNull();
    await user.click(screen.getByRole('option', { name: '%' }));
    expect(screen.getByRole('spinbutton', { name: 'ingredient 2 amount' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove ingredient 1' }));
    expect(screen.getByRole('button', { name: 'ingredient 1 unit: %' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^ingredient 2/ })).not.toBeInTheDocument();
  });
});

describe('Compound prescriptions: what must be filled before Send', () => {
  const ketoprofen = (patch: Partial<CompoundIngredientLine> = {}): CompoundIngredientLine => ({
    ...emptyCompoundIngredient({ drug: KETOPROFEN }),
    product: productOf(KETOPROFEN, KETOPROFEN.strengths[0]),
    value: '10',
    unit: '%',
    ...patch,
  });
  const compoundLine = (name: string, ingredients: CompoundIngredientLine[]): PrescriptionLine => {
    const line = withCompound(emptyPrescriptionLine(), {});
    return {
      ...line,
      compound: { name, dosageForm: 'Cream', ingredients },
      patientInstructions: 'Apply a thin layer.',
      quantityValue: '60',
      quantityUnit: 'Gram',
    };
  };

  it('is complete with a name and a whole ingredient', () => {
    expect(prescriptionLineErrors(compoundLine('Ketoprofen cream', [ketoprofen()]))).toEqual([]);
  });

  it('needs a name of up to 105 characters and at least one ingredient', () => {
    expect(prescriptionLineErrors(compoundLine(' ', [ketoprofen()]))).toEqual(['Enter the compound name']);
    expect(prescriptionLineErrors(compoundLine('x'.repeat(106), [ketoprofen()]))).toEqual([
      'Compound name must be up to 105 characters',
    ]);
    expect(prescriptionLineErrors(compoundLine('x'.repeat(105), [ketoprofen()]))).toEqual([]);
    expect(prescriptionLineErrors(compoundLine('Cream', []))).toEqual(['Add an ingredient']);
  });

  it('needs a dosage form', () => {
    const line = compoundLine('Ketoprofen cream', [ketoprofen()]);
    expect(prescriptionLineErrors({ ...line, compound: { ...line.compound!, dosageForm: '' } })).toEqual([
      'Pick the dosage form',
    ]);
  });

  it('needs every ingredient worked out as an amount from the total', () => {
    expect(
      prescriptionLineErrors({ ...compoundLine('Ketoprofen gel', [ketoprofen()]), quantityUnit: 'Milliliter' })
    ).toEqual(["Enter an amount for ingredient 1 — a % can't be worked out from a total in mL"]);
  });

  it('needs each ingredient’s drug and strength, a number and unit, and a typed one confirmed', () => {
    const errors = prescriptionLineErrors(
      compoundLine('Cream', [
        emptyCompoundIngredient(),
        ketoprofen({ product: null }),
        ketoprofen({ value: '' }),
        ketoprofen({ unit: '' }),
        { ...emptyCompoundIngredient(), typed: 'Cream base', unit: 'base' },
      ])
    );
    expect(errors).toEqual([
      'Pick ingredient 1',
      'Pick a unit for ingredient 1',
      'Pick a strength for ingredient 2',
      'Ingredient 3 amount must be greater than 0',
      'Pick a unit for ingredient 4',
      'Confirm ingredient 5 is not a controlled substance',
    ]);
  });

  it('allows one base, and the normal prescription’s requirements still apply', () => {
    const base = (): CompoundIngredientLine => ketoprofen({ unit: 'base', value: '' });
    expect(prescriptionLineErrors(compoundLine('Cream', [ketoprofen(), base()]))).toEqual([]);
    expect(prescriptionLineErrors(compoundLine('Cream', [base(), base()]))).toEqual([
      'Only one ingredient can be the base',
    ]);
    expect(
      prescriptionLineErrors({ ...compoundLine('Cream', [ketoprofen()]), quantityUnit: '', patientInstructions: '' })
    ).toEqual(['Pick a unit', 'Enter the directions']);
  });
});

describe('Compound prescriptions: the order sent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.orderPrescription.mockResolvedValue({});
  });

  it('sends the compound’s name and ingredients in place of a product, with no substitution', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    await openMenu(user, 'keto');
    await user.click(
      await within(medicationsListbox()).findByRole('option', { name: '+ compound starting with Ketoprofen' })
    );
    await paste(
      user,
      screen.getByRole('textbox', { name: 'compound name' }),
      'Ketoprofen / gabapentin / lidocaine cream'
    );
    expect(screen.getByText('41/105')).toBeInTheDocument();
    await pickUnit(user, 'form', 'Cream');
    expect(screen.getByRole('button', { name: 'form: cream' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'ingredient 1 strength (empty)' }));
    await user.click(screen.getByRole('option', { name: 'Powder' }));
    await user.type(screen.getByRole('spinbutton', { name: 'ingredient 1 amount' }), '10');
    await pickUnit(user, 'ingredient 1 unit', '%');

    await user.click(screen.getByRole('button', { name: '+ ingredient (empty)' }));
    await pickIngredient(user, 2, 'gaba', 'Gabapentin', 'Powder');
    await user.type(screen.getByRole('spinbutton', { name: 'ingredient 2 amount' }), '6');
    await pickUnit(user, 'ingredient 2 unit', '%');

    await user.click(screen.getByRole('button', { name: '+ ingredient (empty)' }));
    await pickIngredient(user, 3, 'lido', 'Lidocaine', '4% Cream');
    await pickUnit(user, 'ingredient 3 unit', /^base/);

    await paste(
      user,
      screen.getByRole('textbox', { name: 'directions' }),
      'Apply a thin layer to the affected area 3 times a day.'
    );
    await user.type(screen.getByRole('spinbutton', { name: 'quantity' }), '60');
    await pickUnit(user, 'unit', 'Grams');
    await user.clear(screen.getByRole('spinbutton', { name: 'refills' }));
    await user.type(screen.getByRole('spinbutton', { name: 'refills' }), '1');

    await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
    await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
    expect(mocks.orderPrescription.mock.calls[0][0]).toEqual({
      patientId: 'patient-1',
      practitionerId: 'practitioner-1',
      encounterId: 'encounter-1',
      quantityValue: 60,
      quantityUnit: 'Gram',
      writtenDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      numberOfRefills: 1,
      patientInstructions: 'Apply a thin layer to the affected area 3 times a day.',
      pharmacyId: PHARMACY.ncpdpId,
      pharmacyNpi: PHARMACY.npi,
      pharmacyName: PHARMACY.name,
      pharmacyPhone: PHARMACY.phone,
      // Jon's eRx v4 body: the name, no substitution, and every ingredient as the amount that goes in.
      medicationDescription: 'Ketoprofen / gabapentin / lidocaine cream',
      substitutionAllowed: false,
      compound: {
        dosageForm: 'Cream',
        ingredients: [
          {
            description: 'Ketoprofen Powder',
            ndc: '00000000001',
            strength: { value: '10', unit: 'Percentage' },
            quantityValue: 6,
            quantityUnit: 'Gram',
          },
          {
            description: 'Gabapentin Powder',
            ndc: '00000000002',
            strength: { value: '6', unit: 'Percentage' },
            quantityValue: 3.6,
            quantityUnit: 'Gram',
          },
          { description: 'Lidocaine 4% Cream', ndc: '00000000003', quantityValue: 50.4, quantityUnit: 'Gram' },
        ],
      },
    });
  });

  it('sends a typed-in ingredient by its text, without the not-controlled confirmation or an RxCUI', async () => {
    const user = userEvent.setup();
    render(<OrderPrescriptionForm />);
    await openMenu(user);
    await user.click(within(medicationsListbox()).getByRole('option', { name: '+ compound' }));
    await paste(user, screen.getByRole('textbox', { name: 'compound name' }), 'Progesterone capsules');
    await pickUnit(user, 'form', 'Capsule');
    await user.click(screen.getByRole('button', { name: 'ingredient 1 (empty)' }));
    await user.type(screen.getByRole('combobox', { name: 'Medication' }), 'zzprog');
    await user.click(await screen.findByRole('option', { name: "use 'zzprog' as typed ingredient" }));
    await user.click(screen.getByRole('checkbox', { name: 'This is not a controlled substance' }));
    await user.type(screen.getByRole('spinbutton', { name: 'ingredient 1 amount' }), '75');
    await pickUnit(user, 'ingredient 1 unit', 'mg each');
    await paste(user, screen.getByRole('textbox', { name: 'directions' }), 'Take 1 capsule by mouth at bedtime.');
    await user.type(screen.getByRole('spinbutton', { name: 'quantity' }), '30');
    await pickUnit(user, 'unit', 'Capsules');

    await user.click(screen.getByRole('button', { name: 'Send Prescription' }));
    await waitFor(() => expect(mocks.orderPrescription).toHaveBeenCalledTimes(1));
    const sent = mocks.orderPrescription.mock.calls[0][0];
    expect(sent.compound).toEqual({
      dosageForm: 'Capsule',
      ingredients: [
        {
          description: 'zzprog',
          strength: { value: '75', unit: 'Milligram' },
          quantityValue: 2250,
          quantityUnit: 'Milligram',
        },
      ],
    });
    expect(sent.medicationDescription).toBe('Progesterone capsules');
    expect(sent.substitutionAllowed).toBe(false);
    expect(sent).not.toHaveProperty('ndc');
  });
});

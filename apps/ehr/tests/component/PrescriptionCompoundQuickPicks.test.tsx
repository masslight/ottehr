import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { CompoundInput } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it, vi } from 'vitest';
import {
  compoundLineOf,
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  quickPickProductMissing,
  suggestedQuickPickName,
  withCompound,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { PrescriptionSentences } from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';
import { withListedQuickPick } from '../../src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';

vi.mock('../../src/features/visits/shared/hooks/useErxSearch', () => ({
  useSearchMedications: () => ({ data: [], isFetching: false, isError: false }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { resourceType: 'Encounter', id: 'encounter-1', status: 'in-progress' } }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehr: undefined }) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => undefined }));
vi.mock('../../src/features/admin/patient-education/useIcd10SearchInput', () => ({
  useIcd10SearchInput: () => ({ inputValue: '', setInputValue: () => undefined, options: [], isFetching: false }),
}));

// Test compounds: the NDCs and RxCUIs are made up.
const PAIN_CREAM: CompoundInput = {
  description: 'Ketoprofen / gabapentin cream',
  ingredients: [
    { description: 'Ketoprofen Powder', ndc: '00000000001', rxcui: '1001', strength: { value: 10, unit: '%' } },
    { description: 'Gabapentin Powder', ndc: '00000000002', amount: { value: 6, unit: 'Gram' } },
    { description: 'Compounding cream', typedNotControlled: true, base: true },
  ],
};
const PAIN_CREAM_PICK: PrescriptionQuickPickData = {
  id: 'qp-cream',
  name: 'Pain cream',
  compound: PAIN_CREAM,
  quantityValue: 60,
  quantityUnit: 'Gram',
  daysSupply: 30,
  numberOfRefills: 1,
  patientInstructions: 'Apply to the affected area three times daily.',
  noteToPharmacy: 'Dispense in a pump',
};
const OMEPRAZOLE: CompoundInput = {
  description: 'Omeprazole suspension',
  ingredients: [
    { description: 'Omeprazole', typedNotControlled: true, strength: { value: 2, unit: 'mg/mL' } },
    { description: 'Sodium bicarbonate 8.4%', typedNotControlled: true, base: true },
  ],
};
const WEIGHT: VisitWeight = { kg: 20, takenAt: '2026-10-28T14:00:00Z', thisVisit: true };
const CONTEXT = {
  patientId: 'patient-1',
  practitionerId: 'practitioner-1',
  encounterId: 'encounter-1',
  pharmacy: { ncpdpId: '0002026', npi: '1234567893', name: 'Sample Pharmacy One', phone: '5125559999', address: '' },
  writtenDate: '2026-10-28',
};

const compoundLine = (compound: CompoundInput): PrescriptionLine => ({
  ...withCompound(emptyPrescriptionLine(), {}),
  compound: compoundLineOf(compound),
});

let latest: PrescriptionLine | undefined;
const Harness = ({
  initial,
  quickPicks = [],
  onSaveQuickPick,
}: {
  initial: PrescriptionLine;
  quickPicks?: PrescriptionQuickPickData[];
  onSaveQuickPick?: () => void;
}): JSX.Element => {
  const [line, setLine] = useState(initial);
  const [weightText, setWeightText] = useState<string>();
  latest = line;
  return (
    <PrescriptionSentences
      line={line}
      index={0}
      onChange={setLine}
      quickPicks={quickPicks}
      // As the order form does it.
      onQuickPick={(quickPick) => setLine((current) => withListedQuickPick(current, quickPick, WEIGHT.kg))}
      onSaveQuickPick={onSaveQuickPick}
      visitDiagnoses={[]}
      weightKg={WEIGHT.kg}
      weight={WEIGHT}
      weightText={weightText}
      onWeightText={setWeightText}
      errors={[]}
      readOnly={false}
    />
  );
};

describe('Compound quick picks', () => {
  it('are found in the medication menu by their name, the compound’s or an ingredient’s', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[PAIN_CREAM_PICK]} />);
    await user.click(screen.getByRole('button', { name: /^medication/ }));
    const field = screen.getByRole('combobox', { name: 'Medication' });
    for (const typed of ['pain', 'ketoprofen /', 'gabapentin powder', 'compounding']) {
      await user.clear(field);
      await user.type(field, typed);
      expect(screen.getByRole('option', { name: 'Pain cream' })).toBeInTheDocument();
    }
    await user.clear(field);
    await user.type(field, 'lidocaine');
    expect(screen.queryByRole('option', { name: 'Pain cream' })).not.toBeInTheDocument();
  });

  it('fill the whole compound line when picked, and send the compound they saved', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[PAIN_CREAM_PICK]} />);
    await user.click(screen.getByRole('button', { name: /^medication/ }));
    await user.click(screen.getByRole('option', { name: 'Pain cream' }));
    expect(screen.getByRole('textbox', { name: 'compound name' })).toHaveValue('Ketoprofen / gabapentin cream');
    expect(screen.getByRole('button', { name: 'ingredient 1: Ketoprofen Powder' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'ingredient 1 amount' })).toHaveValue(10);
    expect(screen.getByRole('button', { name: 'ingredient 1 unit: %' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ingredient 2: Gabapentin Powder' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ingredient 2 unit: grams' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ingredient 3: Compounding cream' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'This is not a controlled substance' })).toBeChecked();
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Apply to the affected area three times daily.'
    );
    expect(latest).toMatchObject({ quantityValue: '60', quantityUnit: 'Gram', daysSupply: '30', numberOfRefills: '1' });

    const order = prescriptionLineToOrder(latest!, CONTEXT);
    expect(order.compound).toEqual(PAIN_CREAM);
    expect(order).toMatchObject({ noteToPharmacy: 'Dispense in a pump', pharmacyId: '0002026' });
    expect(order).not.toHaveProperty('ndc');
  });

  it('are saved from a compound line: its compound and directions, no product, substitution or pharmacy', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    const line = {
      ...compoundLine(PAIN_CREAM),
      patientInstructions: 'Apply twice daily.',
      quantityValue: '30',
      quantityUnit: 'Gram' as const,
      numberOfRefills: '2',
    };
    render(<Harness initial={line} onSaveQuickPick={onSave} />);
    await user.click(screen.getByRole('button', { name: 'Save as quick pick' }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(suggestedQuickPickName(line)).toBe('Ketoprofen / gabapentin cream');
    expect(quickPickProductMissing(line)).toBeUndefined();
    expect(prescriptionLineToQuickPick(line, ' Pain cream ')).toEqual({
      name: 'Pain cream',
      compound: PAIN_CREAM,
      quantityValue: 30,
      quantityUnit: 'Gram',
      numberOfRefills: 2,
      patientInstructions: 'Apply twice daily.',
    });
    // One that couldn't be sent says why.
    expect(quickPickProductMissing({ ...line, compound: { ...line.compound!, name: '' } })).toBe(
      'Enter the compound name'
    );
  });
});

describe('Dose calculator for a compound', () => {
  const openCalculator = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    return screen.getByRole('dialog', { name: 'Dose calculator' });
  };
  const dose = async (user: ReturnType<typeof userEvent.setup>, rate: string): Promise<void> => {
    const calculator = await openCalculator(user);
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), rate);
    await user.click(within(calculator).getByRole('button', { name: /^frequency/ }));
    await user.click(screen.getByRole('option', { name: 'twice daily' }));
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
  };

  it('doses by its one mg/mL ingredient, writing the calculator’s sentence before what else is in the directions', async () => {
    const user = userEvent.setup();
    render(<Harness initial={compoundLine(OMEPRAZOLE)} />);
    const calculator = await openCalculator(user);
    expect(within(calculator).getByRole('spinbutton', { name: 'concentration' })).toHaveValue(2);
    await user.keyboard('{Escape}');

    // 20 kg × 1 mg/kg = 20 mg = 10 mL of 2 mg/mL.
    await dose(user, '1');
    const directions = screen.getByRole('textbox', { name: 'directions' });
    expect(directions).toHaveValue('Take 10 mL twice daily.');
    await user.click(directions);
    await user.paste(' Shake well.');
    // Dosed again: the new sentence replaces the old, and what was typed after it stays.
    await dose(user, '0.5');
    expect(directions).toHaveValue('Take 5 mL twice daily. Shake well.');
    // Only the directions change: the compound and its dispense blanks stay as they were.
    expect(latest).toMatchObject({ medication: null, quantityValue: '', dosing: undefined });
    expect(latest?.compound?.name).toBe('Omeprazole suspension');
  });

  it('is not offered without a mg/mL ingredient, or with more than one', () => {
    const { unmount } = render(<Harness initial={compoundLine(PAIN_CREAM)} />);
    expect(screen.queryByRole('button', { name: 'Dose calculator' })).not.toBeInTheDocument();
    unmount();
    const [omeprazole, base] = OMEPRAZOLE.ingredients;
    render(<Harness initial={compoundLine({ ...OMEPRAZOLE, ingredients: [omeprazole, omeprazole, base] })} />);
    expect(screen.queryByRole('button', { name: 'Dose calculator' })).not.toBeInTheDocument();
  });
});

describe('Turning a compound back into a prescription', () => {
  it('clears the compound and its directions, keeping the refills and note', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={{
          ...compoundLine(PAIN_CREAM),
          patientInstructions: 'Apply twice daily.',
          numberOfRefills: '2',
          noteToPharmacy: 'Call when ready',
        }}
      />
    );
    await user.click(screen.getByRole('button', { name: 'Remove compound' }));
    expect(screen.queryByRole('textbox', { name: 'compound name' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medication (empty)' })).toBeInTheDocument();
    expect(latest?.compound).toBeUndefined();
    expect(latest).toMatchObject({
      medication: null,
      patientInstructions: '',
      numberOfRefills: '2',
      noteToPharmacy: 'Call when ready',
    });
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineToQuickPick,
  quickPickDosingText,
  withDirections,
  withProduct,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { PrescriptionSentences } from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';
import { withListedQuickPick } from '../../src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';
import { ProcedureQuickPickDialogs } from '../../src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs';

// The real suggestions seam: the rows here come from the quick picks given.
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

const LIQUIDS = {
  name: 'Amoxicillin',
  strengths: [
    { strength: '400 mg/5ml Susp', ndcs: ['00093416173'] },
    { strength: '250 mg/5ml Susp', ndcs: ['00093415573'] },
  ],
};
const PRODUCT = { ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' };
const WEIGHT: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };

const BY_WEIGHT: PrescriptionQuickPickData = {
  id: 'qp-strep',
  name: 'Amox strep',
  ...PRODUCT,
  quantityValue: 120,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  numberOfRefills: 0,
  substitutionAllowed: false,
  noteToPharmacy: 'Shake well',
  patientInstructions: 'Take 9 mL by mouth twice daily for 10 days.',
  dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2, frequency: 'twice daily', durationDays: 10 },
};
const CAPPED: PrescriptionQuickPickData = {
  ...BY_WEIGHT,
  id: 'qp-capped',
  name: 'Amox capped',
  dosing: { ...BY_WEIGHT.dosing!, maxPerDoseMg: 500 },
};
const SAVED_TEXT: PrescriptionQuickPickData = {
  id: 'qp-text',
  name: 'Amox as written',
  ...PRODUCT,
  quantityValue: 100,
  quantityUnit: 'Milliliter',
  daysSupply: 10,
  patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
};
const OTHER_PRODUCT: PrescriptionQuickPickData = {
  ...BY_WEIGHT,
  id: 'qp-other',
  name: 'Amox 250',
  ndc: '00093415573',
  medicationDescription: 'Amoxicillin 250 mg/5ml Susp',
};

let latest: PrescriptionLine | undefined;
const Harness = ({
  initial,
  quickPicks = [],
  weight,
}: {
  initial: PrescriptionLine;
  quickPicks?: PrescriptionQuickPickData[];
  weight?: VisitWeight;
}): JSX.Element => {
  const [line, setLine] = useState(initial);
  const [weightText, setWeightText] = useState<string>();
  latest = line;
  const weightKg = weightText !== undefined ? Number(weightText) || undefined : weight?.kg;
  return (
    <PrescriptionSentences
      line={line}
      index={0}
      onChange={setLine}
      quickPicks={quickPicks}
      // As the order form does it.
      onQuickPick={(quickPick) => setLine((current) => withListedQuickPick(current, quickPick, weightKg))}
      visitDiagnoses={[]}
      weightKg={weightKg}
      weight={weight}
      weightText={weightText}
      onWeightText={setWeightText}
      errors={[]}
      readOnly={false}
    />
  );
};

const liquidLine = (): PrescriptionLine => withProduct(emptyPrescriptionLine(), LIQUIDS, LIQUIDS.strengths[0]);

/** The row of the suggestions box that reads the quick pick's name. */
const rowNamed = (name: string): HTMLElement => screen.getByText(name).closest('.MuiBox-root') as HTMLElement;

const hoverWorking = async (user: ReturnType<typeof userEvent.setup>, row: HTMLElement): Promise<HTMLElement> => {
  await user.hover(within(row).getByRole('img', { name: 'How this dose was worked out' }));
  return screen.findByTestId('suggestion-dose-working');
};

describe('Save as quick pick: the calculator’s dosing', () => {
  it('keeps the calculator’s settings with the line’s frequency and duration, says so, and drops them once the dose is typed', async () => {
    const user = userEvent.setup();
    const initial = withDirections(liquidLine(), { frequency: 'twice daily', durationDays: '10' });
    render(<Harness initial={initial} weight={WEIGHT} />);
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '500');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '6', frequency: 'twice daily', durationDays: '10' });

    const saved = prescriptionLineToQuickPick(latest!, 'Amox strep');
    expect(saved.dosing).toEqual({
      rate: 25,
      basis: 'mg/kg/dose',
      dosesPerDay: 2,
      maxPerDoseMg: 500,
      frequency: 'twice daily',
      durationDays: 10,
    });
    const { unmount } = render(
      <ProcedureQuickPickDialogs
        open
        name="Amox strep"
        onNameChange={() => undefined}
        existingQuickPicks={[]}
        saving={false}
        onClose={() => undefined}
        onSave={() => undefined}
        subject="prescription"
        details={quickPickDosingText(saved.dosing!)}
      />
    );
    expect(screen.getByTestId('quick-pick-details')).toHaveTextContent(
      'Saved by weight: 25 mg/kg per dose, twice daily, 10 days, max 500 mg per dose (from the calculator)'
    );
    unmount();

    // A dose typed over the calculator's is saved as written.
    await user.clear(screen.getByRole('spinbutton', { name: 'dose' }));
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '7');
    expect(prescriptionLineToQuickPick(latest!, 'Amox strep')).not.toHaveProperty('dosing');
  });
});

describe('Suggestions from quick picks', () => {
  it('shows the quick picks for exactly this product, the name under each, then "Other"', () => {
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT, OTHER_PRODUCT, SAVED_TEXT]} weight={WEIGHT} />);
    expect(screen.getByText('Amox strep')).toBeInTheDocument();
    expect(screen.getByText('Amox as written')).toBeInTheDocument();
    expect(screen.queryByText('Amox 250')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })).toHaveLength(3);
    // Without dosing: the saved sentence as written.
    expect(within(rowNamed('Amox as written')).getByText('Take 5 mL by mouth twice daily for 10 days.')).toBeVisible();
  });

  it('re-doses a quick pick saved by weight for each weight, with the working behind the ⓘ', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    let row = rowNamed('Amox strep');
    expect(row).toHaveTextContent('Take 9 mL by mouth twice daily for 10 days.');
    expect(within(row).getByRole('button', { name: 'Dose: 9' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Frequency: twice daily' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Duration: 10' })).toBeInTheDocument();
    let working = await hoverWorking(user, row);
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → 9 mL = 720 mg');
    expect(working).toHaveTextContent('9 mL = 720 mg, 17 mg (2%) over 703 mg');
    unmount();

    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={{ ...WEIGHT, kg: 12.4 }} />);
    row = rowNamed('Amox strep');
    // 12.4 kg × 25 = 310 mg = 3.875 mL: the nearest half mL is 4 mL.
    expect(within(row).getByRole('button', { name: 'Dose: 4' })).toBeInTheDocument();
    working = await hoverWorking(user, row);
    expect(working).toHaveTextContent('12.4 kg × 25 mg/kg/dose = 310 mg → 4 mL = 320 mg');

    // Picking the row fills the line as the quick pick would, with this patient's dose and its settings.
    await user.click(within(row).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({
      medication: PRODUCT,
      drug: LIQUIDS,
      dose: '4',
      frequency: 'twice daily',
      durationDays: '10',
      quantityValue: '80',
      quantityUnit: 'Milliliter',
      daysSupply: '10',
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
      patientInstructions: 'Take 4 mL by mouth twice daily for 10 days.',
      dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2 },
    });
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 4 mL by mouth twice daily for 10 days.'
    );
  });

  it('caps at the quick pick’s maximum, measuring down, and says so behind the ⓘ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[CAPPED]} weight={WEIGHT} />);
    const row = rowNamed('Amox capped');
    // 703 mg is over 500 mg; 500 mg is 6.25 mL, and 6.5 mL would be over it.
    expect(within(row).getByRole('button', { name: 'Dose: 6' })).toBeInTheDocument();
    const working = await hoverWorking(user, row);
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose → 6 mL = 480 mg');
    expect(working).toHaveTextContent(
      '6 mL = 480 mg, 20 mg (4%) under 500 mg (rounded down to stay at or under the max 500 mg per dose)'
    );
  });

  it('asks for a weight when there is none: no dose, and the row can’t be used until one is given', () => {
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT, SAVED_TEXT]} />);
    const row = rowNamed('Amox strep');
    const dose = within(row).getByRole('button', { name: 'Dose: not picked' });
    expect(dose).toHaveTextContent('(enter weight)');
    expect(within(row).queryByRole('img', { name: 'How this dose was worked out' })).not.toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Use this prescription' })).toBeDisabled();
    // A quick pick without dosing needs no weight.
    expect(within(rowNamed('Amox as written')).getByRole('button', { name: 'Use this prescription' })).toBeEnabled();
  });

  it('opens the row’s calculator with the quick pick’s settings; "Use this dose" uses the row with the new dose', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[CAPPED]} weight={WEIGHT} />);
    const row = rowNamed('Amox capped');
    await user.click(within(row).getByRole('button', { name: 'Dose calculator for Amox capped' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(25);
    expect(within(calculator).getByRole('button', { name: 'per day or per dose: dose' })).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'doses a day' })).toHaveValue(2);
    expect(within(calculator).getByText('from twice daily')).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' })).toHaveValue(500);
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent(
      'Take 6 mL by mouth twice daily for 10 days.'
    );

    // A higher maximum: 703 mg measures to 9 mL.
    await user.clear(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '1000');
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent(
      'Take 9 mL by mouth twice daily for 10 days.'
    );
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({
      dose: '9',
      frequency: 'twice daily',
      durationDays: '10',
      quantityValue: '180',
      noteToPharmacy: 'Shake well',
      patientInstructions: 'Take 9 mL by mouth twice daily for 10 days.',
      dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2, maxPerDoseMg: 1000 },
    });
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 9 mL by mouth twice daily for 10 days.'
    );
  });

  it('uses a quick pick without dosing as the quick pick list does: its directions as written', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[SAVED_TEXT]} weight={WEIGHT} />);
    await user.click(within(rowNamed('Amox as written')).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({
      medication: PRODUCT,
      dose: '',
      quantityValue: '100',
      daysSupply: '10',
      patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
    });
    expect(latest?.dosing).toBeUndefined();
  });

  it('takes a dose typed into the row as the provider’s own: the line keeps no settings', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    const row = rowNamed('Amox strep');
    await user.click(within(row).getByRole('button', { name: 'Dose: 9' }));
    const entry = screen.getByRole('spinbutton', { name: 'Dose' });
    await user.clear(entry);
    await user.type(entry, '8{Enter}');
    await user.click(within(rowNamed('Amox strep')).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({ dose: '8', patientInstructions: 'Take 8 mL by mouth twice daily for 10 days.' });
    expect(latest?.dosing).toBeUndefined();
  });
});

describe('The "+ quick pick" list', () => {
  // The list sets the product from the quick pick's NDC and description.
  const LISTED = { ...BY_WEIGHT, medicationDescription: PRODUCT.description };
  const LISTED_TEXT = { ...SAVED_TEXT, medicationDescription: PRODUCT.description };
  const PER_DAY: PrescriptionQuickPickData = {
    ...LISTED,
    id: 'qp-per-day',
    name: 'Amox per day',
    patientInstructions: 'Take 10 mL by mouth twice daily for 10 days.',
    dosing: { rate: 80, basis: 'mg/kg/day', dosesPerDay: 2, frequency: 'twice daily', durationDays: 10 },
  };

  const choose = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
    await user.click(screen.getByRole('button', { name: '+ quick pick (empty)' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Quick pick' })).getByText(label));
  };

  it('re-doses a quick pick saved by weight for this patient, as its suggestion row does', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} weight={{ ...WEIGHT, kg: 12.4 }} />);
    await choose(user, 'Amox strep, 120 milliliter');
    // 12.4 kg × 25 = 310 mg = 3.875 mL: the nearest half mL is 4 mL.
    expect(latest).toMatchObject({
      medication: PRODUCT,
      dose: '4',
      frequency: 'twice daily',
      durationDays: '10',
      quantityValue: '80',
      quantityUnit: 'Milliliter',
      daysSupply: '10',
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
      patientInstructions: 'Take 4 mL by mouth twice daily for 10 days.',
      dosing: { rate: 25, basis: 'mg/kg/dose', dosesPerDay: 2 },
    });
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(4);
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 4 mL by mouth twice daily for 10 days.'
    );
  });

  it('without a weight leaves the dose to enter and keeps the settings on the line', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} />);
    await choose(user, 'Amox strep, 120 milliliter');
    expect(latest).toMatchObject({ medication: PRODUCT, dose: '', frequency: 'twice daily', durationDays: '10' });
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveAttribute('placeholder', '(enter weight)');
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual(BY_WEIGHT.dosing);
  });

  it('uses a quick pick without dosing as saved', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED_TEXT]} weight={WEIGHT} />);
    await choose(user, 'Amox as written, 100 milliliter');
    expect(latest).toMatchObject({
      medication: PRODUCT,
      dose: '',
      quantityValue: '100',
      patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
    });
    expect(latest?.dosing).toBeUndefined();
  });

  it('a new frequency keeps the settings: by mg/kg/day the dose is worked out again, with the working behind the ⓘ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[PER_DAY]} weight={{ ...WEIGHT, kg: 20 }} />);
    await choose(user, 'Amox per day, 120 milliliter');
    // 20 kg × 80 mg/kg/day ÷ 2 = 800 mg = 10 mL.
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(10);
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(6.5);
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 6.5 mL by mouth three times daily for 10 days.'
    );
    await user.hover(screen.getByRole('img', { name: 'How the dose was worked out' }));
    const working = await screen.findByTestId('dose-working-note');
    expect(working).toHaveTextContent('20 kg × 80 mg/kg/day ÷ 3 = 533.33 mg → 6.5 mL = 520 mg');
    expect(working).toHaveTextContent('6.5 mL = 520 mg, 13.3 mg (2%) under 533.33 mg');
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual({
      rate: 80,
      basis: 'mg/kg/day',
      dosesPerDay: 3,
      frequency: 'three times daily',
      durationDays: 10,
    });
  });

  it('a new frequency keeps the settings: by mg/kg/dose the dose stays', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} weight={WEIGHT} />);
    await choose(user, 'Amox strep, 120 milliliter');
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(9);
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(9);
    expect(screen.queryByRole('img', { name: 'How the dose was worked out' })).not.toBeInTheDocument();
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual({
      rate: 25,
      basis: 'mg/kg/dose',
      dosesPerDay: 3,
      frequency: 'three times daily',
      durationDays: 10,
    });
  });
});

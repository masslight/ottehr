import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it, vi } from 'vitest';
import { UNSCHEDULED_MESSAGE, withDose } from '../../src/features/visits/in-person/components/erx/DoseCalculator';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
  prescriptionLineToOrder,
  prescriptionLineToQuickPick,
  quickPickDosingText,
  quickPickNameInUse,
  quickPickProductMissing,
  suggestedQuickPickName,
  withCalculatorDosing,
  withDirections,
  withDrug,
  withProduct,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { PrescriptionSentences } from '../../src/features/visits/in-person/components/erx/PrescriptionSentences';
import {
  prescriptionSuggestionsFor,
  withListedQuickPick,
} from '../../src/features/visits/in-person/components/erx/prescriptionSuggestions';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';
import { ProcedureQuickPickDialogs } from '../../src/features/visits/in-person/components/procedures/ProcedureQuickPickDialogs';
import { detailed, ERX_PRODUCT_DETAILS } from './helpers/erxProducts';

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
    detailed({ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }),
    detailed({ strength: '250 mg/5ml Susp', ndcs: ['00093415573'] }),
  ],
};
const PRODUCT = detailed({ ndc: '00093416173', description: 'Amoxicillin 400 mg/5ml Susp' });
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
  dosing: { rate: 25, basis: 'mg/kg/dose', frequency: 'twice daily', durationDays: 10 },
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
  ...ERX_PRODUCT_DETAILS['00093415573'],
};

let latest: PrescriptionLine | undefined;
const Harness = ({
  initial,
  quickPicks = [],
  weight,
  visitDiagnoses = [],
}: {
  initial: PrescriptionLine;
  quickPicks?: PrescriptionQuickPickData[];
  weight?: VisitWeight;
  visitDiagnoses?: { code: string; display: string }[];
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
      visitDiagnoses={visitDiagnoses}
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

/** The suggestions box's rows by position, "Other" last; the quick pick's name is only behind each row's ⓘ. */
const suggestionRow = (index: number): HTMLElement =>
  // The "+" sits in a box with the ⓘ; the row is the box around that.
  screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })[index].closest('.MuiBox-root')!
    .parentElement!;

/** What the row's ⓘ by its "+" says. */
const hoverInfo = async (
  user: ReturnType<typeof userEvent.setup>,
  row: HTMLElement,
  name = 'How this dose was worked out'
): Promise<HTMLElement> => {
  await user.hover(within(row).getByRole('img', { name }));
  return screen.findByTestId('suggestion-info');
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
    // The quantity and days supply follow: 6 mL × 2 a day × 10 days.
    expect(latest).toMatchObject({
      dose: '6',
      frequency: 'twice daily',
      durationDays: '10',
      quantityValue: '120',
      daysSupply: '10',
    });

    // The suggested name says the calculator's rule, as the quick pick keeps it.
    expect(suggestedQuickPickName(latest!)).toBe(
      'Amoxicillin 400 mg/5ml Susp | 25 mg/kg per dose | twice daily | 10 days'
    );
    const saved = prescriptionLineToQuickPick(latest!, 'Amox strep');
    expect(saved.dosing).toEqual({
      rate: 25,
      basis: 'mg/kg/dose',
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

    // It only adds: a name already in use (trimmed, any case) isn't saved, and the name field says why.
    const nameError = quickPickNameInUse('  amox STREP ', [BY_WEIGHT]);
    expect(nameError).toBe(
      "A quick pick named 'amox STREP' already exists. Edit it in Admin → Quick Picks, or choose another name."
    );
    expect(quickPickNameInUse('Amox strep 2', [BY_WEIGHT])).toBeUndefined();
    const named = render(
      <ProcedureQuickPickDialogs
        open
        name="amox STREP"
        onNameChange={() => undefined}
        existingQuickPicks={[]}
        saving={false}
        onClose={() => undefined}
        onSave={() => undefined}
        subject="prescription"
        placeholder="Quick pick name"
        nameError={nameError}
      />
    );
    expect(screen.getByRole('combobox', { name: 'Quick Pick Name' })).toHaveAttribute('placeholder', 'Quick pick name');
    expect(screen.getByText(nameError!)).toBeInTheDocument();
    named.unmount();

    // A dose typed over the calculator's is saved as written.
    await user.clear(screen.getByRole('spinbutton', { name: 'dose' }));
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '7');
    expect(prescriptionLineToQuickPick(latest!, 'Amox strep')).not.toHaveProperty('dosing');
    expect(suggestedQuickPickName(latest!)).toBe('Amoxicillin 400 mg/5ml Susp | 7 mL | twice daily | 10 days');
  });
});

describe('Save as quick pick: the suggested name', () => {
  const TABLETS = { name: 'Amoxicillin', strengths: [detailed({ strength: '500 mg Tab', ndcs: ['00093226301'] })] };
  const tabletLine = (): PrescriptionLine => withProduct(emptyPrescriptionLine(), TABLETS, TABLETS.strengths[0]);

  it('is the product, the dose with its unit, the frequency and the days, as the line holds them', () => {
    const line = withDirections(liquidLine(), { dose: '6', frequency: 'twice daily', durationDays: '10' });
    expect(suggestedQuickPickName(line)).toBe('Amoxicillin 400 mg/5ml Susp | 6 mL | twice daily | 10 days');
    expect(
      suggestedQuickPickName(withDirections(tabletLine(), { dose: '0.5', frequency: 'once daily', durationDays: '1' }))
    ).toBe('Amoxicillin 500 mg Tab | ½ tablet | once daily | 1 day');
  });

  it('leaves out the parts not filled in', () => {
    expect(suggestedQuickPickName(liquidLine())).toBe('Amoxicillin 400 mg/5ml Susp');
    expect(suggestedQuickPickName(withDirections(liquidLine(), { frequency: 'as needed' }))).toBe(
      'Amoxicillin 400 mg/5ml Susp | as needed'
    );
    expect(suggestedQuickPickName(withDirections(tabletLine(), { dose: '2', durationDays: '5' }))).toBe(
      'Amoxicillin 500 mg Tab | 2 tablets | 5 days'
    );
  });

  it('names a fixed dose from the calculator by its mg, and a course’s calculated dose by its amount', () => {
    const line = withDirections(liquidLine(), { dose: '6', frequency: 'twice daily', durationDays: '10' });
    expect(suggestedQuickPickName({ ...line, dosing: { rate: 500, basis: 'fixed' } })).toBe(
      'Amoxicillin 400 mg/5ml Susp | 500 mg per dose | twice daily | 10 days'
    );
    expect(suggestedQuickPickName({ ...line, dosing: { rate: 45, basis: 'mg/kg/day' } })).toBe(
      'Amoxicillin 400 mg/5ml Susp | 45 mg/kg per day | twice daily | 10 days'
    );
    // A taper saves no dosing, so its name doesn't say one; it ends "+taper".
    const taper = {
      ...line,
      dosing: { rate: 25, basis: 'mg/kg/dose' as const },
      steps: [{ dose: '3', frequency: 'once daily', durationDays: '5' }],
    };
    expect(suggestedQuickPickName(taper)).toBe('Amoxicillin 400 mg/5ml Susp | 6 mL | twice daily | 10 days +taper');
  });
});

describe('Save as quick pick: the product', () => {
  it('is needed: a line without a product says to pick one; a drug without its strength has none yet', () => {
    const message = 'Pick a medication and strength before saving a quick pick';
    expect(quickPickProductMissing(emptyPrescriptionLine())).toBe(message);
    expect(quickPickProductMissing({ ...liquidLine(), medication: null })).toBe(message);
    expect(quickPickProductMissing(liquidLine())).toBeUndefined();
  });
});

describe('Suggestions from quick picks', () => {
  it('shows the quick picks for exactly this product, each name behind its ⓘ only, then "Other"', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT, OTHER_PRODUCT, SAVED_TEXT]} weight={WEIGHT} />);
    expect(screen.getAllByRole('button', { name: /^(Use this prescription|Write my own)$/ })).toHaveLength(3);
    // No name on the rows themselves.
    expect(screen.queryByText(/Amox (strep|as written)/)).not.toBeInTheDocument();
    expect(suggestionRow(0)).toHaveTextContent('Take 9 mL by mouth twice daily for 10 days.');
    // Without dosing: the saved sentence as written, and an ⓘ by its "+" with just the name.
    const asWritten = suggestionRow(1);
    expect(within(asWritten).getByText('Take 5 mL by mouth twice daily for 10 days.')).toBeVisible();
    const info = within(asWritten).getByRole('img', { name: 'About this suggestion' });
    expect(info.nextElementSibling).toContainElement(
      within(asWritten).getByRole('button', { name: 'Use this prescription' })
    );
    expect(await hoverInfo(user, asWritten, 'About this suggestion')).toHaveTextContent(
      /^Quick pick: Amox as written$/
    );
    await user.unhover(info);
    // "Other" has none.
    expect(within(suggestionRow(2)).queryByRole('img')).not.toBeInTheDocument();
  });

  it('re-doses a quick pick saved by weight for each weight, with the working behind the ⓘ', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    let row = suggestionRow(0);
    expect(row).toHaveTextContent('Take 9 mL by mouth twice daily for 10 days.');
    expect(within(row).getByRole('button', { name: 'Dose: 9' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Frequency: twice daily' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Duration: 10' })).toBeInTheDocument();
    let working = await hoverInfo(user, row);
    // The quick pick's name first, then the working.
    expect(working.firstElementChild).toHaveTextContent(/^Quick pick: Amox strep$/);
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg');
    expect(working).toHaveTextContent('9 mL = 720 mg, 17 mg (2%) over 703 mg');
    unmount();

    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={{ ...WEIGHT, kg: 12.4 }} />);
    row = suggestionRow(0);
    // 12.4 kg × 25 = 310 mg = 3.875 mL: the nearest half mL is 4 mL.
    expect(within(row).getByRole('button', { name: 'Dose: 4' })).toBeInTheDocument();
    working = await hoverInfo(user, row);
    expect(working).toHaveTextContent('12.4 kg × 25 mg/kg/dose = 310 mg');

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
      dosing: { rate: 25, basis: 'mg/kg/dose' },
    });
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 4 mL by mouth twice daily for 10 days.'
    );
  });

  it('caps at the quick pick’s maximum, measuring down, and says so behind the ⓘ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[CAPPED]} weight={WEIGHT} />);
    const row = suggestionRow(0);
    // 703 mg is over 500 mg; 500 mg is 6.25 mL, and 6.5 mL would be over it.
    expect(within(row).getByRole('button', { name: 'Dose: 6' })).toBeInTheDocument();
    const working = await hoverInfo(user, row);
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose');
    expect(working).toHaveTextContent(
      '6 mL = 480 mg, 20 mg (4%) under 500 mg (rounded down to stay at or under the max 500 mg per dose)'
    );
  });

  it('asks for a weight when there is none: no dose, and the row can’t be used until one is given', () => {
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT, SAVED_TEXT]} />);
    const row = suggestionRow(0);
    const dose = within(row).getByRole('button', { name: 'Dose: not picked' });
    expect(dose).toHaveTextContent('(enter weight)');
    // No working yet: the ⓘ has just the quick pick.
    expect(within(row).queryByRole('img', { name: 'How this dose was worked out' })).not.toBeInTheDocument();
    expect(within(row).getByRole('img', { name: 'About this suggestion' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Use this prescription' })).toBeDisabled();
    // A quick pick without dosing needs no weight.
    expect(within(suggestionRow(1)).getByRole('button', { name: 'Use this prescription' })).toBeEnabled();
  });

  it('opens the row’s calculator with the quick pick’s settings; "Use this dose" uses the row with the new dose', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[CAPPED]} weight={WEIGHT} />);
    const row = suggestionRow(0);
    // The calculator starts the sentence, before "Take"; the ⓘ sits right before the row's "+".
    const icon = within(row).getByRole('button', { name: 'Dose calculator for Amox capped' });
    expect(icon.parentElement?.firstElementChild).toBe(icon);
    expect(
      icon.compareDocumentPosition(within(row).getByRole('button', { name: /^Dose: / })) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const info = within(row).getByRole('img', { name: 'How this dose was worked out' });
    expect(info.nextElementSibling).toContainElement(
      within(row).getByRole('button', { name: 'Use this prescription' })
    );
    await user.click(icon);
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(25);
    expect(within(calculator).getByRole('button', { name: 'per day or per dose: dose' })).toBeInTheDocument();
    expect(within(calculator).getByRole('button', { name: 'frequency: twice daily' })).toBeInTheDocument();
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
      // Worked out again for the new dose, not the quick pick's saved 120 mL.
      quantityValue: '180',
      daysSupply: '10',
      noteToPharmacy: 'Shake well',
      patientInstructions: 'Take 9 mL by mouth twice daily for 10 days.',
      dosing: { rate: 25, basis: 'mg/kg/dose', maxPerDoseMg: 1000 },
    });
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 9 mL by mouth twice daily for 10 days.'
    );
  });

  it('uses a quick pick without dosing as the quick pick list does: its directions as written', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[SAVED_TEXT]} weight={WEIGHT} />);
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({
      medication: PRODUCT,
      dose: '',
      quantityValue: '100',
      daysSupply: '10',
      patientInstructions: 'Take 5 mL by mouth twice daily for 10 days.',
    });
    expect(latest?.dosing).toBeUndefined();
  });

  it('shows the calculator on a quick pick with dosing; one saved as written has it disabled, its hover saying so', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[SAVED_TEXT, CAPPED]} weight={WEIGHT} />);
    // In the list's order: "Amox as written", then "Amox capped".
    const written = within(suggestionRow(0)).getByRole('button', { name: 'Dose calculator for Amox as written' });
    expect(written).toBeDisabled();
    await user.hover(written.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Amox as written is dispensed as-written, not calculated\.$/
    );
    const icon = within(suggestionRow(1)).getByRole('button', { name: 'Dose calculator for Amox capped' });
    expect(icon).toBeEnabled();
    expect(icon.parentElement?.firstElementChild).toBe(icon);
  });

  it('takes a dose typed into the row as the provider’s own: the line keeps no settings', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    const row = suggestionRow(0);
    await user.click(within(row).getByRole('button', { name: 'Dose: 9' }));
    const entry = screen.getByRole('spinbutton', { name: 'Dose' });
    // The popup is named "Dose" by its field alone, with no heading repeating it.
    const popup = screen.getByRole('dialog', { name: 'Dose' });
    expect(
      within(popup)
        .getAllByText('Dose')
        .filter((element) => !element.closest('legend'))
    ).toHaveLength(1);
    await user.clear(entry);
    await user.type(entry, '8{Enter}');
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({ dose: '8', patientInstructions: 'Take 8 mL by mouth twice daily for 10 days.' });
    expect(latest?.dosing).toBeUndefined();
  });
});

describe('Suggestion rows: review fixes', () => {
  const PER_DAY_ROW: PrescriptionQuickPickData = {
    ...BY_WEIGHT,
    id: 'qp-per-day-row',
    name: 'Amox per day',
    dosing: { rate: 80, basis: 'mg/kg/day', frequency: 'twice daily', durationDays: 10 },
  };

  it('a new frequency on a row by mg/kg/day works the dose out again, and "+" uses the new doses a day', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[PER_DAY_ROW]} weight={WEIGHT} />);
    // 28.12 kg × 80 mg/kg/day ÷ 2 = 1,124.8 mg = 14 mL.
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Dose: 14' })).toBeInTheDocument();
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    // ÷ 3 = 749.87 mg = 9.5 mL: still 80 mg/kg/day, not 120.
    const row = suggestionRow(0);
    expect(within(row).getByRole('button', { name: 'Dose: 9.5' })).toBeInTheDocument();
    expect(await hoverInfo(user, row)).toHaveTextContent('28.12 kg × 80 mg/kg/day ÷ 3 = 749.87 mg');
    // The row's calculator opens on the new frequency too.
    await user.click(within(row).getByRole('button', { name: 'Dose calculator for Amox per day' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('button', { name: 'frequency: three times daily' })).toBeInTheDocument();
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 9.5 mL by mouth three times daily');
    await user.keyboard('{Escape}');
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({
      dose: '9.5',
      frequency: 'three times daily',
      patientInstructions: 'Take 9.5 mL by mouth three times daily for 10 days.',
      dosing: { rate: 80, basis: 'mg/kg/day' },
    });
  });

  it('keeps what was picked on a row when the line’s diagnosis changes', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={liquidLine()}
        quickPicks={[PER_DAY_ROW]}
        weight={WEIGHT}
        visitDiagnoses={[{ code: 'H66.90', display: 'Otitis media' }]}
      />
    );
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    await user.click(screen.getByRole('button', { name: 'add diagnosis (empty)' }));
    await user.click(screen.getByRole('option', { name: 'H66.90 - Otitis media' }));
    expect(latest?.diagnosis).toEqual({ code: 'H66.90', display: 'Otitis media' });
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: three times daily' })).toBeInTheDocument();
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Dose: 9.5' })).toBeInTheDocument();
  });

  it('a frequency picked in a row’s calculator works the dose out again and "Use this dose" writes it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[PER_DAY_ROW]} weight={WEIGHT} />);
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Dose calculator for Amox per day' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 14 mL by mouth twice daily');
    await user.click(within(calculator).getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    // ÷ 3 = 749.87 mg = 9.5 mL; the row is as it was until the dose is used.
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 9.5 mL by mouth three times daily');
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: twice daily' })).toBeInTheDocument();
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({
      dose: '9.5',
      frequency: 'three times daily',
      dosing: { rate: 80, basis: 'mg/kg/day' },
    });
  });

  it('a quick pick with no directions or quantity is not "In use" on an empty line', () => {
    const bare: PrescriptionQuickPickData = { id: 'qp-bare', name: 'Amox bare', ...PRODUCT };
    render(<Harness initial={liquidLine()} quickPicks={[bare]} weight={WEIGHT} />);
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' })).toBeEnabled();
    expect(within(suggestionRow(0)).queryByTitle('In use')).not.toBeInTheDocument();
  });

  it('a saved frequency that is not one of the form’s own ("constructor") is not offered', () => {
    const odd: PrescriptionQuickPickData = {
      ...BY_WEIGHT,
      id: 'qp-odd',
      dosing: { ...BY_WEIGHT.dosing!, frequency: 'constructor' },
    };
    render(<Harness initial={liquidLine()} quickPicks={[odd]} weight={WEIGHT} />);
    // Left to pick.
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: not picked' })).toBeInTheDocument();
  });

  it('a quick pick with dosing on a combination product leaves the dose to enter, with the note', async () => {
    const user = userEvent.setup();
    const augmentin = {
      name: 'Amoxicillin-Clavulanate',
      strengths: [detailed({ strength: '400-57 mg/5ml Susp', ndcs: ['00093227573'] })],
    };
    const combo: PrescriptionQuickPickData = {
      ...BY_WEIGHT,
      id: 'qp-combo',
      name: 'Augmentin by weight',
      ndc: '00093227573',
      medicationDescription: 'Amoxicillin-Clavulanate 400-57 mg/5ml Susp',
      ...ERX_PRODUCT_DETAILS['00093227573'],
    };
    render(
      <Harness
        initial={withProduct(emptyPrescriptionLine(), augmentin, augmentin.strengths[0])}
        quickPicks={[combo]}
        weight={WEIGHT}
      />
    );
    const row = suggestionRow(0);
    expect(within(row).getByRole('button', { name: 'Dose: not picked' })).not.toHaveTextContent('(enter weight)');
    expect(await hoverInfo(user, row)).toHaveTextContent(
      'Combination product: open the calculator to choose which ingredient to dose by'
    );
  });
});

describe('A quick pick saved before products had details', () => {
  it('works out no dose and says why: nothing is read from the product’s name', async () => {
    const user = userEvent.setup();
    const bare = { name: 'Amoxicillin', strengths: [{ strength: '400 mg/5ml Susp', ndcs: ['00093416173'] }] };
    const older: PrescriptionQuickPickData = {
      ...BY_WEIGHT,
      id: 'qp-older',
      rxcui: undefined,
      doseForm: undefined,
      ingredients: undefined,
    };
    render(
      <Harness
        initial={withProduct(emptyPrescriptionLine(), bare, bare.strengths[0])}
        quickPicks={[older]}
        weight={WEIGHT}
      />
    );
    const row = suggestionRow(0);
    expect(within(row).getByRole('button', { name: 'Dose: not picked' })).not.toHaveTextContent('(enter weight)');
    expect(await hoverInfo(user, row)).toHaveTextContent('Strength details unavailable: enter the dose directly');
  });
});

describe('A quick pick from the medication menu', () => {
  // The list sets the product from the quick pick's NDC and description.
  const LISTED = { ...BY_WEIGHT, medicationDescription: PRODUCT.description };
  const LISTED_TEXT = { ...SAVED_TEXT, medicationDescription: PRODUCT.description };
  const PER_DAY: PrescriptionQuickPickData = {
    ...LISTED,
    id: 'qp-per-day',
    name: 'Amox per day',
    patientInstructions: 'Take 10 mL by mouth twice daily for 10 days.',
    dosing: { rate: 80, basis: 'mg/kg/day', frequency: 'twice daily', durationDays: 10 },
  };

  const choose = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
    await user.click(screen.getByRole('button', { name: /^medication/ }));
    await user.click(
      within(screen.getByRole('listbox', { name: 'Prescription sets and quick picks' })).getByText(label)
    );
  };

  it('re-doses a quick pick saved by weight for this patient, as its suggestion row does', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} weight={{ ...WEIGHT, kg: 12.4 }} />);
    await choose(user, 'Amox strep');
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
      dosing: { rate: 25, basis: 'mg/kg/dose' },
    });
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(4);
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 4 mL by mouth twice daily for 10 days.'
    );
  });

  it('without a weight leaves the dose to enter and keeps the settings on the line', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} />);
    await choose(user, 'Amox strep');
    expect(latest).toMatchObject({ medication: PRODUCT, dose: '', frequency: 'twice daily', durationDays: '10' });
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveAttribute('placeholder', '(enter weight)');
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual(BY_WEIGHT.dosing);
  });

  it('uses a quick pick without dosing as saved', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED_TEXT]} weight={WEIGHT} />);
    await choose(user, 'Amox as written');
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
    await choose(user, 'Amox per day');
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
    expect(working).toHaveTextContent('20 kg × 80 mg/kg/day ÷ 3 = 533.33 mg');
    expect(working).toHaveTextContent('6.5 mL = 520 mg, 13.3 mg (2%) under 533.33 mg');
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual({
      rate: 80,
      basis: 'mg/kg/day',
      frequency: 'three times daily',
      durationDays: 10,
    });
  });

  it('a new frequency keeps the settings: by mg/kg/dose the dose stays', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED]} weight={WEIGHT} />);
    await choose(user, 'Amox strep');
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(9);
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(9);
    // Still the quick pick's dose: its working stays behind the ⓘ.
    await user.hover(screen.getByRole('img', { name: 'How the dose was worked out' }));
    expect(await screen.findByTestId('dose-working-note')).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg');
    expect(prescriptionLineToQuickPick(latest!, 'Again').dosing).toEqual({
      rate: 25,
      basis: 'mg/kg/dose',
      frequency: 'three times daily',
      durationDays: 10,
    });
  });
});

describe('Maximum warnings on the line', () => {
  const SOURCE = { label: 'AAP Red Book', url: 'https://publications.aap.org/redbook' };
  // 25 mg/kg per dose twice daily, max 500 mg a dose and 1,000 mg a day, with a source.
  const MAXED: PrescriptionQuickPickData = {
    ...BY_WEIGHT,
    id: 'qp-maxed',
    name: 'Amox strep, twice daily',
    dosing: { ...BY_WEIGHT.dosing!, maxPerDoseMg: 500, maxPerDayMg: 1000 },
    source: SOURCE,
  };
  const LISTED_MAXED = { ...MAXED, medicationDescription: PRODUCT.description };

  const choose = async (user: ReturnType<typeof userEvent.setup>, label: string): Promise<void> => {
    await user.click(screen.getByRole('button', { name: /^medication/ }));
    await user.click(
      within(screen.getByRole('listbox', { name: 'Prescription sets and quick picks' })).getByText(label)
    );
  };
  const typeDose = async (user: ReturnType<typeof userEvent.setup>, dose: string): Promise<void> => {
    await user.clear(screen.getByRole('spinbutton', { name: 'dose' }));
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), dose);
  };
  const warningInfo = async (user: ReturnType<typeof userEvent.setup>, index = 0): Promise<HTMLElement> => {
    await user.hover(screen.getAllByRole('img', { name: 'Where this maximum is from' })[index]);
    return screen.findByTestId('warning-info');
  };

  it('shows the quick pick’s source after its name behind the row’s ⓘ, as a link', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[MAXED]} weight={WEIGHT} />);
    const info = await hoverInfo(user, suggestionRow(0));
    expect(info.children[0]).toHaveTextContent(/^Quick pick: Amox strep, twice daily$/);
    expect(info.children[1]).toHaveTextContent(/^Source: AAP Red Book$/);
    expect(within(info).getByRole('link', { name: 'AAP Red Book' })).toHaveAttribute('href', SOURCE.url);
  });

  it('no warning while the capped dose is under the maximum; a typed dose over it warns, with where the maximum is from', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED_MAXED]} weight={WEIGHT} />);
    await choose(user, 'Amox strep, twice daily');
    // Capped at 500 mg: 6 mL = 480 mg.
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(6);
    expect(screen.queryByTestId('dose-warnings-warning')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'dose' })).not.toHaveAttribute('data-warn');

    await typeDose(user, '10');
    // 10 mL = 800 mg a dose; 1,600 mg a day is over its maximum too. Each warning outlines its blank.
    const warnings = screen.getAllByTestId('dose-warnings-warning');
    expect(warnings).toHaveLength(2);
    expect(warnings[0]).toHaveTextContent('800 mg per dose is above the 500 mg maximum.');
    expect(warnings[1]).toHaveTextContent('1,600 mg a day is above the 1,000 mg a day maximum.');
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveAttribute('data-warn', 'true');
    expect(screen.getByRole('button', { name: 'frequency: twice daily' })).toHaveAttribute('data-warn', 'true');
    // The typed dose drops the settings but keeps the maximum, for the warnings only.
    expect(latest?.dosing).toBeUndefined();
    expect(latest?.maximum).toEqual({
      maxPerDoseMg: 500,
      maxPerDayMg: 1000,
      from: { quickPick: 'Amox strep, twice daily', source: SOURCE },
    });
    const info = await warningInfo(user);
    expect(info.children[0]).toHaveTextContent(/^From the quick pick: Amox strep, twice daily$/);
    expect(within(info).getByRole('link', { name: 'AAP Red Book' })).toHaveAttribute('href', SOURCE.url);
    // Never blocks sending.
    expect(prescriptionLineErrors(latest!)).toEqual([]);
    // A quick pick saved from the line keeps no dosing or maximum: the dose is the provider's own.
    const saved = prescriptionLineToQuickPick(latest!, 'Mine');
    expect(saved).not.toHaveProperty('dosing');
    expect(JSON.stringify(saved)).not.toMatch(/max/);
  });

  it('a frequency that takes the day over its maximum warns per day and outlines the frequency', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[LISTED_MAXED]} weight={WEIGHT} />);
    await choose(user, 'Amox strep, twice daily');
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'four times daily' }));
    // 6 mL = 480 mg a dose, × 4 = 1,920 mg a day.
    expect(screen.getByRole('spinbutton', { name: 'dose' })).toHaveValue(6);
    const warnings = screen.getAllByTestId('dose-warnings-warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toHaveTextContent('1,920 mg a day is above the 1,000 mg a day maximum.');
    expect(screen.getByRole('button', { name: 'frequency: four times daily' })).toHaveAttribute('data-warn', 'true');
    expect(screen.getByRole('spinbutton', { name: 'dose' })).not.toHaveAttribute('data-warn');
    // As needed without a count of doses: no per-day warning.
    await user.click(screen.getByRole('button', { name: 'frequency: four times daily' }));
    await user.click(screen.getByRole('option', { name: 'as needed' }));
    expect(screen.queryByTestId('dose-warnings-warning')).not.toBeInTheDocument();
  });

  it('a maximum from the dose calculator says so; a new strength or drug clears it', async () => {
    const user = userEvent.setup();
    const initial = withDirections(liquidLine(), { frequency: 'twice daily', durationDays: '10' });
    render(<Harness initial={initial} weight={WEIGHT} />);
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '500');
    // The cap is said under the result, not only in the hover.
    expect(within(calculator).getByTestId('dose-cap')).toHaveTextContent(
      'Capped at the 500 mg maximum (703 mg by weight)'
    );
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(screen.queryByTestId('dose-warnings-warning')).not.toBeInTheDocument();
    await typeDose(user, '7');
    expect(screen.getByTestId('dose-warnings-warning')).toHaveTextContent(
      '560 mg per dose is above the 500 mg maximum.'
    );
    expect(await warningInfo(user)).toHaveTextContent(/^From the dose calculator$/);

    // A new strength: the line waits for a pick, and the maximum is gone.
    await user.click(screen.getByRole('button', { name: /^strength: / }));
    await user.click(screen.getByRole('option', { name: '250 mg/5ml Susp' }));
    expect(latest?.maximum).toBeUndefined();
  });

  it('no maximum on the line: no warning, whatever the dose', async () => {
    const user = userEvent.setup();
    render(<Harness initial={emptyPrescriptionLine()} quickPicks={[{ ...LISTED_MAXED, dosing: undefined }]} />);
    await choose(user, 'Amox strep, twice daily');
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'four times daily' }));
    await typeDose(user, '20');
    expect(screen.queryByTestId('dose-warnings-warning')).not.toBeInTheDocument();
  });
});

describe('Additional instructions of a dosed quick pick', () => {
  const EXTRA = 'Shake well. Take with food.';
  const WITH_EXTRA: PrescriptionQuickPickData = {
    ...BY_WEIGHT,
    id: 'qp-extra',
    name: 'Amox strep extra',
    // The list sets the product from the quick pick's NDC and description.
    medicationDescription: PRODUCT.description,
    additionalInstructions: EXTRA,
  };
  /** The quick pick's suggestion row used on a line picked from the search, which keeps its drug and strength. */
  const used = (quickPick: PrescriptionQuickPickData, weightKg = WEIGHT.kg): PrescriptionLine => {
    const line = liquidLine();
    const [row] = prescriptionSuggestionsFor({
      medication: line.medication!,
      weightKg,
      quickPicks: [quickPick],
    });
    return row.apply(line, []);
  };

  it('follow the calculated sentence, and go to the pharmacy with it', () => {
    const line = used(WITH_EXTRA);
    expect(line.patientInstructions).toBe(`Take 9 mL by mouth twice daily for 10 days. ${EXTRA}`);
    expect(line.additionalInstructions).toBe(EXTRA);
    const order = prescriptionLineToOrder(line, {
      patientId: 'p',
      practitionerId: 'pr',
      encounterId: 'e',
      pharmacy: { ncpdpId: '1', npi: '2', name: 'Pharmacy', phone: '5555555555', address: '' } as never,
      writtenDate: '2026-10-27',
    });
    expect(order.patientInstructions).toBe(`Take 9 mL by mouth twice daily for 10 days. ${EXTRA}`);
    // The list's quick pick too.
    expect(withListedQuickPick(emptyPrescriptionLine(), WITH_EXTRA, WEIGHT.kg).patientInstructions).toBe(
      `Take 9 mL by mouth twice daily for 10 days. ${EXTRA}`
    );
  });

  it('survive a new frequency, "Use this dose" and a new strength; go with the drug or another quick pick', () => {
    const line = used(WITH_EXTRA);
    const refrequenced = withDirections(withCalculatorDosing(line, { frequency: 'three times daily' }, WEIGHT.kg), {
      frequency: 'three times daily',
    });
    expect(refrequenced.patientInstructions).toBe(`Take 9 mL by mouth three times daily for 10 days. ${EXTRA}`);
    const redosed = withDose(line, { dose: '7', dosing: line.dosing });
    expect(redosed.patientInstructions).toBe(`Take 7 mL by mouth twice daily for 10 days. ${EXTRA}`);
    // 9 mL of 80 mg/mL = 720 mg = 14.4 mL of 50 mg/mL, measured to 14.5 mL.
    const restrength = withProduct(line, LIQUIDS, LIQUIDS.strengths[1]);
    expect(restrength.patientInstructions).toBe(`Take 14.5 mL by mouth twice daily for 10 days. ${EXTRA}`);
    expect(withDrug(line, LIQUIDS).additionalInstructions).toBeUndefined();
    expect(used(BY_WEIGHT).additionalInstructions).toBeUndefined();
    expect(withListedQuickPick(line, SAVED_TEXT, WEIGHT.kg).additionalInstructions).toBeUndefined();
  });

  it('save with the dosing from the order form', () => {
    expect(prescriptionLineToQuickPick(used(WITH_EXTRA), 'Again')).toMatchObject({
      dosing: { rate: 25, basis: 'mg/kg/dose' },
      additionalInstructions: EXTRA,
    });
    // A dose typed over the calculator's is saved as written: the directions hold the whole text.
    const typed = withCalculatorDosing(used(WITH_EXTRA), { dose: '7' }, WEIGHT.kg);
    expect(prescriptionLineToQuickPick(typed, 'Again')).not.toHaveProperty('additionalInstructions');
  });

  it('show on the line to edit or remove; the directions follow', async () => {
    const user = userEvent.setup();
    render(<Harness initial={used(WITH_EXTRA)} weight={WEIGHT} />);
    const blank = screen.getByRole('textbox', { name: 'additional instructions' });
    expect(blank).toHaveValue(EXTRA);
    await user.clear(blank);
    await user.type(blank, 'Shake well.');
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 9 mL by mouth twice daily for 10 days. Shake well.'
    );
    await user.click(screen.getByRole('button', { name: 'Remove additional instructions' }));
    expect(screen.queryByRole('textbox', { name: 'additional instructions' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'directions' })).toHaveValue(
      'Take 9 mL by mouth twice daily for 10 days.'
    );
  });
});

describe('The line’s own calculator', () => {
  it('opens with the rule the line holds, its doses a day following the line’s frequency', async () => {
    const user = userEvent.setup();
    const line = liquidLine();
    const [row] = prescriptionSuggestionsFor({
      medication: line.medication!,
      weightKg: WEIGHT.kg,
      quickPicks: [{ ...CAPPED, dosing: { ...CAPPED.dosing!, maxPerDayMg: 1500 } }],
    });
    render(<Harness initial={row.apply(line, [])} weight={WEIGHT} />);
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    let calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(25);
    expect(within(calculator).getByRole('button', { name: 'per day or per dose: dose' })).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' })).toHaveValue(500);
    expect(within(calculator).getByRole('spinbutton', { name: 'maximum per day' })).toHaveValue(1500);
    expect(within(calculator).getByRole('button', { name: 'frequency: twice daily' })).toBeInTheDocument();
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 6 mL by mouth twice daily');
    await user.keyboard('{Escape}');

    // A new frequency on the line: the calculator opens on it, the rest of the rule stays.
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'three times daily' }));
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('button', { name: 'frequency: three times daily' })).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(25);
    expect(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' })).toHaveValue(500);
  });

  it('drops what was typed when closed without "Use this dose": each opening starts from the line’s rule', async () => {
    const user = userEvent.setup();
    const line = liquidLine();
    const [row] = prescriptionSuggestionsFor({
      medication: line.medication!,
      weightKg: WEIGHT.kg,
      quickPicks: [{ ...BY_WEIGHT, dosing: { ...BY_WEIGHT.dosing!, rate: 80, basis: 'mg/kg/day' } }],
    });
    render(<Harness initial={row.apply(line, [])} weight={WEIGHT} />);
    const typeRate = async (calculator: HTMLElement, rate: string): Promise<void> => {
      await user.clear(within(calculator).getByRole('spinbutton', { name: 'rate' }));
      await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), rate);
    };
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    let calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    await typeRate(calculator, '200');
    await user.keyboard('{Escape}');
    // Reopened as it was.
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(80);
    await typeRate(calculator, '200');
    await user.keyboard('{Escape}');

    // A frequency with no count, then reopened: the line's rule, its per-day rate waiting for a scheduled frequency.
    await user.click(screen.getByRole('button', { name: 'frequency: twice daily' }));
    await user.click(screen.getByRole('option', { name: 'as directed' }));
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(80);
    expect(within(calculator).getByText(UNSCHEDULED_MESSAGE)).toBeInTheDocument();
  });

  it('a suggestion row’s calculator drops what was typed too, reopening with its quick pick’s rule', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    const open = async (): Promise<HTMLElement> => {
      await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Dose calculator for Amox strep' }));
      return screen.getByRole('dialog', { name: 'Dose calculator' });
    };
    let calculator = await open();
    await user.clear(within(calculator).getByRole('spinbutton', { name: 'rate' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '40');
    await user.keyboard('{Escape}');
    calculator = await open();
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(25);
  });

  it('opens empty on a line with no rule, and drops what was typed, reopening empty', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} weight={WEIGHT} />);
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    let calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(null);
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '40');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(null);
  });
});

describe('The dose’s ⓘ on the line', () => {
  const lineOf = (quickPick: PrescriptionQuickPickData): PrescriptionLine => {
    const line = liquidLine();
    const [row] = prescriptionSuggestionsFor({
      medication: line.medication!,
      weightKg: WEIGHT.kg,
      quickPicks: [quickPick],
    });
    return row.apply(line, []);
  };
  const SOURCED: PrescriptionQuickPickData = {
    ...CAPPED,
    source: { label: 'AAP Red Book', url: 'https://example.org/redbook' },
  };

  it('shows right after a dosing suggestion: the working, the rounding and cap notes, the quick pick and its source', async () => {
    const user = userEvent.setup();
    render(<Harness initial={lineOf(SOURCED)} weight={WEIGHT} />);
    await user.hover(screen.getByRole('img', { name: 'How the dose was worked out' }));
    const note = await screen.findByTestId('dose-working-note');
    expect(note).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose');
    expect(note).toHaveTextContent('6 mL = 480 mg, 20 mg (4%) under 500 mg');
    expect(note).toHaveTextContent('Capped at the 500 mg maximum (703 mg by weight)');
    expect(note).toHaveTextContent('From the quick pick: Amox capped');
    expect(within(note).getByRole('link', { name: 'AAP Red Book' })).toHaveAttribute(
      'href',
      'https://example.org/redbook'
    );
  });

  it('says the measured dose once, the working then the rounding note', async () => {
    const user = userEvent.setup();
    const PER_DAY_LINE: PrescriptionQuickPickData = {
      ...BY_WEIGHT,
      dosing: { rate: 80, basis: 'mg/kg/day', frequency: 'twice daily', durationDays: 10 },
    };
    render(<Harness initial={lineOf(PER_DAY_LINE)} weight={WEIGHT} />);
    await user.hover(screen.getByRole('img', { name: 'How the dose was worked out' }));
    const note = await screen.findByTestId('dose-working-note');
    // 28.12 kg × 80 mg/kg/day ÷ 2 = 1124.8 mg, measured to 14 mL = 1120 mg.
    expect(note.textContent?.split('14 mL = 1120 mg')).toHaveLength(2);
    expect(note.children[0]).toHaveTextContent(/^28\.12 kg × 80 mg\/kg\/day ÷ 2 = 1124\.8 mg$/);
    expect(note.children[1]).toHaveTextContent(/^14 mL = 1120 mg, 4\.8 mg \(less than 1%\) under 1124\.8 mg$/);
  });

  it('shows after "Use this dose", without a quick pick; typing over the dose removes it', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withDirections(liquidLine(), { frequency: 'twice daily' })} weight={WEIGHT} />);
    expect(screen.queryByRole('img', { name: 'How the dose was worked out' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    await user.hover(screen.getByRole('img', { name: 'How the dose was worked out' }));
    const note = await screen.findByTestId('dose-working-note');
    expect(note).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg');
    expect(note).not.toHaveTextContent('From the quick pick');

    await user.clear(screen.getByRole('spinbutton', { name: 'dose' }));
    await user.type(screen.getByRole('spinbutton', { name: 'dose' }), '7');
    expect(screen.queryByRole('img', { name: 'How the dose was worked out' })).not.toBeInTheDocument();
  });
});

describe('The calculator’s "Measure to"', () => {
  const openCalculator = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
    await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
    return screen.getByRole('dialog', { name: 'Dose calculator' });
  };

  it('measures a liquid to 0.5 mL by default, to the step picked, and starts at 0.5 mL each opening', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withDirections(liquidLine(), { frequency: 'twice daily' })} weight={WEIGHT} />);
    let calculator = await openCalculator(user);
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    // 28.12 kg × 25 mg/kg/dose = 703 mg = 8.79 mL.
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 9 mL by mouth twice daily');
    await user.click(within(calculator).getByRole('button', { name: 'measure to: 0.5 mL' }));
    await user.click(screen.getByRole('option', { name: '0.1 mL' }));
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 8.8 mL by mouth twice daily');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(latest?.dose).toBe('8.8');
    // Not kept: the next opening measures to half a mL again.
    calculator = await openCalculator(user);
    expect(within(calculator).getByRole('button', { name: 'measure to: 0.5 mL' })).toBeInTheDocument();
    expect(within(calculator).getByTestId('dose-sentence')).toHaveTextContent('Take 9 mL by mouth twice daily');
  });

  it('is not offered for tablets or capsules, which stay whole', async () => {
    const user = userEvent.setup();
    const CAPSULES = { name: 'Amoxicillin', strengths: [detailed({ strength: '250 mg Cap', ndcs: ['00093310701'] })] };
    render(
      <Harness
        initial={withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
          frequency: 'twice daily',
        })}
        weight={WEIGHT}
      />
    );
    const calculator = await openCalculator(user);
    expect(within(calculator).queryByRole('button', { name: /^measure to/ })).not.toBeInTheDocument();
  });
});

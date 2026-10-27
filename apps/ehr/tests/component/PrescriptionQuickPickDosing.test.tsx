import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { describe, expect, it, vi } from 'vitest';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  prescriptionLineErrors,
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
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → 9 mL = 720 mg');
    expect(working).toHaveTextContent('9 mL = 720 mg, 17 mg (2%) over 703 mg');
    unmount();

    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={{ ...WEIGHT, kg: 12.4 }} />);
    row = suggestionRow(0);
    // 12.4 kg × 25 = 310 mg = 3.875 mL: the nearest half mL is 4 mL.
    expect(within(row).getByRole('button', { name: 'Dose: 4' })).toBeInTheDocument();
    working = await hoverInfo(user, row);
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
    const row = suggestionRow(0);
    // 703 mg is over 500 mg; 500 mg is 6.25 mL, and 6.5 mL would be over it.
    expect(within(row).getByRole('button', { name: 'Dose: 6' })).toBeInTheDocument();
    const working = await hoverInfo(user, row);
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → capped at 500 mg per dose → 6 mL = 480 mg');
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
      // Worked out again for the new dose, not the quick pick's saved 120 mL.
      quantityValue: '180',
      daysSupply: '10',
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

  it('opens an empty calculator ("Enter my own") from a quick pick without dosing; "Use this dose" uses the row with it', async () => {
    const user = userEvent.setup();
    const quickPick = { ...SAVED_TEXT, numberOfRefills: 2, substitutionAllowed: false, noteToPharmacy: 'Shake well' };
    render(<Harness initial={liquidLine()} quickPicks={[quickPick]} weight={WEIGHT} />);
    const row = suggestionRow(0);
    // The calculator starts the sentence here too.
    const icon = within(row).getByRole('button', { name: 'Dose calculator for Amox as written' });
    expect(icon.parentElement?.firstElementChild).toBe(icon);
    await user.click(icon);
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(within(calculator).getByRole('spinbutton', { name: 'concentration' })).toHaveValue(80);
    expect(within(calculator).getByRole('spinbutton', { name: 'rate' })).toHaveValue(null);
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '50');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'doses a day' }), '2');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    // 28.12 kg × 50 mg/kg/day ÷ 2 = 703 mg → 9 mL. The quick pick's saved 10-day supply becomes the duration
    // (withQuickPickDaysAsDuration, not yet confirmed), so the quantity is worked out again for the new dose: 9 mL × 2
    // a day × 10 days, not the quick pick's 100 mL of another dose. The rest is the quick pick's.
    expect(latest).toMatchObject({
      medication: PRODUCT,
      dose: '9',
      frequency: 'twice daily',
      durationDays: '10',
      quantityValue: '180',
      daysSupply: '10',
      numberOfRefills: '2',
      substitutionAllowed: false,
      noteToPharmacy: 'Shake well',
      dosing: { rate: 50, basis: 'mg/kg/day', dosesPerDay: 2 },
    });
    // The saved directions follow the new dose.
    expect(latest?.patientInstructions).toBe('Take 9 mL by mouth twice daily for 10 days.');

    // A new duration works them out again: 9 mL × 2 a day × 5 days.
    await user.clear(screen.getByRole('spinbutton', { name: 'duration' }));
    await user.type(screen.getByRole('spinbutton', { name: 'duration' }), '5');
    expect(latest).toMatchObject({ durationDays: '5', quantityValue: '90', daysSupply: '5' });
    // As needed, the quantity can't be worked out again.
    await user.click(screen.getByRole('button', { name: /^frequency: / }));
    await user.click(screen.getByRole('option', { name: 'as needed' }));
    expect(latest).toMatchObject({ frequency: 'as needed', quantityValue: '' });
  });

  it('leaves the duration, quantity and days supply empty after "Use this dose" when the quick pick saved no days supply', async () => {
    const user = userEvent.setup();
    const { daysSupply: _days, ...noDays } = SAVED_TEXT;
    render(<Harness initial={liquidLine()} quickPicks={[noDays]} weight={WEIGHT} />);
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Dose calculator for Amox as written' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '50');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'doses a day' }), '2');
    await user.click(within(calculator).getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '9', durationDays: '', quantityValue: '', daysSupply: '' });
  });

  it('takes a dose typed into the row as the provider’s own: the line keeps no settings', async () => {
    const user = userEvent.setup();
    render(<Harness initial={liquidLine()} quickPicks={[BY_WEIGHT]} weight={WEIGHT} />);
    const row = suggestionRow(0);
    await user.click(within(row).getByRole('button', { name: 'Dose: 9' }));
    const entry = screen.getByRole('spinbutton', { name: 'Dose' });
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
    dosing: { rate: 80, basis: 'mg/kg/day', dosesPerDay: 2, frequency: 'twice daily', durationDays: 10 },
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
    expect(await hoverInfo(user, row)).toHaveTextContent('28.12 kg × 80 mg/kg/day ÷ 3 = 749.87 mg → 9.5 mL = 760 mg');
    // The row's calculator opens on the new doses a day too.
    await user.click(within(row).getByRole('button', { name: 'Dose calculator for Amox per day' }));
    const calculator = screen.getByRole('dialog', { name: 'Dose calculator' });
    expect(within(calculator).getByRole('spinbutton', { name: 'doses a day' })).toHaveValue(3);
    expect(within(calculator).getByText('from three times daily')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await user.click(within(suggestionRow(0)).getByRole('button', { name: 'Use this prescription' }));
    expect(latest).toMatchObject({
      dose: '9.5',
      frequency: 'three times daily',
      patientInstructions: 'Take 9.5 mL by mouth three times daily for 10 days.',
      dosing: { rate: 80, basis: 'mg/kg/day', dosesPerDay: 3 },
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
    // Its doses a day name the frequency instead.
    expect(within(suggestionRow(0)).getByRole('button', { name: 'Frequency: twice daily' })).toBeInTheDocument();
  });

  it('a quick pick with dosing on a combination product leaves the dose to enter, with the note (pending dabrams)', async () => {
    const user = userEvent.setup();
    const augmentin = {
      name: 'Amoxicillin-Clavulanate',
      strengths: [{ strength: '400-57 mg/5ml Susp', ndcs: ['00093227573'] }],
    };
    const combo: PrescriptionQuickPickData = {
      ...BY_WEIGHT,
      id: 'qp-combo',
      name: 'Augmentin by weight',
      ndc: '00093227573',
      medicationDescription: 'Amoxicillin-Clavulanate 400-57 mg/5ml Susp',
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
    expect(await hoverInfo(user, row)).toHaveTextContent('Combination product: enter the dose directly');
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
    await user.click(screen.getByRole('button', { name: '+ quick pick (empty)' }));
    await user.click(within(screen.getByRole('listbox', { name: 'Quick pick' })).getByText(label));
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
    await choose(user, 'Amox strep, twice daily, 120 milliliter');
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
    await choose(user, 'Amox strep, twice daily, 120 milliliter');
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
    await choose(user, 'Amox strep, twice daily, 120 milliliter');
    await user.click(screen.getByRole('button', { name: 'frequency (empty)' }));
    await user.click(screen.getByRole('option', { name: 'four times daily' }));
    await typeDose(user, '20');
    expect(screen.queryByTestId('dose-warnings-warning')).not.toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  calculatorWeightKg,
  DoseCalculator,
  previousVisitWeightNote,
  UNSCHEDULED_MESSAGE,
  withDose,
} from '../../src/features/visits/in-person/components/erx/DoseCalculator';
import {
  CalculatorDosing,
  emptyPrescriptionLine,
  maximumWarnings,
  PrescriptionLine,
  withDirections,
  withProduct,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';
import { detailed } from './helpers/erxProducts';

const CAPSULES = { name: 'Amoxicillin', strengths: [detailed({ strength: '250 mg Cap', ndcs: ['00093310701'] })] };
const INHALER = { name: 'Albuterol', strengths: [detailed({ strength: '90 mcg/puff MDI', ndcs: ['00054074287'] })] };
const WEIGHT: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };

let latest: PrescriptionLine | undefined;
const Harness = ({
  initial,
  weight,
  dosing,
}: {
  initial: PrescriptionLine;
  weight?: VisitWeight;
  dosing?: CalculatorDosing;
}): JSX.Element => {
  const [line, setLine] = useState(initial);
  const [weightText, setWeightText] = useState<string>();
  latest = line;
  return (
    <DoseCalculator
      line={line}
      weight={weight}
      weightText={weightText}
      onWeightText={setWeightText}
      onChange={setLine}
      initial={dosing}
    />
  );
};

const pickFrequency = async (
  user: ReturnType<typeof userEvent.setup>,
  calculator: HTMLElement,
  frequency: string
): Promise<void> => {
  await user.click(within(calculator).getByRole('button', { name: /^frequency/ }));
  await user.click(screen.getByRole('option', { name: frequency }));
};

const openCalculator = async (user: ReturnType<typeof userEvent.setup>): Promise<HTMLElement> => {
  await user.click(screen.getByRole('button', { name: 'Dose calculator' }));
  return screen.getByRole('dialog', { name: 'Dose calculator' });
};

describe('DoseCalculator (plain, inline)', () => {
  it('opens only from its icon, from the vitals weight, the product strength and the line’s frequency', async () => {
    const user = userEvent.setup();
    const initial = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'twice daily',
    });
    render(<Harness initial={initial} weight={{ ...WEIGHT, thisVisit: false }} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const calculator = await openCalculator(user);
    expect(within(calculator).getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(within(calculator).getByText(/^previous visit, /)).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'strength' })).toHaveValue(250);
    expect(within(calculator).queryByText('from the product')).not.toBeInTheDocument();
    expect(within(calculator).getByRole('button', { name: 'frequency: twice daily' })).toBeInTheDocument();
    // A frequency with a count is the doses a day: nothing to type.
    expect(within(calculator).queryByRole('spinbutton', { name: 'doses a day' })).not.toBeInTheDocument();
    expect(within(calculator).getByText('Enter a rate to work out the dose')).toBeInTheDocument();
    expect(within(calculator).queryByRole('button', { name: 'Use this dose' })).not.toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openCalculator(user);
    await user.click(document.body);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('writes the result as the line’s sentence, keeps the working behind the ⓘ, and "Use this dose" fills the line', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    // Escape in a pick-list inside the calculator closes only the pick-list.
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('option', { name: 'dose' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Dose calculator' })).toBeInTheDocument();
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    expect(screen.getByRole('dialog', { name: 'Dose calculator' })).toBeInTheDocument();
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    // Per dose, any frequency (or none) works it out.
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth.');
    await pickFrequency(user, calculator, 'twice daily');
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth twice daily.');
    // The working and the rounding note aren't on show until the ⓘ is hovered.
    expect(screen.queryByText('28.12 kg × 25 mg/kg/dose = 703 mg')).not.toBeInTheDocument();
    await user.hover(screen.getByRole('img', { name: 'How this dose was worked out' }));
    const working = await screen.findByTestId('dose-working');
    // The working first, then the rounding note, as the line's ⓘ reads.
    expect(working.children[0]).toHaveTextContent(/^28\.12 kg × 25 mg\/kg\/dose = 703 mg$/);
    expect(working.children[1]).toHaveTextContent(/^3 capsules = 750 mg, 47 mg \(7%\) over 703 mg$/);

    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '3', frequency: 'twice daily', quantityUnit: 'Capsule' });
    expect(latest?.patientInstructions).toBe('Take 3 capsules by mouth twice daily.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says under the result when a maximum caps the dose, per dose or per day, and keeps the working behind the ⓘ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '90');
    // A per-day rate needs the frequency.
    expect(within(calculator).getByText('Enter the frequency to work out the dose')).toBeInTheDocument();
    await pickFrequency(user, calculator, 'twice daily');
    expect(within(calculator).queryByTestId('dose-cap')).not.toBeInTheDocument();
    // 28.12 kg × 90 mg/kg/day = 2,530.8 mg a day: over 1,000 mg a day, so 500 mg a dose = 2 capsules.
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per day' }), '1000');
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 2 capsules by mouth twice daily.');
    expect(within(calculator).getByTestId('dose-cap')).toHaveTextContent(
      'Capped at the 1,000 mg a day maximum (2,530.8 mg a day by weight)'
    );
    // The per-dose maximum is the lower one now.
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '250');
    expect(within(calculator).getByTestId('dose-cap')).toHaveTextContent(
      'Capped at the 250 mg maximum (1,265.4 mg by weight)'
    );
    await user.hover(screen.getByRole('img', { name: 'How this dose was worked out' }));
    expect(await screen.findByTestId('dose-working')).toHaveTextContent(
      '28.12 kg × 90 mg/kg/day ÷ 2 = 1265.4 mg → capped at 250 mg per dose → 1 capsule = 250 mg'
    );
  });

  it('keeps its size while values change: waiting, a result, a capped result, the weight row gone', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    const card = screen.getByTestId('dose-calculator');
    const size = (): string[] => [getComputedStyle(card).width, getComputedStyle(card).height];
    const before = size();
    expect(before).toEqual(['340px', expect.stringMatching(/^\d+px$/)]);
    expect(card).toHaveAttribute('data-look', 'waiting');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '90');
    await pickFrequency(user, calculator, 'twice daily');
    expect(card).toHaveAttribute('data-look', 'own');
    expect(screen.getByRole('button', { name: 'Use this dose' })).toBeInTheDocument();
    expect(size()).toEqual(before);
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per day' }), '1000');
    expect(within(calculator).getByTestId('dose-cap')).toBeInTheDocument();
    expect(size()).toEqual(before);
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose, not by weight' }));
    expect(within(calculator).queryByRole('spinbutton', { name: 'weight' })).not.toBeInTheDocument();
    expect(size()).toEqual(before);
    await user.clear(within(calculator).getByRole('spinbutton', { name: 'rate' }));
    expect(card).toHaveAttribute('data-look', 'waiting');
    expect(size()).toEqual(before);
  });

  it('writes the frequency it is given over the line’s, and keeps the line’s without one', () => {
    const line = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'every 8 hours as needed',
      steps: [{ dose: '1', frequency: 'once daily', durationDays: '2' }],
      durationDays: '3',
    });
    expect(withDose(line, { dose: '2', frequency: 'three times daily' })).toMatchObject({
      dose: '2',
      frequency: 'three times daily',
      steps: [],
      durationDays: '',
    });
    expect(withDose(line, { dose: '2' }).frequency).toBe('every 8 hours as needed');
    const course = withDose(line, {
      dose: '7',
      frequency: 'once daily',
      durationDays: '1',
      steps: [{ dose: '3.5', frequency: 'once daily', durationDays: '4' }],
    });
    expect(course).toMatchObject({ dose: '7', durationDays: '1', steps: [{ dose: '3.5', durationDays: '4' }] });
  });

  it('takes the doses a day from the frequency picked, over a quick pick’s, and writes it only with the dose', async () => {
    const user = userEvent.setup();
    const initial = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'three times daily',
    });
    render(<Harness initial={initial} weight={WEIGHT} dosing={{ rate: 75, basis: 'mg/kg/day' }} />);
    let calculator = await openCalculator(user);
    // 28.12 kg × 75 mg/kg/day ÷ 3 = 703 mg → 3 capsules.
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth three times daily.');

    // A new frequency works the dose out again at once; the line keeps its own until "Use this dose".
    await user.click(within(calculator).getByRole('button', { name: 'frequency: three times daily' }));
    await user.click(screen.getByRole('option', { name: 'twice daily' }));
    // 28.12 kg × 75 mg/kg/day ÷ 2 = 1,054.5 mg → 4 capsules.
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 4 capsules by mouth twice daily.');
    expect(latest?.frequency).toBe('three times daily');

    // Closed without using it: the line is as it was, and the calculator opens on the line's frequency again.
    await user.keyboard('{Escape}');
    expect(latest).toMatchObject({ dose: '', frequency: 'three times daily' });
    calculator = await openCalculator(user);
    expect(within(calculator).getByRole('button', { name: 'frequency: three times daily' })).toBeInTheDocument();
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth three times daily.');

    await user.click(within(calculator).getByRole('button', { name: 'frequency: three times daily' }));
    await user.click(screen.getByRole('option', { name: 'twice daily' }));
    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '4', frequency: 'twice daily' });
    expect(latest?.patientInstructions).toBe('Take 4 capsules by mouth twice daily.');
  });

  it('keeps "every 6 hours as needed" when its dose is used', async () => {
    const user = userEvent.setup();
    const initial = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'every 6 hours as needed',
    });
    render(<Harness initial={initial} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    expect(within(calculator).queryByRole('spinbutton', { name: 'doses a day' })).not.toBeInTheDocument();
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '100');
    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '3', frequency: 'every 6 hours as needed' });
  });

  it('waits for a scheduled frequency to divide a per-day rate with "as directed"; per dose it keeps its words', async () => {
    const user = userEvent.setup();
    const initial = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'as directed',
    });
    render(<Harness initial={initial} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    expect(within(calculator).getByRole('button', { name: 'frequency: as directed' })).toBeInTheDocument();
    expect(within(calculator).queryByRole('spinbutton', { name: 'doses a day' })).not.toBeInTheDocument();
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '75');
    expect(within(calculator).getByText(UNSCHEDULED_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this dose' })).not.toBeInTheDocument();
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.clear(within(calculator).getByRole('spinbutton', { name: 'rate' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '25');
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth as directed.');
    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '3', frequency: 'as directed' });
  });

  it('doses a combination product by the ingredient the provider picks, each time', async () => {
    const user = userEvent.setup();
    const augmentin = {
      name: 'Amoxicillin-Clavulanate',
      strengths: [detailed({ strength: '400-57 mg/5ml Susp', ndcs: ['00093227573'] })],
    };
    const initial = withDirections(withProduct(emptyPrescriptionLine(), augmentin, augmentin.strengths[0]), {
      frequency: 'twice daily',
    });
    render(<Harness initial={initial} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '45');
    expect(within(calculator).getByRole('spinbutton', { name: 'concentration' })).toHaveValue(null);
    expect(calculator).toHaveTextContent('Enter the ingredient to dose by and the concentration to work out the dose');
    expect(within(calculator).queryByRole('button', { name: 'Use this dose' })).not.toBeInTheDocument();

    await user.click(within(calculator).getByRole('button', { name: /^dose by/ }));
    expect(screen.getByRole('option', { name: 'clavulanate 11.4 mg/mL' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'amoxicillin 80 mg/mL' }));
    expect(within(calculator).getByRole('spinbutton', { name: 'concentration' })).toHaveValue(80);
    // 28.12 kg × 45 mg/kg/day ÷ 2 = 632.7 mg of amoxicillin → 8 mL = 640 mg.
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 8 mL by mouth twice daily.');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '500');
    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '6', doseBy: 'amoxicillin', maximum: { maxPerDoseMg: 500 } });
    // The choice isn't the quick pick's: its dosing has no ingredient.
    expect(latest?.dosing).not.toHaveProperty('doseBy');
    // A dose typed over it is checked against the amoxicillin maximum.
    expect(maximumWarnings({ ...latest!, dose: '10' })).toEqual([
      { blank: 'dose', text: '800 mg per dose is above the 500 mg maximum.' },
    ]);
  });

  it('says when a product has no strength details, and guesses nothing', async () => {
    const user = userEvent.setup();
    const bare = { name: 'Amoxicillin', strengths: [{ strength: '250 mg Cap', ndcs: ['00093310701'] }] };
    render(<Harness initial={withProduct(emptyPrescriptionLine(), bare, bare.strengths[0])} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    expect(calculator).toHaveTextContent('Strength details unavailable: enter the dose directly');
    expect(within(calculator).queryByRole('spinbutton', { name: 'strength' })).not.toBeInTheDocument();
  });

  it('gives one capsule when the maximum is under one, says it is above the maximum, and the line warns', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    const calculator = await openCalculator(user);
    // A capsule's strength is per capsule.
    expect(within(calculator).getByRole('spinbutton', { name: 'strength' })).toHaveValue(250);
    expect(calculator).toHaveTextContent('mg per capsule');
    await user.click(within(calculator).getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose, not by weight' }));
    await user.type(within(calculator).getByRole('spinbutton', { name: 'rate' }), '200');
    await user.type(within(calculator).getByRole('spinbutton', { name: 'maximum per dose' }), '100');
    expect(within(calculator).getByTestId('dose-cap')).toHaveTextContent(
      '1 capsule = 250 mg, above the 100 mg maximum; the smallest measurable amount'
    );
    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest?.dose).toBe('1');
    expect(maximumWarnings(latest!)).toEqual([{ blank: 'dose', text: '250 mg per dose is above the 100 mg maximum.' }]);
  });

  it('says what it is not for', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), INHALER, INHALER.strengths[0])} />);
    const calculator = await openCalculator(user);
    expect(calculator).toHaveTextContent('Not for this dose form: liquids, tablets and capsules only');
  });

  it('notes an earlier visit’s weight for the suggestions, and a typed weight wins', () => {
    const previous = { ...WEIGHT, thisVisit: false };
    expect(previousVisitWeightNote(undefined, previous)).toMatch(/^using weight 28.12 kg \(previous visit, /);
    expect(previousVisitWeightNote(undefined, WEIGHT)).toBeUndefined();
    expect(previousVisitWeightNote('30', previous)).toBeUndefined();
    expect(calculatorWeightKg('30', previous)).toBe(30);
    expect(calculatorWeightKg(undefined, previous)).toBe(28.12);
  });
});

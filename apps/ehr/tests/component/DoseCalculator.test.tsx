import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  calculatorWeightKg,
  DoseCalculator,
  previousVisitWeightNote,
  withDose,
} from '../../src/features/visits/in-person/components/erx/DoseCalculator';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
  withDirections,
  withProduct,
} from '../../src/features/visits/in-person/components/erx/prescriptionLines';
import { VisitWeight } from '../../src/features/visits/in-person/components/erx/useVisitWeight';

const CAPSULES = { name: 'Amoxicillin', strengths: [{ strength: '250 mg Cap', ndcs: ['00093310701'] }] };
const INHALER = { name: 'Albuterol', strengths: [{ strength: '90 mcg/puff MDI', ndcs: ['00054074287'] }] };
const WEIGHT: VisitWeight = { kg: 28.12, takenAt: '2026-10-08T14:00:00Z', thisVisit: true };

let latest: PrescriptionLine | undefined;
const Harness = ({ initial, weight }: { initial: PrescriptionLine; weight?: VisitWeight }): JSX.Element => {
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
    />
  );
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
    expect(within(calculator).getByText('from the product')).toBeInTheDocument();
    expect(within(calculator).getByRole('spinbutton', { name: 'doses a day' })).toHaveValue(2);
    expect(within(calculator).getByText('from twice daily')).toBeInTheDocument();
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
    await user.type(within(calculator).getByRole('spinbutton', { name: 'doses a day' }), '2');
    expect(screen.getByTestId('dose-sentence')).toHaveTextContent('Take 3 capsules by mouth twice daily.');
    // The working and the rounding note aren't on show until the ⓘ is hovered.
    expect(screen.queryByText('28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg')).not.toBeInTheDocument();
    await user.hover(screen.getByRole('img', { name: 'How this dose was worked out' }));
    const working = await screen.findByTestId('dose-working');
    expect(working).toHaveTextContent('3 capsules = 750 mg, 47 mg (7%) over 703 mg');
    expect(working).toHaveTextContent('28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg');

    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '3', frequency: 'twice daily', quantityUnit: 'Capsule' });
    expect(latest?.patientInstructions).toBe('Take 3 capsules by mouth twice daily.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the line’s frequency unless the doses a day were typed', () => {
    const line = withDirections(withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0]), {
      frequency: 'every 8 hours as needed',
      steps: [{ dose: '1', frequency: 'once daily', durationDays: '2' }],
      durationDays: '3',
    });
    expect(withDose(line, { dose: '2', frequency: 'three times daily' })).toMatchObject({
      dose: '2',
      frequency: 'every 8 hours as needed',
      steps: [],
      durationDays: '',
    });
    expect(withDose(line, { dose: '2', frequency: 'twice daily', replaceFrequency: true }).frequency).toBe(
      'twice daily'
    );
    expect(withDose({ ...line, frequency: '' }, { dose: '2', frequency: 'twice daily' }).frequency).toBe('twice daily');
    const course = withDose(line, {
      dose: '7',
      frequency: 'once daily',
      durationDays: '1',
      steps: [{ dose: '3.5', frequency: 'once daily', durationDays: '4' }],
    });
    expect(course).toMatchObject({ dose: '7', durationDays: '1', steps: [{ dose: '3.5', durationDays: '4' }] });
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

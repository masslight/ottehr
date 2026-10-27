import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import {
  calculatorWeightKg,
  DoseCalculator,
  previousVisitWeightNote,
} from '../../src/features/visits/in-person/components/erx/DoseCalculator';
import {
  emptyPrescriptionLine,
  PrescriptionLine,
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
      readOnly={false}
    />
  );
};

describe('DoseCalculator (plain)', () => {
  it('starts from the vitals weight and the product strength, and waits for a rate', () => {
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    expect(screen.getByRole('button', { name: 'regimen: Enter my own' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'weight' })).toHaveValue(28.12);
    expect(screen.getByText(/^this visit, /)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'strength' })).toHaveValue(250);
    expect(screen.getByText('from the product')).toBeInTheDocument();
    expect(screen.getByText('Enter a rate and the doses a day to work out the dose')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Use this dose' })).not.toBeInTheDocument();
  });

  it('works out and rounds the dose with a note, and "Use this dose" writes it into the line', async () => {
    const user = userEvent.setup();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), CAPSULES, CAPSULES.strengths[0])} weight={WEIGHT} />);
    await user.click(screen.getByRole('button', { name: 'per day or per dose: day' }));
    await user.click(screen.getByRole('option', { name: 'dose' }));
    await user.type(screen.getByRole('spinbutton', { name: 'rate' }), '25');
    await user.type(screen.getByRole('spinbutton', { name: 'doses a day' }), '2');
    expect(screen.getByText('28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg')).toBeInTheDocument();
    expect(screen.getByTestId('dose-rounding-note')).toHaveTextContent('3 capsules = 750 mg, 47 mg (7%) over 703 mg');
    expect(screen.getByTestId('dose-result')).toHaveTextContent('3 capsulestwice daily');

    await user.click(screen.getByRole('button', { name: 'Use this dose' }));
    expect(latest).toMatchObject({ dose: '3', frequency: 'twice daily' });
    expect(latest?.patientInstructions).toBe('Take 3 capsules by mouth twice daily.');
  });

  it('says what it is not for', () => {
    const { unmount } = render(<Harness initial={emptyPrescriptionLine()} />);
    expect(screen.getByText('Pick a medication')).toBeInTheDocument();
    unmount();
    render(<Harness initial={withProduct(emptyPrescriptionLine(), INHALER, INHALER.strengths[0])} />);
    expect(screen.getByText('Not for this dose form: liquids, tablets and capsules only')).toBeInTheDocument();
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

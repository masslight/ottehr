import { roundNumberToDecimalPlaces } from '../../utils/convert';
import { doseAmountText } from './prescription-suggestions';

/**
 * The plain dose calculator's arithmetic: weight × rate (÷ doses a day), turned into the product's measure from its
 * strength and rounded to the nearest amount that can be measured. Nothing here knows a drug: no ranges, limits or
 * sources. The rounding never blocks; it says how far the measured dose is from the one worked out.
 */

/** What one measure of the product is: a mL of a liquid or one tablet or capsule. */
export type DoseMeasure = 'mL' | 'tablet' | 'capsule';

/** How the rate is given: per kg per day, per kg per dose, or a dose in mg not by weight. */
export type DoseBasis = 'mg/kg/day' | 'mg/kg/dose' | 'fixed';

/** The amount a dose is measured to: half a mL, a whole tablet, a whole capsule. */
export const DOSE_STEP: Record<DoseMeasure, number> = { mL: 0.5, tablet: 1, capsule: 1 };

export interface PlainDoseInput {
  weightKg?: number;
  /** mg in one measure: per mL of a liquid, per tablet or capsule. */
  mgPerMeasure?: number;
  measure: DoseMeasure;
  basis: DoseBasis;
  rate?: number;
  dosesPerDay?: number;
}

export interface PlainDose {
  /** Measures per dose: 4.5 (mL), 3 (capsules). */
  amount: number;
  /** "3 capsules", "4.5 mL". */
  amountText: string;
  /** "28.12 kg × 25 mg/kg/dose = 703 mg → 3 capsules = 750 mg". */
  working: string;
  /** "3 capsules = 750 mg, 47 mg (7%) over 703 mg"; none when the measured dose is the one worked out. */
  roundingNote?: string;
}

const num = (value: number): string => String(roundNumberToDecimalPlaces(value, 2));

/** The nearest amount of the product that can be measured for the mg, at least one step: a dose is never rounded
 * away to nothing. */
export const nearestMeasurable = (mg: number, mgPerMeasure: number, measure: DoseMeasure): number => {
  const step = DOSE_STEP[measure];
  return Math.max(step, roundNumberToDecimalPlaces(Math.round(mg / mgPerMeasure / step) * step, 3));
};

/** How far a measured dose lands from the mg aimed at: "3 capsules = 750 mg, 47 mg (7%) over 703 mg"; none when it
 * is the same to 0.1 mg. */
export const doseRoundingNote = (amountText: string, deliveredMg: number, aimedMg: number): string | undefined => {
  const difference = roundNumberToDecimalPlaces(deliveredMg - aimedMg, 1);
  if (difference === 0) return undefined;
  const percent = Math.round((Math.abs(difference) / aimedMg) * 100);
  return `${amountText} = ${num(deliveredMg)} mg, ${num(Math.abs(difference))} mg (${percent}%) ${
    difference > 0 ? 'over' : 'under'
  } ${num(aimedMg)} mg`;
};

/** The dose for the inputs, or nothing until every input it needs is there. */
export const plainDose = ({
  weightKg,
  mgPerMeasure,
  measure,
  basis,
  rate,
  dosesPerDay,
}: PlainDoseInput): PlainDose | undefined => {
  if (!mgPerMeasure || !rate) return undefined;
  if (basis !== 'fixed' && !weightKg) return undefined;
  if (basis === 'mg/kg/day' && !dosesPerDay) return undefined;
  const kg = weightKg ?? 0;
  const aimed = roundNumberToDecimalPlaces(
    basis === 'fixed' ? rate : basis === 'mg/kg/dose' ? kg * rate : (kg * rate) / (dosesPerDay ?? 1),
    2
  );
  const amount = nearestMeasurable(aimed, mgPerMeasure, measure);
  const amountText = doseAmountText(amount, measure);
  const delivered = roundNumberToDecimalPlaces(amount * mgPerMeasure, 2);
  const formula =
    basis === 'fixed'
      ? `${num(aimed)} mg`
      : basis === 'mg/kg/dose'
      ? `${num(kg)} kg × ${num(rate)} mg/kg/dose = ${num(aimed)} mg`
      : `${num(kg)} kg × ${num(rate)} mg/kg/day ÷ ${num(dosesPerDay ?? 1)} = ${num(aimed)} mg`;
  return {
    amount,
    amountText,
    working: `${formula} → ${amountText} = ${num(delivered)} mg`,
    roundingNote: doseRoundingNote(amountText, delivered, aimed),
  };
};

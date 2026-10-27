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
export const DOSE_BASES = ['mg/kg/day', 'mg/kg/dose', 'fixed'] as const;
export type DoseBasis = (typeof DOSE_BASES)[number];

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
  /** Optional maxima: a dose over one is capped, and measured down so it stays at or under it. A per-day maximum
   * needs the doses a day. */
  maxPerDoseMg?: number;
  maxPerDayMg?: number;
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

/** The mg a dose may not go over, and how the hover says so: the lower of the per-dose maximum and the per-day
 * maximum over the doses a day. */
const doseCap = (
  maxPerDoseMg: number | undefined,
  maxPerDayMg: number | undefined,
  dosesPerDay: number | undefined
): { mg: number; text: string } | undefined => {
  const perDay = maxPerDayMg && dosesPerDay ? roundNumberToDecimalPlaces(maxPerDayMg / dosesPerDay, 2) : undefined;
  if (maxPerDoseMg && (perDay === undefined || maxPerDoseMg <= perDay)) {
    return { mg: maxPerDoseMg, text: `${num(maxPerDoseMg)} mg per dose` };
  }
  return perDay === undefined || !maxPerDayMg
    ? undefined
    : {
        mg: perDay,
        text: `${num(maxPerDayMg)} mg per day (${num(perDay)} mg per dose at ${num(dosesPerDay ?? 1)} a day)`,
      };
};

/** The dose for the inputs, or nothing until every input it needs is there. */
export const plainDose = ({
  weightKg,
  mgPerMeasure,
  measure,
  basis,
  rate,
  dosesPerDay,
  maxPerDoseMg,
  maxPerDayMg,
}: PlainDoseInput): PlainDose | undefined => {
  if (!mgPerMeasure || !rate) return undefined;
  if (basis !== 'fixed' && !weightKg) return undefined;
  if ((basis === 'mg/kg/day' || maxPerDayMg) && !dosesPerDay) return undefined;
  const kg = weightKg ?? 0;
  const worked = roundNumberToDecimalPlaces(
    basis === 'fixed' ? rate : basis === 'mg/kg/dose' ? kg * rate : (kg * rate) / (dosesPerDay ?? 1),
    2
  );
  const cap = doseCap(maxPerDoseMg, maxPerDayMg, dosesPerDay);
  const capMg = cap?.mg ?? Infinity;
  const capped = worked > capMg;
  const aimed = capped ? capMg : worked;
  const nearest = nearestMeasurable(aimed, mgPerMeasure, measure);
  // Under a maximum the dose is measured down, never up past it (still at least one step).
  const step = DOSE_STEP[measure];
  const roundedDown = nearest * mgPerMeasure > capMg + 1e-9;
  const amount = roundedDown
    ? Math.max(step, roundNumberToDecimalPlaces(Math.floor(capMg / mgPerMeasure / step + 1e-9) * step, 3))
    : nearest;
  const amountText = doseAmountText(amount, measure);
  const delivered = roundNumberToDecimalPlaces(amount * mgPerMeasure, 2);
  const formula =
    basis === 'fixed'
      ? `${num(worked)} mg`
      : basis === 'mg/kg/dose'
      ? `${num(kg)} kg × ${num(rate)} mg/kg/dose = ${num(worked)} mg`
      : `${num(kg)} kg × ${num(rate)} mg/kg/day ÷ ${num(dosesPerDay ?? 1)} = ${num(worked)} mg`;
  const note = doseRoundingNote(amountText, delivered, aimed);
  const capText = cap?.text ?? '';
  return {
    amount,
    amountText,
    working: `${formula}${capped ? ` → capped at ${capText}` : ''} → ${amountText} = ${num(delivered)} mg`,
    roundingNote:
      note && roundedDown && delivered <= capMg
        ? `${note} (rounded down to stay at or under the max ${capText})`
        : note,
  };
};

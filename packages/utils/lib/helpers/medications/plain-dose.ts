import { roundNumberToDecimalPlaces } from '../../utils/convert';
import {
  doseAmountText,
  PrescriptionDoseForm,
  prescriptionDoseForm,
  prescriptionDoseUnit,
  PrescriptionProduct,
} from './prescription-suggestions';

/**
 * The plain dose calculator's arithmetic: weight × rate (÷ doses a day), turned into the product's measure from its
 * strength and rounded to the nearest amount that can be measured. Nothing here knows a drug: no ranges, limits or
 * sources. The rounding never blocks; it says how far the measured dose is from the one worked out.
 */

/** What one measure of the product is: a mL of a liquid or one tablet or capsule. */
export type DoseMeasure = 'mL' | 'tablet' | 'capsule';

/** The forms the calculator measures a dose in; anything else (an inhaler, a cream) it leaves alone. */
const MEASURE_OF: Partial<Record<PrescriptionDoseForm, DoseMeasure>> = {
  liquid: 'mL',
  tablet: 'tablet',
  capsule: 'capsule',
};

/** The measure the calculator doses a product in, when its dose form is one it measures and a dose is counted in it:
 * drops are a liquid, but counted in drops, so never read as mL (as puffs aren't). */
export const measureOf = (product: PrescriptionProduct | null | undefined): DoseMeasure | undefined => {
  const form = prescriptionDoseForm(product);
  const measure = form && MEASURE_OF[form];
  return measure && prescriptionDoseUnit(product) === measure ? measure : undefined;
};

/** How the rate is given: per kg per day, per kg per dose, or a dose in mg not by weight. */
export const DOSE_BASES = ['mg/kg/day', 'mg/kg/dose', 'fixed'] as const;
export type DoseBasis = (typeof DOSE_BASES)[number];

/** The amount a dose is measured to: half a mL, a whole tablet, a whole capsule. */
export const DOSE_STEP: Record<DoseMeasure, number> = { mL: 0.5, tablet: 1, capsule: 1 };

/** The amounts a liquid's dose can be measured to, for the calculator's "Measure to"; tablets and capsules stay whole. */
export const ML_MEASURE_STEPS = [0.1, 0.5, 1] as const;

export interface PlainDoseInput {
  weightKg?: number;
  /** mg in one measure: per mL of a liquid, per tablet or capsule. */
  mgPerMeasure?: number;
  measure: DoseMeasure;
  /** The amount to measure to, in place of the measure's `DOSE_STEP` (a liquid's "Measure to"). */
  step?: number;
  basis: DoseBasis;
  rate?: number;
  dosesPerDay?: number;
  /** Optional maxima: a dose over one is capped, and measured down so it stays at or under it. A per-day maximum
   * is checked only with the doses a day. */
  maxPerDoseMg?: number;
  maxPerDayMg?: number;
}

export interface PlainDose {
  /** Measures per dose: 4.5 (mL), 3 (capsules). */
  amount: number;
  /** "3 capsules", "4.5 mL". */
  amountText: string;
  /** "28.12 kg × 25 mg/kg/dose = 703 mg", and "→ 2 capsules = 500 mg" after it only when there is no rounding note:
   * the note then says what it is measured to. */
  working: string;
  /** "3 capsules = 750 mg, 47 mg (7%) over 703 mg"; none when the measured dose is the one worked out. */
  roundingNote?: string;
  /** Shown under the result when a maximum stopped the dose: "Capped at the 500 mg maximum (703 mg by weight)"; or,
   * when even the smallest measurable amount is over it, that it is above the maximum. */
  capNote?: string;
  /** Shown under the result too, not only behind the ⓘ, when the measured dose is more than 5% over or under the one
   * worked out (a small dose measured up to the smallest step, or to a whole tablet): the rounding note. The Pediatric
   * Pharmacy Association rounds within 5% to 10% of the calculated weight-based dose. */
  roundingWarning?: string;
}

/** "1,920 mg": mg as the warnings read them, to 0.01 mg with thousands separators. */
export const mgText = (mg: number): string =>
  `${roundNumberToDecimalPlaces(mg, 2).toLocaleString('en-US', { maximumFractionDigits: 2 })} mg`;

const num = (value: number): string => String(roundNumberToDecimalPlaces(value, 2));

/** The nearest amount of the product that can be measured for the mg, at least one step: a dose is never rounded
 * away to nothing. */
export const nearestMeasurable = (
  mg: number,
  mgPerMeasure: number,
  measure: DoseMeasure,
  step = DOSE_STEP[measure]
): number => {
  return Math.max(step, roundNumberToDecimalPlaces(Math.round(mg / mgPerMeasure / step) * step, 3));
};

/** How far a measured dose lands from the mg aimed at: "3 capsules = 750 mg, 47 mg (7%) over 703 mg", "(less than 1%)"
 * where the percent rounds to 0; none when it is the same to 0.1 mg. */
export const doseRoundingNote = (amountText: string, deliveredMg: number, aimedMg: number): string | undefined => {
  const difference = roundNumberToDecimalPlaces(deliveredMg - aimedMg, 1);
  if (difference === 0) return undefined;
  const percent = Math.round((Math.abs(difference) / aimedMg) * 100);
  return `${amountText} = ${num(deliveredMg)} mg, ${num(Math.abs(difference))} mg (${
    percent === 0 ? 'less than 1' : percent
  }%) ${difference > 0 ? 'over' : 'under'} ${num(aimedMg)} mg`;
};

/** The doses given on a day the medication is taken: one for a frequency under one a day ("every other day"), so a
 * per-day rate or maximum is that day's amount, as alternate-day doses are written. */
export const dosesOnDosingDay = (dosesPerDay: number | undefined): number | undefined =>
  dosesPerDay === undefined ? undefined : Math.max(dosesPerDay, 1);

/** The mg a dose may not go over, and how the hover says so: the lower of the per-dose maximum and the per-day
 * maximum over the doses a day. */
const doseCap = (
  maxPerDoseMg: number | undefined,
  maxPerDayMg: number | undefined,
  dosesPerDay: number | undefined
): { mg: number; text: string; perDay: boolean } | undefined => {
  const perDay = maxPerDayMg && dosesPerDay ? roundNumberToDecimalPlaces(maxPerDayMg / dosesPerDay, 2) : undefined;
  if (maxPerDoseMg && (perDay === undefined || maxPerDoseMg <= perDay)) {
    return { mg: maxPerDoseMg, text: `${num(maxPerDoseMg)} mg per dose`, perDay: false };
  }
  return perDay === undefined || !maxPerDayMg
    ? undefined
    : {
        mg: perDay,
        text: `${num(maxPerDayMg)} mg per day (${num(perDay)} mg per dose at ${num(dosesPerDay ?? 1)} a day)`,
        perDay: true,
      };
};

/** The dose for the inputs, or nothing until every input it needs is there. */
export const plainDose = ({
  weightKg,
  mgPerMeasure,
  measure,
  step = DOSE_STEP[measure],
  basis,
  rate,
  dosesPerDay,
  maxPerDoseMg,
  maxPerDayMg,
}: PlainDoseInput): PlainDose | undefined => {
  if (!mgPerMeasure || !rate) return undefined;
  if (basis !== 'fixed' && !weightKg) return undefined;
  if (basis === 'mg/kg/day' && !dosesPerDay) return undefined;
  const kg = weightKg ?? 0;
  const perDay = dosesOnDosingDay(dosesPerDay);
  const worked = roundNumberToDecimalPlaces(
    basis === 'fixed' ? rate : basis === 'mg/kg/dose' ? kg * rate : (kg * rate) / (perDay ?? 1),
    2
  );
  const cap = doseCap(maxPerDoseMg, maxPerDayMg, perDay);
  const capMg = cap?.mg ?? Infinity;
  const capped = worked > capMg;
  const aimed = capped ? capMg : worked;
  const nearest = nearestMeasurable(aimed, mgPerMeasure, measure, step);
  // Under a maximum the dose is measured down, never up past it (still at least one step).
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
      : `${num(kg)} kg × ${num(rate)} mg/kg/day ÷ ${num(perDay ?? 1)} = ${num(worked)} mg`;
  const note = doseRoundingNote(amountText, delivered, aimed);
  const capText = cap?.text ?? '';
  const how = basis === 'fixed' ? 'as entered' : 'by weight';
  // Never blocks: below one measurable amount the dose is that amount, said to be above the maximum.
  const aboveMax = delivered > capMg + 1e-9;
  const capNote = aboveMax
    ? `${amountText} = ${mgText(delivered)}, above the ${
        cap?.perDay
          ? `${mgText(maxPerDayMg ?? 0)} a day maximum (${mgText(capMg)} per dose)`
          : `${mgText(capMg)} maximum`
      }; the smallest measurable amount`
    : !capped
    ? undefined
    : cap?.perDay
    ? `Capped at the ${mgText(maxPerDayMg ?? 0)} a day maximum (${mgText(worked * (perDay ?? 1))} a day ${how})`
    : `Capped at the ${mgText(capMg)} maximum (${mgText(worked)} ${how})`;
  return {
    amount,
    amountText,
    working: `${formula}${capped ? ` → capped at ${capText}` : ''}${
      note ? '' : ` → ${amountText} = ${num(delivered)} mg`
    }`,
    roundingNote:
      note && roundedDown && delivered <= capMg
        ? `${note} (rounded down to stay at or under the max ${capText})`
        : note,
    ...(capNote ? { capNote } : {}),
    ...(!capNote && note && Math.abs(delivered - aimed) > aimed * 0.05 ? { roundingWarning: note } : {}),
  };
};

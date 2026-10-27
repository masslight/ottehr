import { FC, useState } from 'react';
import { DoseBasis, plainDose } from 'utils/lib/helpers/medications/plain-dose';
import {
  frequencyForDosesPerDay,
  isCombinationProduct,
  prescriptionDirectionsText,
  prescriptionFrequency,
  prescriptionQuantityUnit,
  PrescriptionStep,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { vitalsConfig } from 'utils/lib/helpers/vitals/config-schema';
import { formatWeightLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { formatDateTimeToLocalTimezone } from 'utils/lib/utils/date';
import { DoseCalculatorCard, DoseCalculatorDisplay, DoseField } from '../erx-looks/DoseCalculatorCard';
import { DoseCalculatorPopup } from '../erx-looks/DoseCalculatorPopup';
import {
  CalculatorDosing,
  doseByIngredient,
  ingredientText,
  lineMaximumOf,
  measureOf,
  mgPerMeasure,
  NO_DETAILS_MESSAGE,
  numberOrUndefined,
  PrescriptionLine,
  withDirections,
} from './prescriptionLines';
import { VisitWeight } from './useVisitWeight';

const BASIS_OPTIONS = [
  { value: 'mg/kg/day', label: 'day' },
  { value: 'mg/kg/dose', label: 'dose' },
  { value: 'fixed', label: 'dose, not by weight' },
];

/** What the provider typed, kept only for the product it was typed on. */
interface Picks {
  ndc?: string;
  /** A combination product's ingredient to dose by, by name: picked each time, never from a quick pick. */
  doseBy?: string;
  concentration?: string;
  rate?: string;
  basis?: DoseBasis;
  dosesPerDay?: string;
  maxPerDose?: string;
  maxPerDay?: string;
}

const text = (value: number | undefined): string => (value === undefined ? '' : String(value));

/** A quick pick's settings as if typed in, for its product; its doses a day only where the line's frequency doesn't
 * already say them. */
const picksOf = (dosing: CalculatorDosing | undefined, line: PrescriptionLine): Picks =>
  dosing
    ? {
        ndc: line.medication?.ndc,
        rate: text(dosing.rate),
        basis: dosing.basis,
        ...(dosing.dosesPerDay !== undefined &&
        dosing.dosesPerDay !== prescriptionFrequency(line.frequency)?.dosesPerDay
          ? { dosesPerDay: text(dosing.dosesPerDay) }
          : {}),
        ...(dosing.maxPerDoseMg !== undefined ? { maxPerDose: text(dosing.maxPerDoseMg) } : {}),
        ...(dosing.maxPerDayMg !== undefined ? { maxPerDay: text(dosing.maxPerDayMg) } : {}),
      }
    : {};

/** The weight in the calculator's blank: what was typed, else the vitals' kg to the 0.01 kg they store. */
const calculatorWeightText = (weightText: string | undefined, weight: VisitWeight | undefined): string =>
  weightText ?? (weight ? String(roundNumberToDecimalPlaces(weight.kg, 2)) : '');

/** Where an earlier visit's weight is from: "previous visit, 10/8/2026 …". */
const weightSourceText = (weight: VisitWeight): string =>
  `${weight.thisVisit ? 'this visit' : 'previous visit'}${
    weight.takenAt ? `, ${formatDateTimeToLocalTimezone(weight.takenAt)}` : ''
  }`;

/** What the suggestions say when they use a previous visit's weight; nothing when the weight is this visit's or
 * typed. */
export const previousVisitWeightNote = (
  weightText: string | undefined,
  weight: VisitWeight | undefined
): string | undefined =>
  weightText === undefined && weight && !weight.thisVisit
    ? `using weight ${roundNumberToDecimalPlaces(weight.kg, 2)} kg (${weightSourceText(weight)})`
    : undefined;

/** The weight the calculator works from, for the page to give the suggestions the very same number. */
export const calculatorWeightKg = (
  weightText: string | undefined,
  weight: VisitWeight | undefined
): number | undefined => numberOrUndefined(calculatorWeightText(weightText, weight));

/** What "Use this dose" writes into the line: the dose; a frequency, into an empty one only unless the doses a day
 * were typed in the calculator; and for a course its "then" steps. */
export interface DoseFill {
  dose: string;
  frequency?: string;
  replaceFrequency?: boolean;
  durationDays?: string;
  steps?: PrescriptionStep[];
  /** What the dose was worked out from, which the line keeps while its dose stays the one used. */
  dosing?: CalculatorDosing;
  /** A combination product's ingredient the dose went by. */
  doseBy?: string;
}

/** The line with the calculator's dose used. Without steps of its own the dose is for the whole prescription: any
 * "then" steps go, and with them the first step's duration. */
export const withDose = (line: PrescriptionLine, fill: DoseFill): PrescriptionLine => {
  const quantityUnit = line.quantityUnit || prescriptionQuantityUnit(line.medication) || '';
  const next = withDirections(
    { ...line, quantityUnit },
    {
      dose: fill.dose,
      frequency:
        fill.frequency !== undefined && (fill.replaceFrequency || !line.frequency) ? fill.frequency : line.frequency,
      steps: fill.steps ?? [],
      ...(fill.durationDays !== undefined
        ? { durationDays: fill.durationDays }
        : line.steps.length && !fill.steps
        ? { durationDays: '' }
        : {}),
    }
  );
  return { ...next, dosing: fill.dosing, maximum: lineMaximumOf(fill.dosing, 'calculator'), doseBy: fill.doseBy };
};

interface DoseCalculatorProps {
  line: PrescriptionLine;
  weight?: VisitWeight;
  /** A weight typed here in place of the vitals', which the page keeps so the suggestions and every line's
   * calculator use it too; an emptied blank stays empty (''), and only "use the vitals weight" (undefined) goes back
   * to the vitals'. */
  weightText?: string;
  onWeightText: (value: string | undefined) => void;
  onChange: (next: PrescriptionLine) => void;
  /** Settings it opens with, as a quick pick's, in place of empty ones. */
  initial?: CalculatorDosing;
  /** The icon's name, where there are several. */
  label?: string;
}

/** The calculator icon after the line's dose blank and the plain dose calculator it opens: weight from the vitals,
 * strength from the product, the rate typed and the doses a day from the line's frequency, all editable. Its result
 * reads as the line's sentence, with the working behind the ⓘ. Nothing on the line changes until "Use this dose". */
export const DoseCalculator: FC<DoseCalculatorProps> = ({
  line,
  weight,
  weightText,
  onWeightText,
  onChange,
  initial,
  label,
}) => {
  const [picks, setPicks] = useState<Picks>(() => picksOf(initial, line));
  const ndc = line.medication?.ndc;
  const own = picks.ndc === ndc ? picks : {};
  const pick = (patch: Partial<Picks>): void => setPicks({ ...own, ...patch, ndc });

  const product = line.medication;
  const measure = measureOf(product);
  if (!product || !product.ingredients?.length || !measure) {
    const message = !product
      ? 'Pick a medication'
      : !product.ingredients?.length
      ? NO_DETAILS_MESSAGE
      : 'Not for this dose form: liquids, tablets and capsules only';
    return (
      <DoseCalculatorPopup label={label}>
        {() => <DoseCalculatorCard display={{ look: 'waiting', message }} />}
      </DoseCalculatorPopup>
    );
  }
  const weightValue = calculatorWeightText(weightText, weight);
  const weightKg = numberOrUndefined(weightValue);
  // A combination doses by the ingredient the provider picks; its result, rounding and maximum are that one's.
  const combination = isCombinationProduct(product);
  const ingredient = doseByIngredient(product, combination ? own.doseBy : undefined);
  const derivedConcentration = ingredient && mgPerMeasure(product, ingredient);
  const concentrationText = own.concentration ?? text(derivedConcentration);
  const basis = own.basis ?? 'mg/kg/day';
  const lineDosesPerDay = prescriptionFrequency(line.frequency)?.dosesPerDay;
  const dosesPerDayText = own.dosesPerDay ?? text(lineDosesPerDay);
  const dosesPerDay = numberOrUndefined(dosesPerDayText);
  const rateText = own.rate ?? '';
  const maxPerDoseMg = numberOrUndefined(own.maxPerDose ?? '');
  const maxPerDayMg = numberOrUndefined(own.maxPerDay ?? '');

  const dose = plainDose({
    weightKg,
    mgPerMeasure: numberOrUndefined(concentrationText),
    measure,
    basis,
    rate: numberOrUndefined(rateText),
    dosesPerDay,
    maxPerDoseMg,
    maxPerDayMg,
  });
  // Doses a day that match no frequency leave the line's as it is.
  const frequencyOfDoses = (dosesPerDay && frequencyForDosesPerDay(dosesPerDay)) || undefined;

  const fields: DoseField[] = [
    ...(basis === 'fixed'
      ? []
      : [
          {
            id: 'weight',
            label: 'Weight',
            value: weightValue,
            // Where the practice shows pounds, beside the kg the maths use.
            unit: `kg${
              vitalsConfig['vital-weight'].unit === 'lbs' && weightKg !== undefined
                ? ` (${formatWeightLbs(weightKg)} lb)`
                : ''
            }`,
            // This visit's weight needs no note; an earlier visit's says which.
            from:
              weightText !== undefined
                ? undefined
                : !weight
                ? 'no weight in the vitals'
                : weight.thisVisit
                ? undefined
                : weightSourceText(weight),
            // A typed weight stays, empty too, until the provider goes back to the vitals'.
            action:
              weightText !== undefined && weight
                ? { label: 'use the vitals weight', onClick: () => onWeightText(undefined) }
                : undefined,
          },
        ]),
    {
      id: 'concentration',
      label: measure === 'mL' ? 'Concentration' : 'Strength',
      value: concentrationText,
      unit: `mg per ${measure}`,
    },
    {
      id: 'rate',
      label: 'Rate',
      value: rateText,
      unit: basis === 'fixed' ? 'mg per' : 'mg/kg per',
      choice: { title: 'Per day or per dose', options: BASIS_OPTIONS, value: basis },
    },
    {
      id: 'dosesPerDay',
      label: 'Doses a day',
      value: dosesPerDayText,
      from: own.dosesPerDay === undefined && lineDosesPerDay !== undefined ? `from ${line.frequency}` : undefined,
    },
    { id: 'maxPerDose', label: 'Maximum per dose', value: own.maxPerDose ?? '', unit: 'mg per dose', optional: true },
    { id: 'maxPerDay', label: 'Maximum per day', value: own.maxPerDay ?? '', unit: 'mg per day', optional: true },
  ];

  const missing = [
    basis !== 'fixed' && !weightKg && 'the weight',
    !ingredient && 'the ingredient to dose by',
    !numberOrUndefined(concentrationText) && `the ${measure === 'mL' ? 'concentration' : 'strength'}`,
    !numberOrUndefined(rateText) && 'a rate',
    (basis === 'mg/kg/day' || maxPerDayMg) && !dosesPerDay && 'the doses a day',
  ].filter((input): input is string => !!input);
  const fill: DoseFill | undefined = dose &&
    ingredient && {
      dose: String(dose.amount),
      frequency: frequencyOfDoses,
      replaceFrequency: own.dosesPerDay !== undefined,
      dosing: {
        rate: numberOrUndefined(rateText) ?? 0,
        basis,
        ...(dosesPerDay !== undefined ? { dosesPerDay } : {}),
        ...(maxPerDoseMg !== undefined ? { maxPerDoseMg } : {}),
        ...(maxPerDayMg !== undefined ? { maxPerDayMg } : {}),
      },
      ...(combination ? { doseBy: ingredient.name } : {}),
    };
  const display: DoseCalculatorDisplay = fill
    ? {
        look: 'own',
        fields,
        result: {
          sentence: prescriptionDirectionsText(product, withDose(line, fill)),
          working: dose?.working,
          roundingNote: dose?.roundingNote,
          capNote: dose?.capNote,
        },
      }
    : {
        look: 'waiting',
        fields,
        message: `Enter ${missing.slice(0, -1).join(', ')}${missing.length > 1 ? ' and ' : ''}${
          missing[missing.length - 1]
        } to work out the dose`,
      };

  return (
    <DoseCalculatorPopup label={label}>
      {(close) => (
        <DoseCalculatorCard
          picker={
            combination
              ? {
                  title: 'Dose by',
                  options: (product.ingredients ?? []).map((option) => ingredientText(product, option)),
                  value: ingredient && ingredientText(product, ingredient),
                  onChange: (value) =>
                    pick({
                      doseBy: product.ingredients?.find((option) => ingredientText(product, option) === value)?.name,
                      concentration: undefined,
                    }),
                }
              : undefined
          }
          display={display}
          onFieldChange={(id, value) => (id === 'weight' ? onWeightText(value) : pick({ [id]: value }))}
          onChoiceChange={(_id, value) => pick({ basis: value as DoseBasis })}
          onUse={
            fill &&
            ((): void => {
              onChange(withDose(line, fill));
              close();
            })
          }
        />
      )}
    </DoseCalculatorPopup>
  );
};

import { FC, useState } from 'react';
import { DoseBasis, plainDose } from 'utils/lib/helpers/medications/plain-dose';
import {
  frequencyForDosesPerDay,
  PRESCRIPTION_FREQUENCIES,
  prescriptionDoseForm,
  prescriptionQuantityUnit,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { vitalsConfig } from 'utils/lib/helpers/vitals/config-schema';
import { formatWeightLbs } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { formatDateTimeToLocalTimezone } from 'utils/lib/utils/date';
import { DoseCalculatorCard, DoseCalculatorDisplay, DoseField } from '../erx-looks/DoseCalculatorCard';
import { MEASURE_OF, mgPerMeasure, numberOrUndefined, PrescriptionLine, withDirections } from './prescriptionLines';
import { VisitWeight } from './useVisitWeight';

/** The regimen picker's last option, the plain calculator. A product's regimens go before it once there is dosing
 * data to list them from; until then it is the only one. */
const ENTER_MY_OWN = 'Enter my own';

const BASIS_OPTIONS = [
  { value: 'mg/kg/day', label: 'day' },
  { value: 'mg/kg/dose', label: 'dose' },
  { value: 'fixed', label: 'dose, not by weight' },
];

/** What the provider typed, kept only for the product it was typed on. */
interface Picks {
  ndc?: string;
  concentration?: string;
  rate?: string;
  basis?: DoseBasis;
  dosesPerDay?: string;
}

const text = (value: number | undefined): string => (value === undefined ? '' : String(value));

/** The weight in the calculator's blank: what was typed, else the vitals' kg to the 0.01 kg they store. */
const calculatorWeightText = (weightText: string | undefined, weight: VisitWeight | undefined): string =>
  weightText ?? (weight ? String(roundNumberToDecimalPlaces(weight.kg, 2)) : '');

/** Where the vitals weight is from: "this visit, 10/8/2026 …" or "previous visit, …". */
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

interface DoseCalculatorProps {
  line: PrescriptionLine;
  /** Which prescription the calculator is on, when there are several. */
  label?: string;
  weight?: VisitWeight;
  /** A weight typed here in place of the vitals', which the page keeps so the suggestions use it too; an emptied
   * blank stays empty (''), and only "use the vitals weight" (undefined) goes back to the vitals'. */
  weightText?: string;
  onWeightText: (value: string | undefined) => void;
  onChange: (next: PrescriptionLine) => void;
  readOnly: boolean;
}

/** The plain dose calculator for the prescription being written: weight from the vitals, strength from the product,
 * the rate and doses a day typed, all editable, with the working and the rounding shown. Nothing on the line changes
 * until "Use this dose" writes the dose (and a frequency, when the doses a day were typed) into its blanks. */
export const DoseCalculator: FC<DoseCalculatorProps> = ({
  line,
  label,
  weight,
  weightText,
  onWeightText,
  onChange,
  readOnly,
}) => {
  const [picks, setPicks] = useState<Picks>({});
  const ndc = line.medication?.ndc;
  const own = picks.ndc === ndc ? picks : {};
  const pick = (patch: Partial<Picks>): void => setPicks({ ...own, ...patch, ndc });

  const description = line.medication?.description ?? '';
  const form = prescriptionDoseForm(description);
  const measure = form && MEASURE_OF[form];
  if (!measure) {
    const message = description ? 'Not for this dose form: liquids, tablets and capsules only' : 'Pick a medication';
    return <DoseCalculatorCard label={label} display={{ look: 'waiting', message }} readOnly={readOnly} />;
  }

  const weightValue = calculatorWeightText(weightText, weight);
  const weightKg = numberOrUndefined(weightValue);
  const derivedConcentration = mgPerMeasure(description);
  const concentrationText = own.concentration ?? text(derivedConcentration);
  const basis = own.basis ?? 'mg/kg/day';
  const lineDosesPerDay = PRESCRIPTION_FREQUENCIES[line.frequency]?.dosesPerDay;
  const dosesPerDayText = own.dosesPerDay ?? text(lineDosesPerDay);
  const dosesPerDay = numberOrUndefined(dosesPerDayText);
  const rateText = own.rate ?? '';

  const dose = plainDose({
    weightKg,
    mgPerMeasure: numberOrUndefined(concentrationText),
    measure,
    basis,
    rate: numberOrUndefined(rateText),
    dosesPerDay,
  });
  const frequencyOfDoses = (dosesPerDay && frequencyForDosesPerDay(dosesPerDay)) || '';

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
            from: weightText !== undefined ? undefined : weight ? weightSourceText(weight) : 'no weight in the vitals',
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
      from: own.concentration === undefined && derivedConcentration !== undefined ? 'from the product' : undefined,
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
      from: own.dosesPerDay === undefined && lineDosesPerDay !== undefined ? '(from the frequency)' : undefined,
    },
  ];

  const missing = [
    basis !== 'fixed' && !weightKg && 'the weight',
    !numberOrUndefined(concentrationText) && `the ${measure === 'mL' ? 'concentration' : 'strength'}`,
    !numberOrUndefined(rateText) && 'a rate',
    basis === 'mg/kg/day' && !dosesPerDay && 'the doses a day',
  ].filter((input): input is string => !!input);
  const display: DoseCalculatorDisplay = dose
    ? {
        look: 'own',
        fields,
        result: {
          amount: dose.amountText,
          frequency: frequencyOfDoses || 'per dose',
          working: dose.working,
          roundingNote: dose.roundingNote,
        },
      }
    : {
        look: 'waiting',
        fields,
        message: `Enter ${missing.slice(0, -1).join(', ')}${missing.length > 1 ? ' and ' : ''}${
          missing[missing.length - 1]
        } to work out the dose`,
      };

  const useDose = (): void => {
    if (!dose) return;
    const quantityUnit = line.quantityUnit || prescriptionQuantityUnit(description) || '';
    // One dose for the whole prescription: any "then" steps go, and with them the first step's duration. The line's
    // frequency stands unless the doses a day were typed here, which then name their own (or none).
    onChange(
      withDirections(
        { ...line, quantityUnit },
        {
          dose: String(dose.amount),
          frequency: own.dosesPerDay !== undefined ? frequencyOfDoses : line.frequency,
          steps: [],
          ...(line.steps.length ? { durationDays: '' } : {}),
        }
      )
    );
  };

  return (
    <DoseCalculatorCard
      label={label}
      display={display}
      picker={{ title: 'Regimen', options: [ENTER_MY_OWN], value: ENTER_MY_OWN, onChange: () => undefined }}
      onFieldChange={(id, value) => (id === 'weight' ? onWeightText(value) : pick({ [id]: value }))}
      onChoiceChange={(_id, value) => pick({ basis: value as DoseBasis })}
      onUse={useDose}
      readOnly={readOnly}
    />
  );
};

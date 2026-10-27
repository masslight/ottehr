import { DateTime } from 'luxon';
import { DoseMeasure, doseRoundingNote, nearestMeasurable } from 'utils/lib/helpers/medications/plain-dose';
import {
  doseAmountText,
  parseStrengthConcentration,
  PRESCRIPTION_FREQUENCIES,
  PrescriptionDirections,
  prescriptionDirectionsText,
  prescriptionDispense,
  PrescriptionDoseForm,
  prescriptionDoseForm,
  prescriptionQuantityUnit,
  prescriptionRoute,
  PrescriptionStep,
  SuggestedPrescriptionFields,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import {
  MedicationSearchDrug,
  MedicationSearchResult,
  MedicationStrength,
  PharmacySearchResult,
} from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput, QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData, PrescriptionQuickPickDosing } from 'utils/lib/types/api/quick-picks.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { z } from 'zod';

/** What the dose, route, frequency and duration blanks last wrote, so only their own text is ever overwritten. */
interface GeneratedFields {
  patientInstructions: string;
  quantityValue: string;
  daysSupply: string;
}

/** One numbered prescription on the eRx page, as the sentences hold it: numbers stay strings while typed. */
export interface PrescriptionLine extends PrescriptionDirections {
  /** Stable React key; lines are added and removed in any order. */
  key: number;
  /** The search hit the medication was picked from; its strengths fill the strength blank. A quick pick has none. */
  drug: MedicationSearchDrug | null;
  medication: MedicationSearchResult | null;
  /** Shown on the line only: the order service has no urgent flag yet. */
  urgent: boolean;
  steps: PrescriptionStep[];
  instructions: string;
  quantityValue: string;
  quantityUnit: QuantityUnit | '';
  daysSupply: string;
  numberOfRefills: string;
  substitutionAllowed: boolean;
  patientInstructions: string;
  noteToPharmacy: string;
  diagnosis: { code: string; display: string } | null;
  generated: GeneratedFields;
  /** What the quick pick in use set beyond the directions, which a new product clears where still unchanged. */
  quickPicked: QuickPickedFields | null;
  /** The line's details are hidden after a new medication or strength until a suggestion or "Write my own" is picked:
   * it can't be sent, since what it carries over isn't on screen. */
  awaitingPick?: boolean;
  /** The notes on the doses the last strength change re-measured: the first step's, then each "then" step's. */
  doseNotes?: (DoseNote | undefined)[];
  /** The calculator's settings while the dose is the one its "Use this dose" wrote; a quick pick saved from the line
   * keeps them. Gone once the dose is typed by hand or the product changes. */
  dosing?: CalculatorDosing;
}

/** What the calculator worked the dose out from; the frequency and duration are the line's own. */
export type CalculatorDosing = Omit<PrescriptionQuickPickDosing, 'frequency' | 'durationDays'>;

/** How far a dose a strength change re-measured lands from the mg it was: shown beside the dose while it stays as
 * re-measured. */
export interface DoseNote {
  dose: string;
  text: string;
}

type QuickPickedFields = Pick<PrescriptionLine, 'quantityValue' | 'daysSupply' | 'numberOfRefills' | 'noteToPharmacy'>;

let nextKey = 0;

const NOTHING_GENERATED: GeneratedFields = { patientInstructions: '', quantityValue: '', daysSupply: '' };

/** The blanks of a "then" step before anything is picked. */
export const emptyPrescriptionStep = (): PrescriptionStep => ({ dose: '', frequency: '', durationDays: '' });

/** The directions blanks as they start, and as they go back to when the drug changes. */
const NO_DIRECTIONS: Pick<PrescriptionLine, keyof PrescriptionStep | 'steps' | 'instructions'> = {
  ...emptyPrescriptionStep(),
  steps: [],
  instructions: '',
};

export const emptyPrescriptionLine = (): PrescriptionLine => ({
  key: nextKey++,
  drug: null,
  medication: null,
  route: '',
  dose: '',
  frequency: '',
  durationDays: '',
  steps: [],
  instructions: '',
  urgent: false,
  quantityValue: '',
  quantityUnit: '',
  daysSupply: '',
  numberOfRefills: '0',
  substitutionAllowed: true,
  patientInstructions: '',
  noteToPharmacy: '',
  diagnosis: null,
  generated: NOTHING_GENERATED,
  quickPicked: null,
});

const wholeAgeAt = (
  birthDate: string | undefined,
  visitDate: string | undefined,
  unit: 'years' | 'months'
): number | undefined => {
  const birth = birthDate ? DateTime.fromISO(birthDate) : undefined;
  if (!birth?.isValid) return undefined;
  const visit = visitDate ? DateTime.fromISO(visitDate) : DateTime.now();
  return Math.floor(visit.diff(birth, unit).get(unit));
};

/** Whole months old at the visit. */
export const ageMonthsAtVisit = (birthDate: string | undefined, visitDate: string | undefined): number | undefined =>
  wholeAgeAt(birthDate, visitDate, 'months');

/** The strength the line's medication is, among its drug's. */
export const pickedStrength = (line: Pick<PrescriptionLine, 'drug' | 'medication'>): MedicationStrength | undefined =>
  line.drug?.strengths.find((strength) => strength.ndcs[0] === line.medication?.ndc);

/** A value the provider left alone: empty, or exactly what the blanks last wrote. */
const follows = (current: string, generated: string): boolean => current.trim() === '' || current === generated;

/** The line with a dose, route, frequency or duration changed: the directions, quantity and days supply follow,
 * except where the provider typed something of their own, which stays. */
export const withDirections = (line: PrescriptionLine, patch: Partial<PrescriptionDirections>): PrescriptionLine => {
  const next = { ...line, ...patch };
  const description = next.medication?.description ?? '';
  const patientInstructions = prescriptionDirectionsText(description, next);
  const { quantityValue, daysSupply } = prescriptionDispense(description, next);
  return {
    ...next,
    patientInstructions: follows(line.patientInstructions, line.generated.patientInstructions)
      ? patientInstructions
      : line.patientInstructions,
    quantityValue: follows(line.quantityValue, line.generated.quantityValue) ? quantityValue : line.quantityValue,
    daysSupply: follows(line.daysSupply, line.generated.daysSupply) ? daysSupply : line.daysSupply,
    generated: { patientInstructions, quantityValue, daysSupply },
  };
};

/** The line without the calculator's settings once a change by hand means its dose is no longer the one they worked
 * out: a dose typed over it, or a frequency of other doses a day than it used. */
export const withoutCalculatorDosing = (line: PrescriptionLine, patch: Partial<PrescriptionStep>): PrescriptionLine => {
  const { dosing } = line;
  if (!dosing) return line;
  const typed = patch.dose !== undefined && patch.dose !== line.dose;
  const otherDoses =
    patch.frequency !== undefined &&
    dosing.dosesPerDay !== undefined &&
    PRESCRIPTION_FREQUENCIES[patch.frequency]?.dosesPerDay !== dosing.dosesPerDay;
  return typed || otherDoses ? { ...line, dosing: undefined } : line;
};

/** A number as the blanks hold it, or nothing for an empty or unreadable one. */
export const numberOrUndefined = (value: string): number | undefined =>
  value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);

/** The forms the calculator measures a dose in; anything else (an inhaler, a cream) it leaves alone. */
export const MEASURE_OF: Partial<Record<PrescriptionDoseForm, DoseMeasure>> = {
  liquid: 'mL',
  tablet: 'tablet',
  capsule: 'capsule',
};

/** mg in one measure of a product (a mL of a liquid, a tablet or capsule), when its description says. */
export const mgPerMeasure = (description: string): number | undefined => {
  const parsed = parseStrengthConcentration(description);
  return prescriptionDoseForm(description) === 'liquid' ? parsed?.mgPerMl : parsed?.mgPerUnit;
};

/** The dose as the same mg measured in another product, to the nearest amount it can measure (half a mL, a whole
 * tablet or capsule, at least one), with a note on how far that is from the mg: the provider decides whether it will
 * do. Blank when either strength can't be read, so a dose is never carried over in the wrong measure. A form that
 * isn't measured in mg (puffs, drops, a cream) keeps its dose as it was. */
const remeasured = (dose: string, from: string, to: PrescriptionLine): { dose: string; note?: DoseNote } => {
  const amount = numberOrUndefined(dose);
  if (amount === undefined || amount <= 0) return { dose };
  const toDescription = to.medication?.description ?? '';
  const form = prescriptionDoseForm(toDescription);
  const measure = form && MEASURE_OF[form];
  if (measure === undefined) return { dose };
  const fromMg = mgPerMeasure(from);
  const toMg = mgPerMeasure(toDescription);
  if (fromMg === undefined || toMg === undefined) return { dose: '' };
  const mg = roundNumberToDecimalPlaces(amount * fromMg, 2);
  const measures = nearestMeasurable(mg, toMg, measure);
  const text = doseRoundingNote(doseAmountText(measures, measure), roundNumberToDecimalPlaces(measures * toMg, 2), mg);
  return { dose: String(measures), note: text ? { dose: String(measures), text } : undefined };
};

/** The quick pick's values a new product clears: those still as the quick pick set them. */
const withoutQuickPick = (line: PrescriptionLine): Partial<PrescriptionLine> => {
  const picked = line.quickPicked;
  if (!picked) return {};
  const empty = emptyPrescriptionLine();
  const keys = ['quantityValue', 'daysSupply', 'numberOfRefills', 'noteToPharmacy'] as const;
  return {
    ...Object.fromEntries(keys.filter((key) => line[key] === picked[key]).map((key) => [key, empty[key]])),
    quickPicked: null,
  };
};

/** The line on a drug picked from the search, before its strength: the strength is the provider's to pick (none is
 * chosen for them), and nothing written for the product before carries over. */
export const withDrug = (line: PrescriptionLine, drug: MedicationSearchDrug): PrescriptionLine =>
  withDirections(
    {
      ...line,
      drug,
      medication: null,
      ...NO_DIRECTIONS,
      patientInstructions: '',
      ...withoutQuickPick(line),
      doseNotes: undefined,
      dosing: undefined,
    },
    {}
  );

/** The line on one strength of a drug: the unit and route follow the product when its name makes them obvious.
 * Directions written for another drug don't carry over; a strength change keeps the picks, with the doses
 * re-measured for the new strength (each with a note on how far it lands from the mg it was), and rewrites the
 * directions. */
export const withProduct = (
  line: PrescriptionLine,
  drug: MedicationSearchDrug,
  strength: MedicationStrength
): PrescriptionLine => {
  const medication = { ndc: strength.ndcs[0], description: `${drug.name} ${strength.strength}` };
  const otherDrug = drug.name !== line.drug?.name;
  const changed = medication.ndc !== line.medication?.ndc;
  const from = line.medication?.description;
  const next: PrescriptionLine = {
    ...line,
    drug,
    medication,
    quantityUnit: prescriptionQuantityUnit(medication.description) ?? line.quantityUnit,
    route: prescriptionRoute(medication.description) ?? line.route,
    ...(otherDrug ? NO_DIRECTIONS : {}),
    ...(changed ? { patientInstructions: '', ...withoutQuickPick(line), dosing: undefined } : {}),
  };
  if (!changed || otherDrug || from === undefined) return withDirections({ ...next, doseNotes: undefined }, {});
  const first = remeasured(line.dose, from, next);
  const steps = line.steps.map((step) => remeasured(step.dose, from, next));
  return withDirections(
    {
      ...next,
      dose: first.dose,
      steps: line.steps.map((step, i) => ({ ...step, dose: steps[i].dose })),
      doseNotes: [first, ...steps].map((result) => result.note),
    },
    {}
  );
};

/** A suggestion fills the line as the blanks would have, so changing a blank afterwards rewrites it: its steps
 * and instructions replace any there were. The diagnosis it brings replaces the line's; none leaves the line's. */
export const withSuggestion = (
  line: PrescriptionLine,
  fields: SuggestedPrescriptionFields,
  suggested: { diagnosis?: { code: string; display: string } } = {}
): PrescriptionLine => ({
  ...line,
  ...NO_DIRECTIONS,
  ...fields,
  dosing: undefined,
  quantityUnit: fields.quantityUnit || line.quantityUnit,
  // Refills are the provider's: a suggestion has none of its own.
  numberOfRefills: line.numberOfRefills,
  diagnosis: suggested.diagnosis ?? line.diagnosis ?? null,
  generated: {
    patientInstructions: fields.patientInstructions,
    quantityValue: fields.quantityValue,
    daysSupply: fields.daysSupply,
  },
});

const isWholeNumberInRange = (value: string, min: number, max: number): boolean => {
  const number = Number(value);
  return value.trim() !== '' && Number.isInteger(number) && number >= min && number <= max;
};

// The order endpoint's limits, checked per line before anything is sent.
const PrescriptionLineSchema = z.object({
  medication: z.object(
    {
      ndc: z.string().regex(/^\d{11}$/, 'Medication must have an 11-digit NDC'),
      description: z.string().trim().min(1).max(105, 'Medication name must be up to 105 characters'),
    },
    { invalid_type_error: 'Pick a medication' }
  ),
  quantityValue: z.string().refine((value) => Number(value) > 0, 'Quantity must be greater than 0'),
  quantityUnit: z.enum(QUANTITY_UNITS, { errorMap: () => ({ message: 'Pick a unit' }) }),
  daysSupply: z
    .string()
    .refine(
      (value) => value === '' || isWholeNumberInRange(value, 1, 999),
      'Days supply must be a whole number from 1 to 999'
    ),
  numberOfRefills: z
    .string()
    .refine((value) => isWholeNumberInRange(value, 0, 99), 'Refills must be a whole number from 0 to 99'),
  patientInstructions: z
    .string()
    .trim()
    .min(1, 'Enter the directions')
    .max(1000, 'Directions must be up to 1000 characters'),
  noteToPharmacy: z.string().trim().max(210, 'Note to pharmacy must be up to 210 characters'),
  diagnosis: z.object({ code: z.string().min(1), display: z.string() }).nullable(),
});

/** Every problem with the line, in sentence order; empty when it can be sent. */
export const prescriptionLineErrors = (line: PrescriptionLine): string[] => {
  const result = PrescriptionLineSchema.safeParse(line);
  // A drug with no strength yet is asked for its strength, before any pick among suggestions it can't have yet.
  const noStrength = line.drug !== null && line.medication === null;
  return [
    ...(noStrength ? ['Pick a strength'] : line.awaitingPick ? ['Pick a suggestion or Write my own'] : []),
    ...(result.success
      ? []
      : new Set(
          result.error.issues.map((issue) => issue.message).filter((m) => !(noStrength && m === 'Pick a medication'))
        )),
  ];
};

interface OrderContext {
  patientId: string;
  practitionerId: string;
  encounterId: string;
  pharmacy: PharmacySearchResult;
  writtenDate: string;
}

const ASCII_FRACTIONS: Record<string, string> = { '¼': '1/4', '½': '1/2', '¾': '3/4' };

/** "Take 1½ tablets, then ½ tablet" → "Take 1 1/2 tablets, then 1/2 tablet", for the text sent. */
export const asciiFractions = (text: string): string =>
  text.replace(
    /(\d?)([¼½¾])/g,
    (_, digit: string, fraction: string) => `${digit ? `${digit} ` : ''}${ASCII_FRACTIONS[fraction]}`
  );

/** The order input for a line that passed `prescriptionLineErrors`. The route, dose, frequency, duration and
 * urgent flag stay on the line: the order service has no fields for them yet, and the directions carry them. */
export const prescriptionLineToOrder = (line: PrescriptionLine, context: OrderContext): OrderPrescriptionInput => {
  if (!line.medication || !line.quantityUnit) {
    throw new Error('Prescription line is incomplete');
  }
  return {
    patientId: context.patientId,
    practitionerId: context.practitionerId,
    encounterId: context.encounterId,
    ndc: line.medication.ndc,
    medicationDescription: line.medication.description.trim(),
    quantityValue: Number(line.quantityValue),
    quantityUnit: line.quantityUnit,
    ...(line.daysSupply ? { daysSupply: Number(line.daysSupply) } : {}),
    writtenDate: context.writtenDate,
    substitutionAllowed: line.substitutionAllowed,
    numberOfRefills: Number(line.numberOfRefills),
    // Directions go with ASCII fractions ("1/2 tablet"): the blanks' written so, typed or quick-pick
    // ones converted; the screen keeps "½".
    patientInstructions: (line.patientInstructions === line.generated.patientInstructions
      ? prescriptionDirectionsText(line.medication.description, line, { ascii: true })
      : asciiFractions(line.patientInstructions)
    ).trim(),
    ...(line.noteToPharmacy.trim() ? { noteToPharmacy: line.noteToPharmacy.trim() } : {}),
    pharmacyId: context.pharmacy.ncpdpId,
    pharmacyNpi: context.pharmacy.npi,
    pharmacyName: context.pharmacy.name.trim(),
    pharmacyPhone: context.pharmacy.phone,
    ...(line.diagnosis
      ? { diagnosisCode: line.diagnosis.code.trim(), diagnosisDescription: line.diagnosis.display.trim() }
      : {}),
  };
};

/** A quick pick sets the whole prescription except the diagnosis, which belongs to the visit. Its directions were
 * written out, so the blanks start empty (the route from the product's name) and never overwrite them. */
export const applyPrescriptionQuickPick = (
  line: PrescriptionLine,
  quickPick: PrescriptionQuickPickData
): PrescriptionLine => {
  const medication =
    quickPick.ndc && quickPick.medicationDescription
      ? { ndc: quickPick.ndc, description: quickPick.medicationDescription }
      : line.medication;
  const applied: PrescriptionLine = {
    ...line,
    drug: medication === line.medication ? line.drug : null,
    medication,
    route: (medication && prescriptionRoute(medication.description)) ?? '',
    ...NO_DIRECTIONS,
    quantityValue: quickPick.quantityValue === undefined ? '' : String(quickPick.quantityValue),
    quantityUnit: quickPick.quantityUnit ?? '',
    daysSupply: quickPick.daysSupply === undefined ? '' : String(quickPick.daysSupply),
    numberOfRefills: String(quickPick.numberOfRefills ?? 0),
    substitutionAllowed: quickPick.substitutionAllowed ?? true,
    patientInstructions: quickPick.patientInstructions ?? '',
    noteToPharmacy: quickPick.noteToPharmacy ?? '',
    generated: NOTHING_GENERATED,
    // Its directions are text written for whoever it was saved from: not the calculator's for this patient.
    dosing: undefined,
  };
  return {
    ...applied,
    quickPicked: {
      quantityValue: applied.quantityValue,
      daysSupply: applied.daysSupply,
      numberOfRefills: applied.numberOfRefills,
      noteToPharmacy: applied.noteToPharmacy,
    },
  };
};

export const prescriptionLineToQuickPick = (
  line: PrescriptionLine,
  name: string
): Omit<PrescriptionQuickPickData, 'id'> => ({
  name: name.trim(),
  ndc: line.medication?.ndc,
  medicationDescription: line.medication?.description,
  quantityValue: numberOrUndefined(line.quantityValue),
  quantityUnit: line.quantityUnit || undefined,
  daysSupply: numberOrUndefined(line.daysSupply),
  numberOfRefills: numberOrUndefined(line.numberOfRefills),
  substitutionAllowed: line.substitutionAllowed,
  patientInstructions: line.patientInstructions.trim() || undefined,
  noteToPharmacy: line.noteToPharmacy.trim() || undefined,
  // diagnosis excluded — encounter-specific
  // The calculator's settings with the line's frequency and duration, for a dose "Use this dose" wrote; a course's
  // later steps aren't the calculator's.
  ...(line.dosing && line.steps.length === 0
    ? {
        dosing: {
          ...line.dosing,
          ...(line.frequency ? { frequency: line.frequency } : {}),
          ...(numberOrUndefined(line.durationDays) !== undefined
            ? { durationDays: numberOrUndefined(line.durationDays) }
            : {}),
        },
      }
    : {}),
});

const mgText = (mg: number): string => `${roundNumberToDecimalPlaces(mg, 2)} mg`;

/** What the save dialog says a quick pick keeps from the calculator: "Saved by weight: 25 mg/kg per dose, twice
 * daily, 10 days, max 500 mg per dose (from the calculator)". */
export const quickPickDosingText = (dosing: PrescriptionQuickPickDosing): string => {
  const { rate, basis, dosesPerDay, frequency, durationDays, maxPerDoseMg, maxPerDayMg } = dosing;
  const parts = [
    basis === 'fixed' ? `${mgText(rate)} per dose` : `${rate} mg/kg per ${basis === 'mg/kg/day' ? 'day' : 'dose'}`,
    frequency ?? (dosesPerDay !== undefined ? `${dosesPerDay} doses a day` : undefined),
    durationDays !== undefined ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : undefined,
    maxPerDoseMg !== undefined ? `max ${mgText(maxPerDoseMg)} per dose` : undefined,
    maxPerDayMg !== undefined ? `max ${mgText(maxPerDayMg)} per day` : undefined,
  ].filter((part): part is string => part !== undefined);
  return `${basis === 'fixed' ? 'Saved dose' : 'Saved by weight'}: ${parts.join(', ')} (from the calculator)`;
};

/** "Amoxicillin 500 MG Oral Capsule, 20 Capsule": the quick pick's name with what it dispenses, as the list reads. */
export const prescriptionQuickPickLabel = (quickPick: PrescriptionQuickPickData): string =>
  quickPick.quantityValue !== undefined && quickPick.quantityUnit
    ? `${quickPick.name}, ${quickPick.quantityValue} ${quickPick.quantityUnit.toLowerCase()}`
    : quickPick.name;

import {
  DoseMeasure,
  doseRoundingNote,
  mgText as warningMg,
  nearestMeasurable,
  PlainDose,
  plainDose,
} from 'utils/lib/helpers/medications/plain-dose';
import {
  doseAmountText,
  PrescriptionDirections,
  prescriptionDirectionsText,
  prescriptionDispense,
  PrescriptionDoseForm,
  prescriptionDoseForm,
  prescriptionFrequency,
  PrescriptionProduct,
  prescriptionQuantityUnit,
  prescriptionRoute,
  PrescriptionStep,
  SuggestedPrescriptionFields,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import {
  MedicationIngredient,
  MedicationProductDetails,
  MedicationSearchDrug,
  MedicationSearchResult,
  MedicationStrength,
  PharmacySearchResult,
} from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput, QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import {
  PrescriptionQuickPickData,
  PrescriptionQuickPickDosing,
  PrescriptionQuickPickSource,
} from 'utils/lib/types/api/quick-picks.types';
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
  /** The maximum the calculator or a quick pick brought, for the warnings only. It outlives a dose typed by hand (the
   * dosing doesn't), is never saved with a quick pick, and goes with the drug or strength. */
  maximum?: LineMaximum;
  /** The ingredient of a combination product the calculator dosed by, for its re-dosing and the maximum warnings.
   * Never saved with a quick pick; goes with the dosing's maximum, the drug or strength. */
  doseBy?: string;
  /** A dosed quick pick's text written after the blanks' sentence ("Shake well. Take with food."), which the line
   * shows to edit or remove. It outlives re-dosing and a new strength; goes with the drug or another quick pick. */
  additionalInstructions?: string;
}

/** The blanks' directions sentence with the additional instructions after it. */
export const withAdditionalInstructions = (directions: string, additional: string | undefined): string => {
  const extra = additional?.trim();
  return !extra ? directions : directions ? `${directions} ${extra}` : extra;
};

/** Where a line's maximum came from: the dose calculator, or a quick pick by name (with its source, if it has one). */
export type MaximumOrigin = 'calculator' | { quickPick: string; source?: PrescriptionQuickPickSource };

export interface LineMaximum {
  maxPerDoseMg?: number;
  maxPerDayMg?: number;
  from: MaximumOrigin;
}

/** The maxima of the calculator's settings, if it has any, as the line keeps them. */
export const lineMaximumOf = (
  dosing: Pick<PrescriptionQuickPickDosing, 'maxPerDoseMg' | 'maxPerDayMg'> | undefined,
  from: MaximumOrigin
): LineMaximum | undefined =>
  dosing?.maxPerDoseMg === undefined && dosing?.maxPerDayMg === undefined
    ? undefined
    : {
        ...(dosing.maxPerDoseMg !== undefined ? { maxPerDoseMg: dosing.maxPerDoseMg } : {}),
        ...(dosing.maxPerDayMg !== undefined ? { maxPerDayMg: dosing.maxPerDayMg } : {}),
        from,
      };

/** A line's dose over its maximum: orange, never blocking. `blank` is the one to outline. */
export interface MaximumWarning {
  blank: 'dose' | 'frequency';
  text: string;
}

/** "800 mg per dose is above the 500 mg maximum." / "1,920 mg a day is above the 1,000 mg a day maximum.", for the
 * first step's dose in mg (a measured form only) and, where the frequency gives a count, its doses a day. */
export const maximumWarnings = (line: PrescriptionLine): MaximumWarning[] => {
  const { maximum } = line;
  const mg = mgPerMeasure(line.medication, doseByIngredient(line.medication, line.doseBy));
  const dose = numberOrUndefined(line.dose);
  if (!maximum || !mg || !dose || dose <= 0) return [];
  const perDose = roundNumberToDecimalPlaces(dose * mg, 2);
  const dosesPerDay = prescriptionFrequency(line.frequency)?.dosesPerDay;
  const perDay = dosesPerDay === undefined ? undefined : roundNumberToDecimalPlaces(perDose * dosesPerDay, 2);
  const over = (amount: number | undefined, max: number | undefined): max is number =>
    amount !== undefined && max !== undefined && amount > max + 1e-9;
  return [
    ...(over(perDose, maximum.maxPerDoseMg)
      ? [
          {
            blank: 'dose' as const,
            text: `${warningMg(perDose)} per dose is above the ${warningMg(maximum.maxPerDoseMg)} maximum.`,
          },
        ]
      : []),
    ...(perDay !== undefined && over(perDay, maximum.maxPerDayMg)
      ? [
          {
            blank: 'frequency' as const,
            text: `${warningMg(perDay)} a day is above the ${warningMg(maximum.maxPerDayMg)} a day maximum.`,
          },
        ]
      : []),
  ];
};

/** What the warning's ⓘ says the maximum is from. */
export const maximumOriginText = (from: MaximumOrigin): string =>
  from === 'calculator' ? 'From the dose calculator' : `From the quick pick: ${from.quickPick}`;

/** What the calculator worked the dose out from; the frequency and duration are the line's own. */
export type CalculatorDosing = Omit<PrescriptionQuickPickDosing, 'frequency' | 'durationDays'>;

/** How far a dose a strength change re-measured lands from the mg it was, or how the calculator's settings worked it
 * out (a dosing suggestion, "Use this dose", a new frequency): shown beside the dose while it stays so. */
export interface DoseNote {
  dose: string;
  text: string;
  /** The calculator's working, for a dose it worked out (the text is then its rounding note, if any). */
  working?: string;
  /** Where a maximum stopped the dose: "Capped at the 500 mg maximum (703 mg by weight)". */
  capNote?: string;
  /** The quick pick whose dosing worked it out. */
  quickPick?: { name: string; source?: PrescriptionQuickPickSource };
}

/** The ⓘ's note for a dose the calculator worked out. */
export const calculatorDoseNote = (
  dose: Pick<PlainDose, 'amount' | 'working' | 'roundingNote' | 'capNote'>,
  quickPick?: DoseNote['quickPick']
): DoseNote => ({
  dose: String(dose.amount),
  text: dose.roundingNote ?? '',
  working: dose.working,
  ...(dose.capNote ? { capNote: dose.capNote } : {}),
  ...(quickPick ? { quickPick } : {}),
});

type QuickPickedFields = Pick<PrescriptionLine, 'quantityValue' | 'daysSupply' | 'numberOfRefills' | 'noteToPharmacy'>;

let nextKey = 0;

const NOTHING_GENERATED: GeneratedFields = { patientInstructions: '', quantityValue: '', daysSupply: '' };

/** The blanks of a "then" step before anything is picked. */
export const emptyPrescriptionStep = (): PrescriptionStep => ({ dose: '', frequency: '', durationDays: '' });

/** What the calculator or a quick pick's dosing left on the line, cleared together. */
const NO_DOSING: Pick<PrescriptionLine, 'dosing' | 'maximum' | 'doseBy'> = {
  dosing: undefined,
  maximum: undefined,
  doseBy: undefined,
};

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

/** The strength the line's medication is, among its drug's. */
export const pickedStrength = (line: Pick<PrescriptionLine, 'drug' | 'medication'>): MedicationStrength | undefined =>
  line.drug?.strengths.find((strength) => strength.ndcs[0] === line.medication?.ndc);

/** A value the provider left alone: empty, or exactly what the blanks last wrote. */
const follows = (current: string, generated: string): boolean => current.trim() === '' || current === generated;

/** The line with a dose, route, frequency or duration changed: the directions, quantity and days supply follow,
 * except where the provider typed something of their own, which stays. */
export const withDirections = (
  line: PrescriptionLine,
  patch: Partial<PrescriptionDirections & Pick<PrescriptionLine, 'additionalInstructions'>>
): PrescriptionLine => {
  const next = { ...line, ...patch };
  const patientInstructions = withAdditionalInstructions(
    prescriptionDirectionsText(next.medication, next),
    next.additionalInstructions
  );
  const { quantityValue, daysSupply } = prescriptionDispense(next.medication, next);
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

/** The line's calculator settings after a change by hand to its dose or frequency. A dose typed over the calculator's
 * drops them. A frequency of other doses a day keeps them, with the new doses a day: by mg/kg/day the dose is worked out
 * again for the weight (blank without one), with the working behind the ⓘ; per dose, or not by weight, it stays. */
export const withCalculatorDosing = (
  line: PrescriptionLine,
  patch: Partial<PrescriptionStep>,
  weightKg: number | undefined
): PrescriptionLine => {
  const { dosing } = line;
  if (!dosing) return line;
  if (patch.dose !== undefined && patch.dose !== line.dose) return { ...line, dosing: undefined };
  const dosesPerDay = patch.frequency === undefined ? undefined : prescriptionFrequency(patch.frequency)?.dosesPerDay;
  if (dosesPerDay === undefined || dosesPerDay === dosing.dosesPerDay) return line;
  const kept: PrescriptionLine = { ...line, dosing: { ...dosing, dosesPerDay } };
  if (dosing.basis !== 'mg/kg/day') return kept;
  const measure = measureOf(line.medication);
  const mg = mgPerMeasure(line.medication, doseByIngredient(line.medication, line.doseBy));
  const dose = measure && plainDose({ ...dosing, weightKg, mgPerMeasure: mg, measure, dosesPerDay });
  if (!dose) return { ...kept, dose: '' };
  const amount = String(dose.amount);
  return {
    ...kept,
    dose: amount,
    // Still the quick pick's dosing, if it was.
    doseNotes: [calculatorDoseNote(dose, line.doseNotes?.[0]?.quickPick), ...(line.doseNotes ?? []).slice(1)],
  };
};

/** A number as the blanks hold it, or nothing for an empty or unreadable one. */
export const numberOrUndefined = (value: string): number | undefined =>
  value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);

/** The forms the calculator measures a dose in; anything else (an inhaler, a cream) it leaves alone. */
const MEASURE_OF: Partial<Record<PrescriptionDoseForm, DoseMeasure>> = {
  liquid: 'mL',
  tablet: 'tablet',
  capsule: 'capsule',
};

/** The measure the calculator doses a product in, when its dose form is one it measures. */
export const measureOf = (product: PrescriptionProduct | null | undefined): DoseMeasure | undefined => {
  const form = prescriptionDoseForm(product);
  return form && MEASURE_OF[form];
};

/** What a quick pick's row says for a combination product with weight dosing: which ingredient is the provider's
 * pick, in the calculator. */
export const COMBINATION_MESSAGE = 'Combination product: open the calculator to choose which ingredient to dose by';

/** What the calculator says for a product without structured strength details (a quick pick saved before them). */
export const NO_DETAILS_MESSAGE = 'Strength details unavailable: enter the dose directly';

/** What an ingredient amount is per, for each measure: a mL of a liquid, one tablet or capsule. */
const PER_UNIT_OF: Record<DoseMeasure, string> = { mL: 'ML', tablet: 'EACH', capsule: 'EACH' };

/** mg in one of RxNorm's strength units. */
const MG_PER_UNIT: Record<string, number> = { MG: 1, MCG: 0.001, GM: 1000 };

/** The product's one ingredient; none for a combination, whose ingredient to dose by is the provider's pick. */
const soleIngredient = (product: PrescriptionProduct | null | undefined): MedicationIngredient | undefined =>
  product?.ingredients?.length === 1 ? product.ingredients[0] : undefined;

/** The ingredient a dose goes by: the one named (a combination's, as the calculator picked), else the only one. */
export const doseByIngredient = (
  product: PrescriptionProduct | null | undefined,
  name: string | undefined
): MedicationIngredient | undefined =>
  name === undefined ? soleIngredient(product) : product?.ingredients?.find((ingredient) => ingredient.name === name);

/** mg of an ingredient in one measure of the product (a mL of a liquid, a tablet or capsule), when its amount is in
 * mg, mcg or g per that measure. The product's only ingredient unless one is given. */
export const mgPerMeasure = (
  product: PrescriptionProduct | null | undefined,
  ingredient: MedicationIngredient | undefined = soleIngredient(product)
): number | undefined => {
  const measure = measureOf(product);
  const factor = ingredient && MG_PER_UNIT[ingredient.unit];
  if (!measure || !ingredient || !factor || ingredient.perUnit !== PER_UNIT_OF[measure] || !(ingredient.per > 0)) {
    return undefined;
  }
  return roundNumberToDecimalPlaces((ingredient.amount * factor) / ingredient.per, 6);
};

/** "amoxicillin 80 mg/mL", "ondansetron 4 mg/tablet": an ingredient as the calculator's "Dose by" lists it. */
export const ingredientText = (
  product: PrescriptionProduct | null | undefined,
  ingredient: MedicationIngredient
): string => {
  const measure = measureOf(product);
  const mg = mgPerMeasure(product, ingredient);
  return mg === undefined || !measure ? ingredient.name : `${ingredient.name} ${mg} mg/${measure}`;
};

/** The dose as the same mg measured in another product, to the nearest amount it can measure (half a mL, a whole
 * tablet or capsule, at least one), with a note on how far that is from the mg: the provider decides whether it will
 * do. Blank when either strength can't be read, so a dose is never carried over in the wrong measure. A form that
 * isn't measured in mg (puffs, drops, a cream) keeps its dose as it was. */
const remeasured = (
  dose: string,
  from: MedicationSearchResult,
  to: PrescriptionLine
): { dose: string; note?: DoseNote } => {
  const amount = numberOrUndefined(dose);
  if (amount === undefined || amount <= 0) return { dose };
  const measure = measureOf(to.medication);
  if (measure === undefined) return { dose };
  const fromMg = mgPerMeasure(from);
  const toMg = mgPerMeasure(to.medication);
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
 * chosen for them), and nothing written for the product before carries over: the directions, quantity, unit, days
 * supply and route go (the strength picked next sets what its product implies). The refills, substitution and note
 * to pharmacy aren't the product's and stay, unless still as a quick pick set them. */
export const withDrug = (line: PrescriptionLine, drug: MedicationSearchDrug): PrescriptionLine =>
  withDirections(
    {
      ...line,
      drug,
      medication: null,
      ...NO_DIRECTIONS,
      route: '',
      quantityValue: '',
      quantityUnit: '',
      daysSupply: '',
      patientInstructions: '',
      ...withoutQuickPick(line),
      ...NO_DOSING,
      doseNotes: undefined,
      additionalInstructions: undefined,
    },
    {}
  );

/** The product one strength of a drug is, as the order sends it: its first NDC and "Amoxicillin 250 mg Cap", with
 * the strength's RxCUI, dose form and ingredients when the search has them. */
export const productOf = (drug: MedicationSearchDrug, strength: MedicationStrength): MedicationSearchResult => ({
  ndc: strength.ndcs[0],
  description: `${drug.name} ${strength.strength}`,
  ...productDetailsOf(strength),
});

/** A product's structured details, those it has. */
export const productDetailsOf = ({
  rxcui,
  doseForm,
  ingredients,
}: MedicationProductDetails): MedicationProductDetails => ({
  ...(rxcui !== undefined ? { rxcui } : {}),
  ...(doseForm !== undefined ? { doseForm } : {}),
  ...(ingredients !== undefined ? { ingredients } : {}),
});

/** The line on one strength of a drug: the unit and route follow the product when its dose form makes them obvious.
 * Directions written for another drug don't carry over; a strength change keeps the picks, with the doses
 * re-measured for the new strength (each with a note on how far it lands from the mg it was), and rewrites the
 * directions. */
export const withProduct = (
  line: PrescriptionLine,
  drug: MedicationSearchDrug,
  strength: MedicationStrength
): PrescriptionLine => {
  const medication = productOf(drug, strength);
  const otherDrug = drug.name !== line.drug?.name;
  const changed = medication.ndc !== line.medication?.ndc;
  const from = line.medication;
  const next: PrescriptionLine = {
    ...line,
    drug,
    medication,
    quantityUnit: prescriptionQuantityUnit(medication) ?? line.quantityUnit,
    route: prescriptionRoute(medication) ?? line.route,
    ...(otherDrug ? { ...NO_DIRECTIONS, additionalInstructions: undefined } : {}),
    ...(changed
      ? {
          patientInstructions: '',
          ...withoutQuickPick(line),
          ...NO_DOSING,
        }
      : {}),
  };
  if (!changed || otherDrug || from === null) return withDirections({ ...next, doseNotes: undefined }, {});
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
 * and instructions replace any there were. The line keeps its diagnosis. */
export const withSuggestion = (line: PrescriptionLine, fields: SuggestedPrescriptionFields): PrescriptionLine => ({
  ...line,
  ...NO_DIRECTIONS,
  ...fields,
  ...NO_DOSING,
  quantityUnit: fields.quantityUnit || line.quantityUnit,
  // Refills are the provider's: a suggestion has none of its own.
  numberOfRefills: line.numberOfRefills,
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
const asciiFractions = (text: string): string =>
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
      ? asciiFractions(
          withAdditionalInstructions(
            prescriptionDirectionsText(line.medication, line, { ascii: true }),
            line.additionalInstructions
          )
        )
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

/** The product a quick pick orders, with the details it was saved with (none on one saved before them). */
export const quickPickProduct = (quickPick: PrescriptionQuickPickData): MedicationSearchResult | null =>
  quickPick.ndc && quickPick.medicationDescription
    ? { ndc: quickPick.ndc, description: quickPick.medicationDescription, ...productDetailsOf(quickPick) }
    : null;

/** A quick pick sets the whole prescription except the diagnosis, which belongs to the visit. Its directions were
 * written out, so the blanks start empty (the route from the product's dose form) and never overwrite them. */
export const applyPrescriptionQuickPick = (
  line: PrescriptionLine,
  quickPick: PrescriptionQuickPickData
): PrescriptionLine => {
  const medication = quickPickProduct(quickPick) ?? line.medication;
  const applied: PrescriptionLine = {
    ...line,
    drug: medication === line.medication ? line.drug : null,
    medication,
    route: prescriptionRoute(medication) ?? '',
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
    ...NO_DOSING,
    doseNotes: undefined,
    // Written after the sentence its dosing re-doses; one as written has it all in its directions.
    additionalInstructions: quickPick.dosing ? quickPick.additionalInstructions : undefined,
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
  // The product's details, so the quick pick's product doses as the picked one did.
  ...(line.medication ? productDetailsOf(line.medication) : {}),
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
        ...(line.additionalInstructions?.trim() ? { additionalInstructions: line.additionalInstructions.trim() } : {}),
      }
    : {}),
});

const mgText = (mg: number): string => `${roundNumberToDecimalPlaces(mg, 2)} mg`;

/** What the save dialog says a quick pick keeps from the calculator: "Saved by weight: 25 mg/kg per dose, twice
 * daily, 10 days, max 500 mg per dose (from the calculator)". */
export const quickPickDosingText = (dosing: PrescriptionQuickPickDosing): string =>
  `${dosing.basis === 'fixed' ? 'Saved dose' : 'Saved by weight'}: ${quickPickDosingSummary(
    dosing
  )} (from the calculator)`;

/** "25 mg/kg per dose, twice daily, 10 days, max 500 mg per dose". */
export const quickPickDosingSummary = (dosing: PrescriptionQuickPickDosing): string => {
  const { rate, basis, dosesPerDay, frequency, durationDays, maxPerDoseMg, maxPerDayMg } = dosing;
  return [
    basis === 'fixed' ? `${mgText(rate)} per dose` : `${rate} mg/kg per ${basis === 'mg/kg/day' ? 'day' : 'dose'}`,
    frequency ?? (dosesPerDay !== undefined ? `${dosesPerDay} doses a day` : undefined),
    durationDays !== undefined ? `${durationDays} ${durationDays === 1 ? 'day' : 'days'}` : undefined,
    maxPerDoseMg !== undefined ? `max ${mgText(maxPerDoseMg)} per dose` : undefined,
    maxPerDayMg !== undefined ? `max ${mgText(maxPerDayMg)} per day` : undefined,
  ]
    .filter((part): part is string => part !== undefined)
    .join(', ');
};

/** Why the order form's "Save as Quick Pick", which only adds, can't save this name: a quick pick already has it
 * (trimmed, in any case). */
export const quickPickNameInUse = (
  name: string,
  quickPicks: Pick<PrescriptionQuickPickData, 'name'>[]
): string | undefined => {
  const trimmed = name.trim();
  return quickPicks.some((quickPick) => quickPick.name.trim().toLowerCase() === trimmed.toLowerCase())
    ? `A quick pick named '${trimmed}' already exists. Edit it in Admin → Quick Picks, or choose another name.`
    : undefined;
};

/** Why the order form's "Save as Quick Pick" can't save the line: every quick pick orders a product. */
export const quickPickProductMissing = (line: Pick<PrescriptionLine, 'medication'>): string | undefined =>
  line.medication ? undefined : 'Pick a medication and strength before saving a quick pick';

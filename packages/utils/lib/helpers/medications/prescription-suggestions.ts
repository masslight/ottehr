import { QuantityUnit } from '../../types/api/order-prescription.types';
import { assembleSentence } from '../suggested-sentences';

/**
 * What an eRx line can work out from a medication's description alone: its dose form and route, the unit it is
 * dispensed in, and, from the dose, frequency and duration picked, the directions sentence and the quantity to
 * dispense. Nothing here depends on the drug itself or the chart.
 */

export type PrescriptionDoseForm = 'tablet' | 'capsule' | 'liquid' | 'inhaler' | 'topical' | 'patch' | 'suppository';

// Descriptions come as RxNorm names ("Oral Suspension", "Metered Dose Inhaler") or RxTerms abbreviations
// ("Susp", "MDI", "90 mcg/puff"), so each form knows both spellings.
const DOSE_FORM_PATTERNS: [PrescriptionDoseForm, RegExp][] = [
  // Inhalers first: "Albuterol 90 MCG/ACTUAT Metered Dose Inhaler" also mentions inhalation.
  ['inhaler', /\b(inhaler|hfa|metered dose|inhalation aerosol|mdi|dpi|puffs?)\b/i],
  // A patch before topical: "Transdermal Patch" and "Topical Patch" are both patches.
  ['patch', /\bpatch(es)?\b/i],
  ['suppository', /\b(suppositor(y|ies)|supp)\b/i],
  ['capsule', /\b(capsules?|caps?)\b/i],
  ['tablet', /\b(tablets?|caplets?|odt|tabs?|chewable|oral disintegrating)\b/i],
  ['liquid', /\b(solution|suspension|syrup|elixir|soln?|susp|oral liquid|drops?)\b/i],
  ['topical', /\b(cream|ointment|oint|gel)\b/i],
];

/** The dose form named in a medication description ("Amoxicillin 500 MG Oral Capsule" → capsule), if one is known. */
export const prescriptionDoseForm = (description: string): PrescriptionDoseForm | undefined =>
  DOSE_FORM_PATTERNS.find(([, pattern]) => pattern.test(description))?.[0];

const QUANTITY_UNIT: Record<PrescriptionDoseForm, QuantityUnit> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Milliliter',
  inhaler: 'Inhaler',
  topical: 'Gram',
  patch: 'Patch',
  suppository: 'Suppository',
};

/** The unit a product of this description is dispensed in, when its dose form says. */
export const prescriptionQuantityUnit = (description: string): QuantityUnit | undefined => {
  const form = prescriptionDoseForm(description);
  return form && QUANTITY_UNIT[form];
};

/** Plain-English routes, as the directions read them. */
export const PRESCRIPTION_ROUTES = [
  'by mouth',
  'in the ear',
  'in the eye',
  'in the nose',
  'inhaled',
  'on the skin',
  'rectally',
  'vaginally',
  'under the tongue',
  'by injection',
] as const;

export type PrescriptionRoute = (typeof PRESCRIPTION_ROUTES)[number];

// The specific routes first: "Ophthalmic Ointment" is for the eye, not the skin, and only an oral form is by mouth.
const ROUTE_PATTERNS: [PrescriptionRoute, RegExp][] = [
  ['in the ear', /\botic\b/i],
  ['in the eye', /\bophthalmic\b/i],
  ['in the nose', /\b(nasal|intranasal)\b/i],
  ['inhaled', /\b(inhaler|hfa|metered dose|inhalation|inhalant|mdi|dpi|puffs?|nebuli[sz]er)\b/i],
  ['under the tongue', /\bsublingual\b/i],
  ['rectally', /\b(rectal|suppositor(y|ies)|supp)\b/i],
  ['vaginally', /\bvaginal\b/i],
  ['by injection', /\b(injection|injectable|syringe|subcutaneous|intramuscular)\b/i],
  ['on the skin', /\b(topical|transdermal|cream|ointment|oint|gel|patch(es)?)\b/i],
  [
    'by mouth',
    /\b(oral|tablets?|tabs?|caplets?|capsules?|caps?|odt|chewable|solution|suspension|syrup|elixir|soln?|susp)\b/i,
  ],
];

/** The route a medication description makes obvious ("Ofloxacin 0.3 % Otic Solution" → in the ear), if any. */
export const prescriptionRoute = (description: string): PrescriptionRoute | undefined =>
  ROUTE_PATTERNS.find(([, pattern]) => pattern.test(description))?.[0];

const ROUTE_VERBS: Record<PrescriptionRoute, string> = {
  'by mouth': 'Take',
  'in the ear': 'Put',
  'in the eye': 'Put',
  'in the nose': 'Put',
  inhaled: 'Inhale',
  'on the skin': 'Apply',
  rectally: 'Insert',
  vaginally: 'Insert',
  'under the tongue': 'Take',
  'by injection': 'Inject',
};

/** The verb that opens the directions for a route ("Take", "Inhale", "Apply"); "Take" until one is picked. */
export const prescriptionVerb = (route: PrescriptionRoute | '' | undefined): string => ROUTE_VERBS[route || 'by mouth'];

/** Routes the verb already says: "Inhale 2 puffs inhaled" would repeat itself. */
const ROUTES_IN_VERB: readonly PrescriptionRoute[] = ['inhaled', 'by injection'];

/** Liquids for these routes are dosed in drops, and come in bottles whose size the description doesn't give. */
const DROP_ROUTES: readonly PrescriptionRoute[] = ['in the ear', 'in the eye', 'in the nose'];

const NASAL_SPRAY = /\b(spray|actuat(ion)?)\b|\/\s*(act|spray)\b/i;

/** How a dose of this form is counted ("tablet", "mL", "puff"); none when the form doesn't say (a cream). */
export const prescriptionDoseUnit = (
  form: PrescriptionDoseForm | undefined,
  route: PrescriptionRoute | undefined,
  description = ''
): string | undefined => {
  // A nasal spray is counted in sprays, as its label doses it ("2 sprays in each nostril").
  if (route === 'in the nose' && NASAL_SPRAY.test(description)) return 'spray';
  switch (form) {
    case 'liquid':
      return route && DROP_ROUTES.includes(route) ? 'drop' : 'mL';
    case 'inhaler':
      return 'puff';
    case 'tablet':
    case 'capsule':
    case 'patch':
    case 'suppository':
      return form;
    default:
      return undefined;
  }
};

/** How much drug is in one measure of a product: mg per mL of a liquid, or mg per tablet, capsule or puff. */
export interface StrengthConcentration {
  mgPerMl?: number;
  mgPerUnit?: number;
}

const MG_PER_UNIT: Record<string, number> = { mg: 1, mcg: 0.001, g: 1000, gm: 1000 };

// "400 MG/5ML", "80 MG/ML", "250 mg Cap", "1 GM Tab", "4 mg ODT Tab", "90 mcg/puff"; a combo's first ingredient ("400-57 mg/5ml");
// a salt with its base, dosed on the base ("144 (50 Base) MG/ML" is 50 mg/mL).
const STRENGTH_PATTERN =
  /(\d+(?:\.\d+)?)(?:\s*-\s*\d+(?:\.\d+)?)*\s*(?:\(\s*(\d+(?:\.\d+)?)\s*base\s*\)\s*)?(mg|mcg|gm|g)\b\s*(?:\/\s*(\d+(?:\.\d+)?)?\s*(ml)\b)?/i;

/** The concentration a strength or description states, in mg: per mL when it names a volume ("400 MG/5ML" →
 * 80 mg/mL), else per unit ("250 mg Cap" → 250); of the base when it names one ("144 (50 Base) MG/ML" → 50 mg/mL). Nothing for a percentage or units the mg don't follow from. */
export const parseStrengthConcentration = (text: string): StrengthConcentration | undefined => {
  const match = STRENGTH_PATTERN.exec(text);
  if (!match) return undefined;
  const mg = parseFloat(match[2] ?? match[1]) * MG_PER_UNIT[match[3].toLowerCase()];
  if (!match[5]) return { mgPerUnit: mg };
  const volume = match[4] === undefined ? 1 : parseFloat(match[4]);
  return volume > 0 ? { mgPerMl: mg / volume } : undefined;
};

/** "tablet" → "tablets" unless the amount is exactly 1; "mL" never changes. */
export const doseUnitLabel = (unit: string, amount: number | undefined): string =>
  unit === 'mL' || amount === 1 ? unit : /[^aeiou]y$/.test(unit) ? `${unit.slice(0, -1)}ies` : `${unit}s`;

/** The tablet fractions a scored tablet is split to, as the directions write them: on screen, and in the text sent to
 * the pharmacy (ASCII there, its encoding through the eRx service unchecked). */
const TABLET_FRACTIONS: [number, string, string][] = [
  [0.25, '¼', '1/4'],
  [0.5, '½', '1/2'],
  [0.75, '¾', '3/4'],
];

/** "½ tablet", "1½ tablets", "¼ tablet" for a part tablet ("1/2 tablet", "1 1/2 tablets" in `ascii`, for the text
 * sent); "2.5 mL", "2 tablets" otherwise. The dose itself stays a number; this is only how a sentence or the calculator
 * writes it. */
export const doseAmountText = (
  amount: number,
  unit: string,
  numberText: (value: number) => string = String,
  ascii = false
): string => {
  const whole = Math.floor(amount + 1e-9);
  const fraction =
    unit === 'tablet' ? TABLET_FRACTIONS.find(([part]) => Math.abs(amount - whole - part) < 1e-9) : undefined;
  if (!fraction) return `${numberText(amount)} ${doseUnitLabel(unit, amount)}`;
  const part = ascii ? `${whole ? `${whole} ` : ''}${fraction[2]}` : `${whole || ''}${fraction[1]}`;
  return `${part} ${amount < 1 ? unit : doseUnitLabel(unit, amount)}`;
};

export interface PrescriptionFrequency {
  /** How many doses a day it means, for the quantity to dispense: the most for an as-needed frequency, none
   * when "as needed" says nothing about how often. */
  dosesPerDay?: number;
  asNeeded: boolean;
  /** Leaves the how to someone else ("as directed", a dose pack's leaflet): never offered for a doses-a-day count. */
  directed?: boolean;
}

/** A dose pack is taken by its own leaflet and dispensed as one package. */
export const PER_PACKAGE_FREQUENCY = 'per package instructions';

/** Every frequency the form offers, scheduled ones first, keyed by how the directions read it. */
export const PRESCRIPTION_FREQUENCIES: Record<string, PrescriptionFrequency> = {
  'once daily': { dosesPerDay: 1, asNeeded: false },
  'twice daily': { dosesPerDay: 2, asNeeded: false },
  'three times daily': { dosesPerDay: 3, asNeeded: false },
  'four times daily': { dosesPerDay: 4, asNeeded: false },
  'every 4 hours': { dosesPerDay: 6, asNeeded: false },
  // A ranged frequency counts at its most frequent.
  'every 4 to 6 hours': { dosesPerDay: 6, asNeeded: false },
  'every 6 to 8 hours': { dosesPerDay: 4, asNeeded: false },
  'every 6 hours': { dosesPerDay: 4, asNeeded: false },
  'every 8 hours': { dosesPerDay: 3, asNeeded: false },
  'every 12 hours': { dosesPerDay: 2, asNeeded: false },
  'every other day': { dosesPerDay: 0.5, asNeeded: false },
  'at bedtime': { dosesPerDay: 1, asNeeded: false },
  'every 4 hours as needed': { dosesPerDay: 6, asNeeded: true },
  'every 4 to 6 hours as needed': { dosesPerDay: 6, asNeeded: true },
  'every 6 to 8 hours as needed': { dosesPerDay: 4, asNeeded: true },
  'every 6 hours as needed': { dosesPerDay: 4, asNeeded: true },
  'every 8 hours as needed': { dosesPerDay: 3, asNeeded: true },
  'as needed': { asNeeded: true },
  'as directed': { asNeeded: false, directed: true },
  [PER_PACKAGE_FREQUENCY]: { asNeeded: false, directed: true },
};

export const FREQUENCY_TITLE = 'Frequency';
export const DURATION_TITLE = 'Duration';
export const INSTRUCTIONS_TITLE = 'Instructions';

/** The standard durations a Duration blank offers. */
export const DURATIONS = ['3 days', '5 days', '7 days', '10 days', '14 days', '30 days'];

/** One step of a course ("1 tablet once daily for 4 days"). Strings, as the form holds them. */
export interface PrescriptionStep {
  dose: string;
  /** A key of `PRESCRIPTION_FREQUENCIES`. */
  frequency: string;
  durationDays: string;
}

/** The structured picks behind a prescription's directions: the first step, with the route, which every step
 * shares, the steps after it, for a taper, and any free text to end the sentence with. */
export interface PrescriptionDirections extends PrescriptionStep {
  route: PrescriptionRoute | '';
  steps?: PrescriptionStep[];
  /** Appended after the last step (", with spacer"). */
  instructions?: string;
}

/** What adding a suggestion writes into the prescription: the directions with the picks they came from. */
export interface SuggestedPrescriptionFields extends PrescriptionDirections {
  quantityValue: string;
  /** `''` when the dose form doesn't say (a spray): the prescription keeps the unit it has. */
  quantityUnit: QuantityUnit | '';
  daysSupply: string;
  numberOfRefills: string;
  patientInstructions: string;
}

/** The number a dose or duration starts with ("7.5 mL" → 7.5), if any. */
export const leadingNumber = (value: string | undefined): number | undefined => {
  const number = value === undefined ? NaN : parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
};

const pickedFrequency = (step: PrescriptionStep): string | undefined =>
  PRESCRIPTION_FREQUENCIES[step.frequency] ? step.frequency : undefined;

/** The first step and every later one with something picked: a "then" just added says and counts for nothing. */
const courseSteps = (directions: PrescriptionDirections): PrescriptionStep[] => [
  directions,
  ...(directions.steps ?? []).filter(
    (step) =>
      leadingNumber(step.dose) !== undefined || pickedFrequency(step) || leadingNumber(step.durationDays) !== undefined
  ),
];

/** The steps' values added up, or nothing when any step can't say. */
const total = (values: (number | undefined)[]): number | undefined =>
  values.every((value): value is number => value !== undefined)
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;

/** The quantity to dispense and the days supply for the picks, as the form holds them: `''` when they can't be
 * worked out. Dose × doses a day × days, summed over the steps and rounded up, an as-needed frequency at its most
 * frequent; one inhaler or dose pack whatever the doses; nothing for a cream or for drops, whose package sizes the
 * description doesn't give. */
export const prescriptionDispense = (
  description: string,
  directions: PrescriptionDirections
): { quantityValue: string; daysSupply: string } => {
  const form = prescriptionDoseForm(description);
  const steps = courseSteps(directions);
  const stepDays = steps.map((step) => leadingNumber(step.durationDays));
  const days = total(stepDays);
  const daysSupply = days === undefined ? '' : String(days);
  if (form === 'inhaler' || steps.some((step) => step.frequency === PER_PACKAGE_FREQUENCY)) {
    return { quantityValue: '1', daysSupply };
  }
  const uncounted =
    form === undefined ||
    form === 'topical' ||
    (form === 'liquid' && DROP_ROUTES.includes(directions.route as PrescriptionRoute));
  const doses = total(
    steps.map((step, i) => {
      const amount = leadingNumber(step.dose);
      const perDay = PRESCRIPTION_FREQUENCIES[step.frequency]?.dosesPerDay;
      const days = stepDays[i];
      return amount !== undefined && perDay !== undefined && days !== undefined ? amount * perDay * days : undefined;
    })
  );
  const quantity = !uncounted && doses !== undefined ? Math.ceil(doses) : undefined;
  return { quantityValue: quantity === undefined ? '' : String(quantity), daysSupply };
};

/** The directions sentence for the picks ("Take 5 mL by mouth twice daily for 10 days."), or `''` until a dose,
 * frequency or instructions are picked: a route alone says nothing. The verb follows the route, the dose unit the
 * dose form; an as-needed duration reads "for up to". Later steps follow as ", then 1 tablet by mouth once daily for
 * 4 days", a "directed" frequency keeps the route ("Take 14 mL by mouth as directed."), and the instructions end
 * the sentence (", with spacer"). `ascii` writes tablet fractions "1/2" for the text sent to the pharmacy. */
export const prescriptionDirectionsText = (
  description: string,
  directions: PrescriptionDirections,
  { ascii = false }: { ascii?: boolean } = {}
): string => {
  const route = directions.route || undefined;
  const unit = prescriptionDoseUnit(prescriptionDoseForm(description), route, description);
  const phrase = (step: PrescriptionStep, opening: string): string => {
    const amount = leadingNumber(step.dose);
    const frequency = pickedFrequency(step);
    const days = leadingNumber(step.durationDays);
    const dose = amount === undefined ? '' : unit ? doseAmountText(amount, unit, String, ascii) : String(amount);
    const duration =
      days === undefined
        ? ''
        : `for ${PRESCRIPTION_FREQUENCIES[frequency ?? '']?.asNeeded ? 'up to ' : ''}${days} ${
            days === 1 ? 'day' : 'days'
          }`;
    const where = route && !ROUTES_IN_VERB.includes(route) ? route : '';
    return assembleSentence([opening, ' ', dose, ' ', where, ' ', frequency ?? '', ' ', duration], []);
  };
  const [first, ...rest] = courseSteps(directions);
  const bare = leadingNumber(first.dose) === undefined && !pickedFrequency(first);
  const instructions = (directions.instructions ?? '').trim().replace(/\.$/, '');
  if (bare && !instructions) return '';
  const course = [phrase(first, prescriptionVerb(route)), ...rest.map((step) => phrase(step, 'then'))].join(', ');
  // "Inhale with spacer", not "Inhale, with spacer": a comma only once a step says something to follow.
  const tail = instructions ? `${bare && rest.length === 0 ? ' ' : ', '}${instructions}` : '';
  return `${course}${tail}.`;
};

/** The scheduled frequency that means this many doses a day ("twice daily" for 2), if the list has one. */
export const frequencyForDosesPerDay = (dosesPerDay: number): string | undefined =>
  Object.keys(PRESCRIPTION_FREQUENCIES).find((key) => {
    const frequency = PRESCRIPTION_FREQUENCIES[key];
    return !frequency.asNeeded && !frequency.directed && frequency.dosesPerDay === dosesPerDay;
  });

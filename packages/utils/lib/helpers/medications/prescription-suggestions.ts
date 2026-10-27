import { MedicationProductDetails } from '../../types/api/erx-search.types';
import { QuantityUnit } from '../../types/api/order-prescription.types';
import { assembleSentence } from '../suggested-sentences';

/**
 * What an eRx line can work out from a product's structured details (its RxNorm dose form and ingredients, never its
 * name): its dose form and route, the unit it is dispensed in, and, from the dose, frequency and duration picked, the
 * directions sentence and the quantity to dispense. Nothing here depends on the drug itself or the chart.
 */

/** The product facts the helpers read. */
export type PrescriptionProduct = Pick<MedicationProductDetails, 'doseForm' | 'ingredients'>;

export type PrescriptionDoseForm = 'tablet' | 'capsule' | 'liquid' | 'inhaler' | 'topical' | 'patch' | 'suppository';

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

/** What a dose form says: how the line counts and dispenses it, its route, and the unit a dose is counted in. */
interface DoseFormFacts {
  form?: PrescriptionDoseForm;
  route?: PrescriptionRoute;
  unit?: string;
}

const ORAL_TABLET: DoseFormFacts = { form: 'tablet', route: 'by mouth', unit: 'tablet' };
const ORAL_CAPSULE: DoseFormFacts = { form: 'capsule', route: 'by mouth', unit: 'capsule' };
const ORAL_LIQUID: DoseFormFacts = { form: 'liquid', route: 'by mouth', unit: 'mL' };
const INHALER: DoseFormFacts = { form: 'inhaler', route: 'inhaled', unit: 'puff' };
const NASAL_SPRAY: DoseFormFacts = { route: 'in the nose', unit: 'spray' };

/** RxNorm dose forms by their exact names (a controlled vocabulary), matched exactly: a form not listed implies
 * nothing, and the provider fills the route and unit. A spray has no dose form of the line's: its quantity unit stays
 * the provider's. A pack (a dose pack, a kit) says nothing of how it is taken. */
const DOSE_FORMS: Record<string, DoseFormFacts> = {
  'Oral Tablet': ORAL_TABLET,
  'Chewable Tablet': ORAL_TABLET,
  'Disintegrating Oral Tablet': ORAL_TABLET,
  'Delayed Release Oral Tablet': ORAL_TABLET,
  'Extended Release Oral Tablet': ORAL_TABLET,
  'Sublingual Tablet': { form: 'tablet', route: 'under the tongue', unit: 'tablet' },
  'Oral Capsule': ORAL_CAPSULE,
  'Delayed Release Oral Capsule': ORAL_CAPSULE,
  'Extended Release Oral Capsule': ORAL_CAPSULE,
  'Oral Suspension': ORAL_LIQUID,
  'Oral Solution': ORAL_LIQUID,
  'Powder for Oral Suspension': ORAL_LIQUID,
  'Powder for Oral Solution': ORAL_LIQUID,
  'Metered Dose Inhaler': INHALER,
  'Inhalation Spray': INHALER,
  'Dry Powder Inhaler': INHALER,
  'Inhalation Solution': { form: 'liquid', route: 'inhaled', unit: 'mL' },
  'Inhalation Suspension': { form: 'liquid', route: 'inhaled', unit: 'mL' },
  'Nasal Spray': NASAL_SPRAY,
  'Metered Dose Nasal Spray': NASAL_SPRAY,
  'Nasal Solution': { form: 'liquid', route: 'in the nose', unit: 'drop' },
  'Ophthalmic Solution': { form: 'liquid', route: 'in the eye', unit: 'drop' },
  'Ophthalmic Suspension': { form: 'liquid', route: 'in the eye', unit: 'drop' },
  'Ophthalmic Ointment': { form: 'topical', route: 'in the eye' },
  'Otic Solution': { form: 'liquid', route: 'in the ear', unit: 'drop' },
  'Otic Suspension': { form: 'liquid', route: 'in the ear', unit: 'drop' },
  'Topical Cream': { form: 'topical', route: 'on the skin' },
  'Topical Ointment': { form: 'topical', route: 'on the skin' },
  'Topical Gel': { form: 'topical', route: 'on the skin' },
  'Topical Lotion': { route: 'on the skin' },
  'Topical Solution': { route: 'on the skin' },
  'Topical Spray': { route: 'on the skin' },
  'Transdermal System': { form: 'patch', route: 'on the skin', unit: 'patch' },
  'Rectal Suppository': { form: 'suppository', route: 'rectally', unit: 'suppository' },
  'Vaginal Cream': { form: 'topical', route: 'vaginally' },
  'Injectable Solution': { form: 'liquid', route: 'by injection', unit: 'mL' },
  'Injectable Suspension': { form: 'liquid', route: 'by injection', unit: 'mL' },
  'Auto-Injector': { route: 'by injection' },
  Pack: {},
};

/** The facts of the product's dose form, if it has one the table lists. Object.hasOwn, as utils' lib setting (no
 * es2022) spells it: "constructor" is no dose form. */
const doseFormFacts = (product: PrescriptionProduct | null | undefined): DoseFormFacts | undefined => {
  const doseForm = product?.doseForm;
  return doseForm !== undefined && Object.prototype.hasOwnProperty.call(DOSE_FORMS, doseForm)
    ? DOSE_FORMS[doseForm]
    : undefined;
};

/** The line's dose form for a product ("Oral Capsule" → capsule), if its RxNorm dose form says. */
export const prescriptionDoseForm = (
  product: PrescriptionProduct | null | undefined
): PrescriptionDoseForm | undefined => doseFormFacts(product)?.form;

/** The route a product's dose form makes obvious ("Otic Solution" → in the ear), if any. */
export const prescriptionRoute = (product: PrescriptionProduct | null | undefined): PrescriptionRoute | undefined =>
  doseFormFacts(product)?.route;

/** How a dose of the product is counted ("tablet", "mL", "puff", "spray", "drop"); none when its dose form doesn't
 * say (a cream). */
export const prescriptionDoseUnit = (product: PrescriptionProduct | null | undefined): string | undefined =>
  doseFormFacts(product)?.unit;

/** More than one active ingredient: no one mg the calculator, a strength change or a maximum goes by on its own. */
export const isCombinationProduct = (product: PrescriptionProduct | null | undefined): boolean =>
  (product?.ingredients?.length ?? 0) > 1;

const QUANTITY_UNIT: Record<PrescriptionDoseForm, QuantityUnit> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Milliliter',
  inhaler: 'Inhaler',
  topical: 'Gram',
  patch: 'Patch',
  suppository: 'Suppository',
};

/** The unit a product is dispensed in, when its dose form says. */
export const prescriptionQuantityUnit = (product: PrescriptionProduct | null | undefined): QuantityUnit | undefined => {
  const form = prescriptionDoseForm(product);
  return form && QUANTITY_UNIT[form];
};

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
export const ROUTES_IN_VERB: readonly PrescriptionRoute[] = ['inhaled', 'by injection'];

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
export const doseAmountText = (amount: number, unit: string, ascii = false): string => {
  const whole = Math.floor(amount + 1e-9);
  const fraction =
    unit === 'tablet' ? TABLET_FRACTIONS.find(([part]) => Math.abs(amount - whole - part) < 1e-9) : undefined;
  if (!fraction) return `${amount} ${doseUnitLabel(unit, amount)}`;
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

/** Every frequency the form offers, scheduled ones first, keyed by how the directions read it. Look one up with
 * `prescriptionFrequency`, never by indexing: "constructor" is a key of every object. */
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

/** The frequency a key names, if it is one of the form's own ("toString" isn't). Object.hasOwn, as utils' lib
 * setting (no es2022) spells it. */
export const prescriptionFrequency = (key: string | undefined): PrescriptionFrequency | undefined =>
  key !== undefined && Object.prototype.hasOwnProperty.call(PRESCRIPTION_FREQUENCIES, key)
    ? PRESCRIPTION_FREQUENCIES[key]
    : undefined;

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
const leadingNumber = (value: string | undefined): number | undefined => {
  const number = value === undefined ? NaN : parseFloat(value);
  return Number.isFinite(number) ? number : undefined;
};

const pickedFrequency = (step: PrescriptionStep): string | undefined =>
  prescriptionFrequency(step.frequency) ? step.frequency : undefined;

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
 * product's details don't give. */
export const prescriptionDispense = (
  product: PrescriptionProduct | null | undefined,
  directions: PrescriptionDirections
): { quantityValue: string; daysSupply: string } => {
  const form = prescriptionDoseForm(product);
  const steps = courseSteps(directions);
  const stepDays = steps.map((step) => leadingNumber(step.durationDays));
  const days = total(stepDays);
  const daysSupply = days === undefined ? '' : String(days);
  if (form === 'inhaler' || steps.some((step) => step.frequency === PER_PACKAGE_FREQUENCY)) {
    return { quantityValue: '1', daysSupply };
  }
  const uncounted = form === undefined || form === 'topical' || prescriptionDoseUnit(product) === 'drop';
  const doses = total(
    steps.map((step, i) => {
      const amount = leadingNumber(step.dose);
      const perDay = prescriptionFrequency(step.frequency)?.dosesPerDay;
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
  product: PrescriptionProduct | null | undefined,
  directions: PrescriptionDirections,
  { ascii = false }: { ascii?: boolean } = {}
): string => {
  const route = directions.route || undefined;
  const unit = prescriptionDoseUnit(product);
  const phrase = (step: PrescriptionStep, opening: string): string => {
    const amount = leadingNumber(step.dose);
    const frequency = pickedFrequency(step);
    const days = leadingNumber(step.durationDays);
    const dose = amount === undefined ? '' : unit ? doseAmountText(amount, unit, ascii) : String(amount);
    const duration =
      days === undefined
        ? ''
        : `for ${prescriptionFrequency(frequency)?.asNeeded ? 'up to ' : ''}${days} ${days === 1 ? 'day' : 'days'}`;
    const where = route && !ROUTES_IN_VERB.includes(route) ? route : '';
    return assembleSentence([opening, ' ', dose, ' ', where, ' ', frequency ?? '', ' ', duration], []);
  };
  const [first, ...rest] = courseSteps(directions);
  const bare = leadingNumber(first.dose) === undefined && !pickedFrequency(first);
  const instructions = (directions.instructions ?? '').trim().replace(/\.$/, '');
  if (bare && rest.length === 0 && !instructions) return '';
  // An empty first step before filled "then" steps says nothing: the first filled one opens the sentence.
  const empty = bare && leadingNumber(first.durationDays) === undefined;
  const said = empty && rest.length ? rest : [first, ...rest];
  const course = said.map((step, i) => phrase(step, i === 0 ? prescriptionVerb(route) : 'then')).join(', ');
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

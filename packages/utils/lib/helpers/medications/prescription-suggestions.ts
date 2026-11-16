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

export type PrescriptionDoseForm =
  | 'tablet'
  | 'capsule'
  | 'liquid'
  | 'inhaler'
  | 'topical'
  | 'patch'
  | 'suppository'
  | 'packet'
  | 'lozenge'
  | 'insert';

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
 * nothing, and the provider fills the route and writes the amount in the directions. A spray has no dose form of the
 * line's: its quantity unit stays the provider's. A pack (a dose pack, a kit) says nothing of how it is taken.
 * "Granules for Oral Suspension" isn't listed: it's a packet (esomeprazole) or a bottle dosed in mL (baloxavir). */
const DOSE_FORMS: Record<string, DoseFormFacts> = {
  'Oral Tablet': ORAL_TABLET,
  'Chewable Tablet': ORAL_TABLET,
  'Tablet for Oral Suspension': ORAL_TABLET,
  'Effervescent Oral Tablet': ORAL_TABLET,
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
  'Granules for Oral Solution': ORAL_LIQUID,
  'Oral Granules': { form: 'packet', route: 'by mouth', unit: 'packet' },
  'Oral Lozenge': { form: 'lozenge', route: 'by mouth', unit: 'lozenge' },
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
  'Medicated Patch': { form: 'patch', route: 'on the skin', unit: 'patch' },
  // Swished and spat, not swallowed: no route.
  Mouthwash: { unit: 'mL' },
  'Rectal Suppository': { form: 'suppository', route: 'rectally', unit: 'suppository' },
  'Vaginal Cream': { form: 'topical', route: 'vaginally' },
  'Vaginal Insert': { form: 'insert', route: 'vaginally', unit: 'insert' },
  'Injectable Solution': { form: 'liquid', route: 'by injection', unit: 'mL' },
  'Injectable Suspension': { form: 'liquid', route: 'by injection', unit: 'mL' },
  'Auto-Injector': { route: 'by injection' },
  Pack: {},
};

/** The facts of the product's dose form, if it has one the table lists. Object.hasOwn, as utils' lib setting (no
 * es2022) spells it: "constructor" is no dose form. A liquid whose strength isn't per mL (a powder dosed per packet or
 * capful, "17000 MG Powder for Oral Solution", a fosfomycin sachet) keeps only its route: it isn't counted or dispensed in mL. Such a powder
 * of one ingredient in mg is dosed in g ("Take 17 g by mouth") from 1000 mg a packet, in packets below ("Take 3 packets"
 * of sapropterin 100 mg, never 3 g), never measured or dispensed by the line (decisions 203, 218). A sachet of granules
 * for oral solution is dispensed in packets (decision 231), as is a powder for oral solution dosed in packets; one
 * dosed in g isn't, as MiraLAX's 17000 MG is a capful of a bottle as often as a packet (decision 236). */
const doseFormFacts = (product: PrescriptionProduct | null | undefined): DoseFormFacts | undefined => {
  const doseForm = product?.doseForm;
  const facts =
    doseForm !== undefined && Object.prototype.hasOwnProperty.call(DOSE_FORMS, doseForm)
      ? DOSE_FORMS[doseForm]
      : undefined;
  const ingredients = product?.ingredients ?? [];
  if (!(facts?.unit === 'mL' && ingredients.length && ingredients.every((item) => item.perUnit !== 'ML'))) return facts;
  const [only] = ingredients;
  const packet =
    ingredients.length === 1 &&
    only.unit === 'MG' &&
    only.perUnit === 'EACH' &&
    /^(?:Powder|Granules) for/.test(doseForm ?? '');
  if (!packet) return { route: facts.route };
  const unit = only.amount >= 1000 ? 'g' : 'packet';
  const counted = /^Granules/.test(doseForm ?? '') || (doseForm === 'Powder for Oral Solution' && unit === 'packet');
  return counted ? { form: 'packet', route: facts.route, unit } : { route: facts.route, unit };
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
  packet: 'Packet',
  lozenge: 'Lozenge',
  insert: 'Insert',
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

/** "tablet" → "tablets" ("patch" → "patches") unless the amount is exactly 1; "mL" and "g" never change. */
export const doseUnitLabel = (unit: string, amount: number | undefined): string =>
  unit === 'mL' || unit === 'g' || amount === 1
    ? unit
    : /[^aeiou]y$/.test(unit)
    ? `${unit.slice(0, -1)}ies`
    : /(?:ch|sh|s|x)$/.test(unit)
    ? `${unit}es`
    : `${unit}s`;

/** The tablet fractions a scored tablet is split to, as the directions write them: on screen, and in the text sent to
 * the pharmacy (ASCII there, its encoding through the eRx service unchecked). */
const TABLET_FRACTIONS: [number, string, string][] = [
  [0.25, '¼', '1/4'],
  [0.5, '½', '1/2'],
  [0.75, '¾', '3/4'],
];

/** A half as the text sent writes it: "half", "1 and a half". ISMP lists "1/2 tablet" as error-prone (read as 1 or 2
 * tablets) and asks for words. */
export const halfInWords = (whole: string): string => (whole ? `${whole} and a half` : 'half');

/** "½ tablet", "1½ tablets", "¼ tablet" for a part tablet ("half tablet", "1 and a half tablets", "1/4 tablet" in
 * `ascii`, for the text sent); "2.5 mL", "2 tablets" otherwise. The dose itself stays a number; this is only how a
 * sentence or the calculator writes it. */
export const doseAmountText = (amount: number, unit: string, ascii = false): string => {
  const whole = Math.floor(amount + 1e-9);
  const fraction =
    unit === 'tablet' ? TABLET_FRACTIONS.find(([part]) => Math.abs(amount - whole - part) < 1e-9) : undefined;
  if (!fraction) return `${amount} ${doseUnitLabel(unit, amount)}`;
  const part = !ascii
    ? `${whole || ''}${fraction[1]}`
    : fraction[0] === 0.5
    ? halfInWords(whole ? String(whole) : '')
    : `${whole ? `${whole} ` : ''}${fraction[2]}`;
  return `${part} ${amount < 1 ? unit : doseUnitLabel(unit, amount)}`;
};

export interface PrescriptionFrequency {
  /** How many doses a day it means, for the quantity to dispense: the most for an as-needed frequency, none
   * when "as needed" says nothing about how often. */
  dosesPerDay?: number;
  asNeeded: boolean;
  /** One dose, once: no days to give, one day's supply. */
  singleDose?: boolean;
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
  // A single dose (fluconazole 150 mg once): the day's whole amount, for mg/kg per day too.
  once: { dosesPerDay: 1, asNeeded: false, singleDose: true },
  'every 4 hours as needed': { dosesPerDay: 6, asNeeded: true },
  'every 4 to 6 hours as needed': { dosesPerDay: 6, asNeeded: true },
  'every 6 to 8 hours as needed': { dosesPerDay: 4, asNeeded: true },
  'every 6 hours as needed': { dosesPerDay: 4, asNeeded: true },
  'every 8 hours as needed': { dosesPerDay: 3, asNeeded: true },
  'as needed': { asNeeded: true },
  'as directed': { asNeeded: false },
  [PER_PACKAGE_FREQUENCY]: { asNeeded: false },
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

/** The steps the directions sentence says: an empty first step before filled "then" steps says nothing, the first
 * filled one opening the sentence. */
export const sentenceSteps = (directions: PrescriptionDirections): PrescriptionStep[] => {
  const [first, ...rest] = courseSteps(directions);
  const empty =
    leadingNumber(first.dose) === undefined &&
    !pickedFrequency(first) &&
    leadingNumber(first.durationDays) === undefined;
  return empty && rest.length ? rest : [first, ...rest];
};

/** The steps' values added up, or nothing when any step can't say. */
const total = (values: (number | undefined)[]): number | undefined =>
  values.every((value): value is number => value !== undefined)
    ? values.reduce((sum, value) => sum + value, 0)
    : undefined;

/** The quantity to dispense and the days supply for the picks, as the form holds them: `''` when they can't be
 * worked out. Dose × doses a day × days (every other day: a dose on days 1, 3, 5 …), summed over the steps and
 * rounded up, an as-needed frequency at its most frequent; one inhaler or dose pack whatever the doses; a sachet dosed
 * in g in sachets (3 g of a 3000 mg sachet is 1); nothing for a cream or for drops, whose package sizes the product's
 * details don't give. */
export const prescriptionDispense = (
  product: PrescriptionProduct | null | undefined,
  directions: PrescriptionDirections
): { quantityValue: string; daysSupply: string } => {
  const form = prescriptionDoseForm(product);
  const steps = courseSteps(directions);
  // A single dose is one day's, whatever days are left from another frequency.
  const stepDays = steps.map((step) =>
    prescriptionFrequency(step.frequency)?.singleDose ? 1 : leadingNumber(step.durationDays)
  );
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
      if (amount === undefined || perDay === undefined || days === undefined) return undefined;
      // Under once a day, the doses fall on days 1, 3, 5 …: 7 days every other day is 4 doses.
      return amount * (perDay < 1 ? Math.ceil(perDay * days) : perDay * days);
    })
  );
  const sachetMg =
    form === 'packet' && prescriptionDoseUnit(product) === 'g' ? product?.ingredients?.[0]?.amount : undefined;
  const counted = doses !== undefined && sachetMg ? (doses * 1000) / sachetMg : doses;
  const quantity = !uncounted && counted !== undefined ? Math.ceil(counted) : undefined;
  return { quantityValue: quantity === undefined ? '' : String(quantity), daysSupply };
};

/** The directions sentence for the picks ("Take 5 mL by mouth twice daily for 10 days."), or `''` until a dose,
 * frequency or instructions are picked: a route alone says nothing. The verb follows the route, the dose unit the
 * dose form; an as-needed duration reads "for up to". Later steps follow as ", then 1 tablet by mouth once daily for
 * 4 days", a "directed" frequency keeps the route ("Take 14 mL by mouth as directed."), and the instructions end
 * the sentence (", with spacer"). `ascii` writes tablet fractions as the text sent to the pharmacy does ("half", "1/4"). */
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
    // A single dose reads "once", with no days.
    const days = prescriptionFrequency(frequency)?.singleDose ? undefined : leadingNumber(step.durationDays);
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
  const course = sentenceSteps(directions)
    .map((step, i) => phrase(step, i === 0 ? prescriptionVerb(route) : 'then'))
    .join(', ');
  // "Inhale with spacer", not "Inhale, with spacer": a comma only once a step says something to follow.
  const tail = instructions ? `${bare && rest.length === 0 ? ' ' : ', '}${instructions}` : '';
  return `${course}${tail}.`;
};

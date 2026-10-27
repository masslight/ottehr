import { DOSE_BASES, DoseBasis } from 'utils/lib/helpers/medications/plain-dose';
import {
  PRESCRIPTION_FREQUENCIES,
  prescriptionFrequency,
} from 'utils/lib/helpers/medications/prescription-suggestions';
import { MedicationProductDetails } from 'utils/lib/types/api/erx-search.types';
import { QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { z } from 'zod';
import { productDetailsOf } from '../../../in-person/components/erx/prescriptionLines';

/** How the quick pick doses: its directions as written, or the dose calculator's settings, re-dosed per patient. */
export type PrescriptionDoseMode = 'as-written' | 'dosing';

/** The admin dialog's fields; numbers stay strings while typed. */
export interface PrescriptionQuickPickFormValues {
  name: string;
  ndc: string;
  medicationDescription: string;
  /** The picked product's RxCUI, dose form and ingredients, saved with it; none on a quick pick saved before them
   * until its product is picked again. */
  productDetails: MedicationProductDetails;
  doseMode: PrescriptionDoseMode;
  patientInstructions: string;
  quantityValue: string;
  quantityUnit: QuantityUnit | '';
  daysSupply: string;
  rate: string;
  basis: DoseBasis;
  frequency: string;
  dosesPerDay: string;
  durationDays: string;
  maxPerDoseMg: string;
  maxPerDayMg: string;
  numberOfRefills: string;
  substitutionAllowed: boolean;
  noteToPharmacy: string;
  sourceLabel: string;
  sourceUrl: string;
}

export type PrescriptionQuickPickFormErrors = Partial<Record<keyof PrescriptionQuickPickFormValues, string>>;

/** The basis choices, worded as the list's dose summary reads. */
export const BASIS_LABELS: Record<DoseBasis, string> = {
  'mg/kg/dose': 'mg/kg per dose',
  'mg/kg/day': 'mg/kg per day',
  fixed: 'mg per dose (fixed)',
};

const text = (value: number | undefined): string => (value === undefined ? '' : String(value));

export const emptyPrescriptionQuickPickForm = (): PrescriptionQuickPickFormValues => ({
  name: '',
  ndc: '',
  medicationDescription: '',
  productDetails: {},
  doseMode: 'as-written',
  patientInstructions: '',
  quantityValue: '',
  quantityUnit: '',
  daysSupply: '',
  rate: '',
  basis: 'mg/kg/dose',
  frequency: '',
  dosesPerDay: '',
  durationDays: '',
  maxPerDoseMg: '',
  maxPerDayMg: '',
  numberOfRefills: '0',
  substitutionAllowed: true,
  noteToPharmacy: '',
  sourceLabel: '',
  sourceUrl: '',
});

export const prescriptionQuickPickFormValues = (
  quickPick: PrescriptionQuickPickData
): PrescriptionQuickPickFormValues => {
  const { dosing, source } = quickPick;
  return {
    ...emptyPrescriptionQuickPickForm(),
    name: quickPick.name,
    ndc: quickPick.ndc ?? '',
    medicationDescription: quickPick.medicationDescription ?? '',
    productDetails: productDetailsOf(quickPick),
    doseMode: dosing ? 'dosing' : 'as-written',
    patientInstructions: quickPick.patientInstructions ?? '',
    quantityValue: text(quickPick.quantityValue),
    quantityUnit: quickPick.quantityUnit ?? '',
    daysSupply: text(quickPick.daysSupply),
    ...(dosing
      ? {
          rate: String(dosing.rate),
          basis: dosing.basis,
          frequency: dosing.frequency ?? '',
          dosesPerDay: text(dosing.dosesPerDay),
          durationDays: text(dosing.durationDays),
          maxPerDoseMg: text(dosing.maxPerDoseMg),
          maxPerDayMg: text(dosing.maxPerDayMg),
        }
      : {}),
    numberOfRefills: text(quickPick.numberOfRefills ?? 0),
    substitutionAllowed: quickPick.substitutionAllowed ?? true,
    noteToPharmacy: quickPick.noteToPharmacy ?? '',
    sourceLabel: source?.label ?? '',
    sourceUrl: source?.url ?? '',
  };
};

// The backend's limits (admin-create-quick-pick), checked on the typed strings with messages for the dialog.
const blank = (value: string): boolean => value.trim() === '';
const optionalNumber = (check: (n: number) => boolean, message: string): z.ZodType<string> =>
  z.string().refine((value) => blank(value) || (Number.isFinite(Number(value)) && check(Number(value))), message);
const positive = (label: string): z.ZodType<string> => optionalNumber((n) => n > 0, `${label} must be greater than 0`);
const wholeNumber = (label: string, min: number, max: number): z.ZodType<string> =>
  optionalNumber(
    (n) => Number.isInteger(n) && n >= min && n <= max,
    `${label} must be a whole number from ${min} to ${max}`
  );

const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const FormSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    medicationDescription: z.string().max(105, 'Medication name must be up to 105 characters'),
    ndc: z.string().refine((value) => blank(value) || /^\d{11}$/.test(value), 'Medication must have an 11-digit NDC'),
    doseMode: z.enum(['as-written', 'dosing']),
    patientInstructions: z.string().trim().max(1000, 'Directions must be up to 1000 characters'),
    quantityValue: positive('Quantity'),
    quantityUnit: z.union([z.enum(QUANTITY_UNITS), z.literal('')]),
    daysSupply: wholeNumber('Days supply', 1, 999),
    rate: z.string(),
    basis: z.enum(DOSE_BASES),
    frequency: z
      .string()
      .refine((value) => blank(value) || prescriptionFrequency(value) !== undefined, 'Pick a frequency'),
    dosesPerDay: positive('Doses a day'),
    durationDays: wholeNumber('Duration', 1, 999),
    maxPerDoseMg: positive('Maximum per dose'),
    maxPerDayMg: positive('Maximum per day'),
    numberOfRefills: z
      .string()
      .refine(
        (value) => !blank(value) && Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= 99,
        'Refills must be a whole number from 0 to 99'
      ),
    substitutionAllowed: z.boolean(),
    noteToPharmacy: z.string().trim().max(210, 'Note to pharmacy must be up to 210 characters'),
    sourceLabel: z.string().trim().max(200, 'Source must be up to 200 characters'),
    sourceUrl: z.string().refine((value) => blank(value) || isHttpsUrl(value.trim()), 'Link must be an https link'),
  })
  .superRefine((values, ctx) => {
    const issue = (path: keyof PrescriptionQuickPickFormValues, message: string): void =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (!blank(values.sourceUrl) && blank(values.sourceLabel)) issue('sourceLabel', 'Source is required with a link');
    if (values.doseMode !== 'dosing') return;
    if (blank(values.ndc)) issue('ndc', 'Pick a medication and strength to dose by weight');
    if (blank(values.rate) || !(Number(values.rate) > 0)) issue('rate', 'Dose must be greater than 0');
    if (values.basis === 'mg/kg/day' && blank(values.dosesPerDay)) {
      issue('dosesPerDay', 'Doses a day is required for mg/kg per day');
    }
    // The doses a day follow a frequency that gives a count (picking one fills them in), as the backend checks.
    const count = dosesPerDayOf(values.frequency);
    if (count !== undefined && !blank(values.dosesPerDay) && Number(values.dosesPerDay) !== count) {
      issue('dosesPerDay', `Doses a day must be ${count} for ${values.frequency}`);
    }
    if (!blank(values.maxPerDayMg) && blank(values.dosesPerDay) && count === undefined) {
      issue('maxPerDayMg', 'A maximum per day needs the doses a day or a frequency that gives them');
    }
  });

const numberOrUndefined = (value: string): number | undefined => (blank(value) ? undefined : Number(value));

/** The quick pick the dialog saves, or the problems with each field. A pick dosed by weight keeps no written
 * directions, quantity or days supply: the order form works those out from the dose for each patient. */
export const prescriptionQuickPickFromForm = (
  input: PrescriptionQuickPickFormValues
):
  | { quickPick: Omit<PrescriptionQuickPickData, 'id'>; errors?: undefined }
  | { errors: PrescriptionQuickPickFormErrors } => {
  // Only the chosen way of dosing is checked and saved: the other's fields are hidden.
  const values: PrescriptionQuickPickFormValues =
    input.doseMode === 'dosing'
      ? { ...input, patientInstructions: '', quantityValue: '', quantityUnit: '', daysSupply: '' }
      : { ...input, rate: '', frequency: '', dosesPerDay: '', durationDays: '', maxPerDoseMg: '', maxPerDayMg: '' };
  const result = FormSchema.safeParse(values);
  if (!result.success) {
    const errors: PrescriptionQuickPickFormErrors = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof PrescriptionQuickPickFormValues;
      errors[key] ??= issue.message;
    }
    return { errors };
  }
  const v = values;
  const dosesPerDay = numberOrUndefined(v.dosesPerDay);
  const durationDays = numberOrUndefined(v.durationDays);
  const maxPerDoseMg = numberOrUndefined(v.maxPerDoseMg);
  const maxPerDayMg = numberOrUndefined(v.maxPerDayMg);
  const quantityValue = numberOrUndefined(v.quantityValue);
  const daysSupply = numberOrUndefined(v.daysSupply);
  return {
    quickPick: {
      name: v.name.trim(),
      ...(v.ndc
        ? { ndc: v.ndc, medicationDescription: v.medicationDescription.trim(), ...productDetailsOf(v.productDetails) }
        : {}),
      ...(v.doseMode === 'dosing'
        ? {
            dosing: {
              rate: Number(v.rate),
              basis: v.basis,
              ...(dosesPerDay !== undefined ? { dosesPerDay } : {}),
              ...(v.frequency ? { frequency: v.frequency } : {}),
              ...(durationDays !== undefined ? { durationDays } : {}),
              ...(maxPerDoseMg !== undefined ? { maxPerDoseMg } : {}),
              ...(maxPerDayMg !== undefined ? { maxPerDayMg } : {}),
            },
          }
        : {
            ...(v.patientInstructions.trim() ? { patientInstructions: v.patientInstructions.trim() } : {}),
            ...(quantityValue !== undefined ? { quantityValue } : {}),
            ...(v.quantityUnit ? { quantityUnit: v.quantityUnit } : {}),
            ...(daysSupply !== undefined ? { daysSupply } : {}),
          }),
      numberOfRefills: Number(v.numberOfRefills),
      substitutionAllowed: v.substitutionAllowed,
      ...(v.noteToPharmacy.trim() ? { noteToPharmacy: v.noteToPharmacy.trim() } : {}),
      ...(v.sourceLabel.trim()
        ? { source: { label: v.sourceLabel.trim(), ...(v.sourceUrl.trim() ? { url: v.sourceUrl.trim() } : {}) } }
        : {}),
    },
  };
};

/** The order form's frequencies, for the dosing's frequency choice. */
export const FREQUENCY_OPTIONS = Object.keys(PRESCRIPTION_FREQUENCIES);

/** The doses a day a frequency gives, when it gives a count ("as needed" doesn't). */
export const dosesPerDayOf = (frequency: string): number | undefined => prescriptionFrequency(frequency)?.dosesPerDay;

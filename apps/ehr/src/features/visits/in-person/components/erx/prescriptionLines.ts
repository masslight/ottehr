import { MedicationSearchResult, PharmacySearchResult } from 'utils/lib/types/api/erx-search.types';
import { OrderPrescriptionInput, QUANTITY_UNITS, QuantityUnit } from 'utils/lib/types/api/order-prescription.types';
import { PrescriptionQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { z } from 'zod';

/** One numbered prescription on the eRx page, as the sentences hold it: numbers stay strings while typed. */
export interface PrescriptionLine {
  /** Stable React key; lines are added and removed in any order. */
  key: number;
  medication: MedicationSearchResult | null;
  quantityValue: string;
  quantityUnit: QuantityUnit | '';
  daysSupply: string;
  numberOfRefills: string;
  substitutionAllowed: boolean;
  patientInstructions: string;
  diagnosis: { code: string; display: string } | null;
}

let nextKey = 0;

export const emptyPrescriptionLine = (): PrescriptionLine => ({
  key: nextKey++,
  medication: null,
  quantityValue: '',
  quantityUnit: '',
  daysSupply: '',
  numberOfRefills: '0',
  substitutionAllowed: true,
  patientInstructions: '',
  diagnosis: null,
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
  diagnosis: z.object({ code: z.string().min(1), display: z.string() }, { invalid_type_error: 'Add a diagnosis' }),
});

/** Every problem with the line, in sentence order; empty when it can be sent. */
export const prescriptionLineErrors = (line: PrescriptionLine): string[] => {
  const result = PrescriptionLineSchema.safeParse(line);
  return result.success ? [] : [...new Set(result.error.issues.map((issue) => issue.message))];
};

interface OrderContext {
  patientId: string;
  practitionerId: string;
  encounterId: string;
  pharmacy: PharmacySearchResult;
  writtenDate: string;
}

/** The order input for a line that passed `prescriptionLineErrors`. */
export const prescriptionLineToOrder = (line: PrescriptionLine, context: OrderContext): OrderPrescriptionInput => {
  if (!line.medication || !line.diagnosis || !line.quantityUnit) {
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
    patientInstructions: line.patientInstructions.trim(),
    pharmacyId: context.pharmacy.ncpdpId,
    pharmacyNpi: context.pharmacy.npi,
    pharmacyName: context.pharmacy.name.trim(),
    pharmacyPhone: context.pharmacy.phone,
    diagnosisCode: line.diagnosis.code.trim(),
    diagnosisDescription: line.diagnosis.display.trim(),
  };
};

/** A quick pick sets the whole prescription except the diagnosis, which belongs to the visit. */
export const applyPrescriptionQuickPick = (
  line: PrescriptionLine,
  quickPick: PrescriptionQuickPickData
): PrescriptionLine => ({
  ...line,
  medication:
    quickPick.ndc && quickPick.medicationDescription
      ? { ndc: quickPick.ndc, description: quickPick.medicationDescription }
      : line.medication,
  quantityValue: quickPick.quantityValue === undefined ? '' : String(quickPick.quantityValue),
  quantityUnit: quickPick.quantityUnit ?? '',
  daysSupply: quickPick.daysSupply === undefined ? '' : String(quickPick.daysSupply),
  numberOfRefills: String(quickPick.numberOfRefills ?? 0),
  substitutionAllowed: quickPick.substitutionAllowed ?? true,
  patientInstructions: quickPick.patientInstructions ?? '',
});

const numberOrUndefined = (value: string): number | undefined =>
  value.trim() === '' || !Number.isFinite(Number(value)) ? undefined : Number(value);

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
  // diagnosis excluded — encounter-specific
});

/** "Amoxicillin 500 MG Oral Capsule, 20 Capsule": the quick pick's name with what it dispenses, as the list reads. */
export const prescriptionQuickPickLabel = (quickPick: PrescriptionQuickPickData): string =>
  quickPick.quantityValue !== undefined && quickPick.quantityUnit
    ? `${quickPick.name}, ${quickPick.quantityValue} ${quickPick.quantityUnit.toLowerCase()}`
    : quickPick.name;

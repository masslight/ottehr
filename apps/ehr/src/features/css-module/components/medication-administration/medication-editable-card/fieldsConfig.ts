export type MedicationOrderType = 'order-new' | 'order-edit' | 'dispense' | 'dispense-not-administered';

export type MedicationFieldType =
  | 'medicationId'
  | 'associatedDx'
  | 'dose'
  | 'units'
  | 'manufacturer'
  | 'route'
  | 'effectiveDateTime'
  | 'instructions'
  | 'lotNumber'
  | 'expDate';

export type MedicationFormType = 'order-new' | 'order-edit' | 'dispense' | 'dispense-not-administered';

type XsVariants = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const fieldsConfigForOrder: Record<
  Exclude<MedicationFieldType, 'effectiveDateTime' | 'lotNumber' | 'expDate'>,
  { xs: XsVariants; isRequired: boolean }
> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForDispense: Record<MedicationFieldType, { xs: XsVariants; isRequired: boolean }> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: true },
  expDate: { xs: 3, isRequired: true },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  effectiveDateTime: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForNotAdministered: Record<MedicationFieldType, { xs: XsVariants; isRequired: boolean }> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: false }, // Not required for partial administration
  expDate: { xs: 3, isRequired: false }, // Not required for partial administration
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },

  // TODO: uncomment when the "anatomical locations" feature is completed
  // location: { xs: 6, isRequired: false },
  effectiveDateTime: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfig: Record<
  MedicationFormType,
  typeof fieldsConfigForOrder | typeof fieldsConfigForDispense | typeof fieldsConfigForNotAdministered
> = {
  'order-new': fieldsConfigForOrder,
  'order-edit': fieldsConfigForOrder,
  dispense: fieldsConfigForDispense,
  'dispense-not-administered': fieldsConfigForNotAdministered,
} as const;

export const getFieldLabel = (
  field: MedicationFieldType,
  form: MedicationFormType | 'form-independent' = 'form-independent'
): string => {
  const labelMap: Record<MedicationFieldType, Partial<Record<MedicationFormType | 'form-independent', string>>> = {
    medicationId: { 'form-independent': 'Medication' },
    associatedDx: { 'form-independent': 'Associated Dx' },
    dose: { 'form-independent': 'Dose' },
    units: { 'form-independent': 'Units' },
    manufacturer: { 'form-independent': 'Manufacturer' },
    route: { 'form-independent': 'Route' },
    effectiveDateTime: { 'form-independent': 'Date/Time Given' },
    instructions: { 'form-independent': 'Instructions', dispense: 'Comments', 'dispense-not-administered': 'Comments' },
    lotNumber: { 'form-independent': 'Lot Number' },
    expDate: { 'form-independent': 'Expiration Date' },
  };
  return labelMap[field][form] || labelMap[field]['form-independent'] || field;
};

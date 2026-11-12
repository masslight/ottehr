import { isRouteRequiringAdministrationLocation } from 'utils/lib/types/api/medication-administration.types';

export type MedicationOrderType =
  | 'order-new'
  | 'order-edit'
  | 'dispense'
  | 'dispense-not-administered'
  | 'completed-edit';

export type MedicationFieldType =
  | 'medicationId'
  | 'associatedDx'
  | 'dose'
  | 'units'
  | 'manufacturer'
  | 'route'
  | 'providerId'
  | 'location'
  | 'effectiveDateTime'
  | 'instructions'
  | 'lotNumber'
  | 'ndc'
  | 'expDate';

export type MedicationFormType =
  | 'order-new'
  | 'order-edit'
  | 'dispense'
  | 'dispense-not-administered'
  | 'completed-edit';

export type XsVariants = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export const fieldsConfigForOrder: Record<
  Exclude<MedicationFieldType, 'effectiveDateTime' | 'lotNumber' | 'expDate' | 'location'>,
  { xs: XsVariants; isRequired: boolean }
> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  ndc: { xs: 3, isRequired: false },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },
  providerId: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForDispense: Record<MedicationFieldType, { xs: XsVariants; isRequired: boolean }> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: true },
  ndc: { xs: 3, isRequired: false },
  expDate: { xs: 3, isRequired: true },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },
  providerId: { xs: 6, isRequired: true },
  location: { xs: 6, isRequired: false },
  effectiveDateTime: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForNotAdministered: Record<MedicationFieldType, { xs: XsVariants; isRequired: boolean }> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: false }, // Not required for partial administration
  ndc: { xs: 3, isRequired: false },
  expDate: { xs: 3, isRequired: false }, // Not required for partial administration
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },
  providerId: { xs: 6, isRequired: true },
  location: { xs: 6, isRequired: false },
  effectiveDateTime: { xs: 6, isRequired: true },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfigForCompletedEdit: Record<MedicationFieldType, { xs: XsVariants; isRequired: boolean }> = {
  medicationId: { xs: 6, isRequired: true },
  associatedDx: { xs: 6, isRequired: false },
  dose: { xs: 6, isRequired: true },
  units: { xs: 6, isRequired: true },
  lotNumber: { xs: 3, isRequired: false },
  ndc: { xs: 3, isRequired: false },
  expDate: { xs: 3, isRequired: false },
  manufacturer: { xs: 6, isRequired: false },
  route: { xs: 6, isRequired: true },
  providerId: { xs: 6, isRequired: true },
  location: { xs: 6, isRequired: false },
  effectiveDateTime: { xs: 6, isRequired: false },
  instructions: { xs: 12, isRequired: false },
} as const;

export const fieldsConfig: Record<
  MedicationFormType,
  | typeof fieldsConfigForOrder
  | typeof fieldsConfigForDispense
  | typeof fieldsConfigForNotAdministered
  | typeof fieldsConfigForCompletedEdit
> = {
  'order-new': fieldsConfigForOrder,
  'order-edit': fieldsConfigForOrder,
  dispense: fieldsConfigForDispense,
  'dispense-not-administered': fieldsConfigForNotAdministered,
  'completed-edit': fieldsConfigForCompletedEdit,
} as const;

// Forms that save an order as administered (or partly administered). 'completed-edit' is switched to 'dispense'
// once one of those buttons is clicked, but it is listed so the Location field is marked required up front.
const ADMINISTERING_FORM_TYPES: readonly MedicationOrderType[] = ['dispense', 'completed-edit'];

/**
 * The form config for the given route: an injectable route makes Location required on the forms that
 * administer the order, since where the medication went in has to be recorded.
 */
export const getFieldsConfig = (
  type: MedicationOrderType,
  route: string | undefined
): (typeof fieldsConfig)[MedicationOrderType] => {
  const config = fieldsConfig[type];
  if (
    'location' in config &&
    ADMINISTERING_FORM_TYPES.includes(type) &&
    isRouteRequiringAdministrationLocation(route)
  ) {
    return { ...config, location: { ...config.location, isRequired: true } };
  }
  return config;
};

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
    providerId: { 'form-independent': 'Ordered by' },
    location: { 'form-independent': 'Location' },
    effectiveDateTime: { 'form-independent': 'Date/Time Given' },
    instructions: { 'form-independent': 'Instructions', dispense: 'Comments', 'dispense-not-administered': 'Comments' },
    lotNumber: { 'form-independent': 'Lot Number' },
    ndc: { 'form-independent': 'NDC' },
    expDate: { 'form-independent': 'Expiration Date' },
  };
  return labelMap[field][form] || labelMap[field]['form-independent'] || field;
};

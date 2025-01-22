export const WEIGHT_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/weight';
export const WEIGHT_LAST_UPDATED_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/weight-last-updated';
export const DATE_FORMAT = 'yyyy-MM-dd';
export const DISPLAY_DATE_FORMAT = 'MM/dd/yyyy';
export const LBS_TO_KG_FACTOR = 0.45359237;
export const WEIGHT_ROUNDING_PRECISION = 100;

export enum Gender {
  male = 'Male',
  female = 'Female',
  other = 'Other',
  unknown = 'Unknown',
}

export enum FillingOutAs {
  SELF = 'Self',
  PARENT_GUARDIAN = 'Parent/Guardian',
}

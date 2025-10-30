const OTTEHR_FHIR_URL = 'https://fhir.ottehr.com';

export const ottehrCodeSystemUrl = (name: string): string => {
  return OTTEHR_FHIR_URL + '/CodeSystem/' + name;
};

export const ottehrValueSetUrl = (name: string): string => {
  return OTTEHR_FHIR_URL + '/ValueSet/' + name;
};

export const ottehrExtensionUrl = (name: string): string => {
  return OTTEHR_FHIR_URL + '/Extension/' + name;
};

export const ottehrIdentifierSystem = (name: string): string => {
  return OTTEHR_FHIR_URL + '/Identifier/' + name;
};

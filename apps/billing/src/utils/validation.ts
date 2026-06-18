import { isCLIAValid, isNPIValidWithChecksum, isPostalCodeValid, taxIdRegex } from 'utils';

export function validateProviderFields(fields: {
  npi: string;
  taxId: string;
  taxonomyCode: string;
  zip: string;
}): string | null {
  const npi = fields.npi.trim();
  if (npi && !isNPIValidWithChecksum(npi)) return 'NPI must be a valid 10-digit number with a correct check digit';
  const taxId = fields.taxId.trim();
  if (taxId && !taxIdRegex.test(taxId)) return 'Tax ID / EIN must be exactly 9 digits';
  const taxonomyCode = fields.taxonomyCode.trim();
  if (taxonomyCode && taxonomyCode.length !== 10) return 'Taxonomy code must be exactly 10 characters';
  const zip = fields.zip.trim();
  if (zip && !isPostalCodeValid(zip)) return 'ZIP code must be 5 digits, optionally with a 4-digit extension';
  return null;
}

export function validateServiceFacilityFields(fields: {
  npi: string;
  clia: string;
  zip: string;
  zipPlus4: string;
}): string | null {
  const npi = fields.npi.trim();
  if (npi && !isNPIValidWithChecksum(npi)) return 'NPI must be a valid 10-digit number with a correct check digit';
  const clia = fields.clia.trim();
  if (clia && !isCLIAValid(clia)) return 'CLIA number must be 2 digits, a "D", then 7 digits (e.g. 05D1234567)';
  const zip = fields.zip.trim();
  if (zip && !/^\d{5}$/.test(zip)) return 'ZIP must be exactly 5 digits';
  const zipPlus4 = fields.zipPlus4.trim();
  if (zipPlus4 && !/^\d{4}$/.test(zipPlus4)) return 'ZIP+4 must be exactly 4 digits';
  return null;
}

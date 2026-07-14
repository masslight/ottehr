import { isCLIAValid, isNPIValidWithChecksum, isPostalCodeValid, taxIdRegex } from 'utils';

export function validateProviderFields(fields: {
  npi: string | null;
  taxId: string | null;
  taxonomyCode: string | null;
  zip: string | null;
}): string | null {
  const npi = fields.npi?.trim();
  if (npi && !isNPIValidWithChecksum(npi)) return 'NPI must be a valid 10-digit number with a correct check digit';
  const taxId = fields.taxId?.trim();
  if (taxId && !taxIdRegex.test(taxId)) return 'Tax ID / EIN must be exactly 9 digits';
  const taxonomyCode = fields.taxonomyCode?.trim();
  if (taxonomyCode && taxonomyCode.length !== 10) return 'Taxonomy code must be exactly 10 characters';
  const zip = fields.zip?.trim();
  if (zip && !isPostalCodeValid(zip)) return 'ZIP code must be 5 digits, optionally with a 4-digit extension';
  return null;
}

export function validateServiceFacilityFields(fields: {
  npi: string | null;
  clia?: string | null;
  zip: string | null;
}): string | null {
  const npi = fields.npi?.trim();
  if (npi && !isNPIValidWithChecksum(npi)) return 'NPI must be a valid 10-digit number with a correct check digit';
  const clia = fields.clia?.trim();
  if (clia && !isCLIAValid(clia)) return 'CLIA number must be 2 digits, a "D", then 7 digits (e.g. 05D1234567)';
  const zip = fields.zip?.trim();
  if (zip && !/^\d{9}$/.test(zip)) return 'ZIP must be 9 digits (5-digit ZIP plus 4-digit extension)';
  return null;
}

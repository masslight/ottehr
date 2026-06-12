import { isNPIValid, isPostalCodeValid, taxIdRegex } from 'utils';

export function validateProviderFields(fields: {
  npi: string;
  taxId: string;
  taxonomyCode: string;
  zip: string;
}): string | null {
  const npi = fields.npi.trim();
  if (npi && !isNPIValid(npi)) return 'NPI must be exactly 10 digits';
  const taxId = fields.taxId.trim();
  if (taxId && !taxIdRegex.test(taxId)) return 'Tax ID / EIN must be exactly 9 digits';
  const taxonomyCode = fields.taxonomyCode.trim();
  if (taxonomyCode && taxonomyCode.length !== 10) return 'Taxonomy code must be exactly 10 characters';
  const zip = fields.zip.trim();
  if (zip && !isPostalCodeValid(zip)) return 'ZIP code must be 5 digits, optionally with a 4-digit extension';
  return null;
}

export interface MedicationSearchResult {
  ndc: string;
  description: string;
}

export interface PharmacySearchResult {
  ncpdpId: string;
  npi: string;
  name: string;
  phone: string;
  address: string;
}

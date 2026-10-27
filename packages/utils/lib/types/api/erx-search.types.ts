/** One strength of a drug in the terminology search; a strength is ordered by its first NDC. */
export interface MedicationStrength {
  strength: string;
  /** Its RxNorm RxCUI (generic or brand), for looking the product up in dosing or suggestion data. */
  rxcui?: string;
  ndcs: string[];
}

/** One drug in the terminology search, with every strength it comes in. */
export interface MedicationSearchDrug {
  name: string;
  strengths: MedicationStrength[];
}

export interface MedicationSearchResponse {
  medications: MedicationSearchDrug[];
}

/** The product a prescription orders: one strength of a drug, named as the pharmacy reads it. */
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

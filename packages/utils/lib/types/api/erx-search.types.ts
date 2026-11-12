/** One active ingredient of a strength, in RxNorm's units: amoxicillin 80 MG per 1 ML, ondansetron 4 MG per 1 EACH. */
export interface MedicationIngredient {
  name: string;
  amount: number;
  /** "MG", "MCG", "GM", ... */
  unit: string;
  per: number;
  /** "ML", "EACH", "ACTUAT", "MG", ... */
  perUnit: string;
}

/** What the order form knows of a product beyond its name: its RxNorm dose form ("Oral Suspension") and
 * ingredients. Missing on a product picked before the search returned them. */
export interface MedicationProductDetails {
  /** Its RxNorm RxCUI (generic or brand), for looking the product up in dosing or suggestion data. */
  rxcui?: string;
  /** The RxNorm dose form name, exactly as RxNorm spells it. */
  doseForm?: string;
  ingredients?: MedicationIngredient[];
}

/** One strength of a drug in the terminology search; a strength is ordered by its first NDC. */
export interface MedicationStrength extends MedicationProductDetails {
  strength: string;
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
export interface MedicationSearchResult extends MedicationProductDetails {
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

/** One pharmacy in the Surescripts directory, as the eRx service's pharmacy search returns it: only pharmacies
 * that take new prescriptions. */
export interface ErxDirectoryPharmacy {
  ncpdpId: string;
  npi?: string;
  name: string;
  storeNumber?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zipCode: string;
  phone?: string;
  fax?: string;
  specialties: string[];
}

/** The directory search's filters: name, address (line 1) and city match as "contains", ignoring case; the rest exactly. */
export interface ErxDirectoryQuery {
  name?: string;
  address?: string;
  city?: string;
  /** Two letters */
  state?: string;
  /** Five digits */
  zipCode?: string;
  /** Ten digits */
  phone?: string;
  ncpdpId?: string;
  npi?: string;
}

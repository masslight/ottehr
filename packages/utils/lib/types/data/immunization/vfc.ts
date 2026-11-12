import { z } from 'zod';

// Vaccines for Children (VFC): the eligibility a practice records at each immunization visit, the funding
// source of each vaccine lot, and the rules that tie the two together (CDC VFC Operations Guide, modules 1
// and 3). Codes are the HL7 v2 table 0064 values registries take; V06 and V07 were retired in 2016.

export const VFC_ELIGIBILITY_CODES = ['V01', 'V02', 'V03', 'V04', 'V05'] as const;
export type VfcEligibilityCode = (typeof VFC_ELIGIBILITY_CODES)[number];

export const VFC_ELIGIBILITY_LABELS: Record<VfcEligibilityCode, { short: string; long: string; vfc: boolean }> = {
  V01: { short: 'Not eligible', long: 'Not VFC eligible (private insurance or separate CHIP)', vfc: false },
  V02: { short: 'Medicaid', long: 'VFC eligible: Medicaid', vfc: true },
  V03: { short: 'Uninsured', long: 'VFC eligible: Uninsured', vfc: true },
  V04: {
    short: 'American Indian / Alaska Native',
    long: 'VFC eligible: American Indian or Alaska Native',
    vfc: true,
  },
  V05: {
    short: 'Underinsured',
    long: 'VFC eligible: Underinsured (FQHC, RHC or deputized location only)',
    vfc: true,
  },
};

export const isVfcEligible = (code: VfcEligibilityCode | undefined): boolean =>
  code !== undefined && VFC_ELIGIBILITY_LABELS[code].vfc;

/** VFC covers children through age 18. */
export const VFC_MAX_AGE_YEARS = 18;

/** What a vaccine lot was paid with: VFC, private purchase, or another public (state) program. */
export const VACCINE_FUNDING_SOURCES = ['vfc', 'private', 'state'] as const;
export type VaccineFundingSource = (typeof VACCINE_FUNDING_SOURCES)[number];
export const VACCINE_FUNDING_SOURCE_LABELS: Record<VaccineFundingSource, string> = {
  vfc: 'VFC',
  private: 'Privately Insured',
  state: 'State program',
};
export const VaccineFundingSourceSchema = z.enum(VACCINE_FUNDING_SOURCES);

/** Public stock is VFC or a state program; the vaccine itself is never charged for. */
export const isPublicFunding = (fundingSource: VaccineFundingSource | undefined): boolean =>
  fundingSource === 'vfc' || fundingSource === 'state';

/** The stock a patient should be given from: VFC for an eligible child, private otherwise. */
export const wantedFundingSource = (code: VfcEligibilityCode | undefined): VaccineFundingSource =>
  isVfcEligible(code) ? 'vfc' : 'private';

/**
 * Giving a dose from the "other" stock is borrowing, which the practice must log and pay back: public stock to
 * a child who isn't eligible, or private stock to one who is. Nothing is borrowing until eligibility is known.
 */
export const isVfcBorrowing = (
  fundingSource: VaccineFundingSource | undefined,
  code: VfcEligibilityCode | undefined
): boolean => {
  if (!fundingSource || !code) return false;
  return isPublicFunding(fundingSource) !== isVfcEligible(code);
};

/** The reasons VFC programs accept for borrowing between stocks (the Vaccine Borrowing Report asks for one). */
export const VFC_BORROWING_REASONS = [
  'VFC or private shipment delayed or spoiled',
  'Short-dated vaccine would expire unused',
  'Ordering error left this stock short',
  'VFC flu vaccine not yet available (flu only)',
  'Other (describe in note)',
] as const;

// ─── Eligibility worked out from paperwork ────────────────────────────────────

export interface VfcEligibilityFacts {
  /** The paperwork's "I have Medicaid insurance coverage" checkbox (or the patient's Medicaid flag). */
  hasMedicaid: boolean;
  /** The paperwork's payment choice was self-pay. */
  selfPay: boolean;
  /** The patient has insurance on file. */
  hasCoverage: boolean;
}

export interface DerivedVfcEligibility {
  code: VfcEligibilityCode;
  /** Plain words for staff: what in the paperwork led to the code. */
  why: string;
}

/**
 * Eligibility from what Ottehr already collects; no VFC question is asked of the family. American Indian /
 * Alaska Native (V04) and Underinsured (V05) are staff picks. Undefined when the paperwork says nothing yet.
 */
export const deriveVfcEligibility = (facts: VfcEligibilityFacts): DerivedVfcEligibility | undefined => {
  if (facts.hasMedicaid)
    return { code: 'V02', why: '"I have Medicaid insurance coverage" is checked in the paperwork.' };
  if (facts.selfPay && !facts.hasCoverage) {
    return { code: 'V03', why: 'Paperwork says "I will pay without insurance" and no insurance is on file.' };
  }
  if (facts.hasCoverage) return { code: 'V01', why: 'Insurance is on file and the Medicaid checkbox is not checked.' };
  return undefined;
};

// ─── Lot ordering on the order screen ─────────────────────────────────────────

/** What the ordering needs from a lot (an InventoryLot has these). */
export interface VaccineLotLike {
  expirationDate: string;
  lotNumber: string;
  fundingSource?: VaccineFundingSource;
}

export interface VaccineLotOption<T extends VaccineLotLike> {
  lot: T;
  expired: boolean;
  /** True when the lot's stock matches the patient's eligibility; undefined while eligibility is unknown. */
  matches?: boolean;
}

/**
 * Lots of one vaccine for a patient: the stock that matches the patient's eligibility first (VFC lots for an
 * eligible child, private lots otherwise), then soonest expiration; expired lots last. Lots with no funding
 * source recorded count as private.
 */
export const sortVaccineLotsForPatient = <T extends VaccineLotLike>(
  lots: T[],
  code: VfcEligibilityCode | undefined,
  today: string
): VaccineLotOption<T>[] => {
  const wanted = code ? wantedFundingSource(code) : undefined;
  const matches = (lot: T): boolean | undefined =>
    wanted === undefined ? undefined : isPublicFunding(lot.fundingSource ?? 'private') === (wanted === 'vfc');
  const rank = (option: VaccineLotOption<T>): number => (option.expired ? 2 : 0) + (option.matches === false ? 1 : 0);
  return (
    lots
      // Expiration dates are calendar dates, so they compare as strings (as isExpirationDatePast does).
      .map((lot) => ({ lot, expired: lot.expirationDate.slice(0, 10) < today, matches: matches(lot) }))
      .map((option) => (option.matches === undefined ? { lot: option.lot, expired: option.expired } : option))
      .sort(
        (a, b) =>
          rank(a) - rank(b) ||
          a.lot.expirationDate.localeCompare(b.lot.expirationDate) ||
          a.lot.lotNumber.localeCompare(b.lot.lotNumber)
      )
  );
};

// ─── Billing ──────────────────────────────────────────────────────────────────

/** Immunization administration CPT/HCPCS codes: billed whatever stock the vaccine came from. */
export const VACCINE_ADMINISTRATION_CPT_CODES = new Set([
  '90460',
  '90461',
  '90471',
  '90472',
  '90473',
  '90474',
  'G0008',
  'G0009',
  'G0010',
]);

export const isVaccineAdministrationCpt = (code: string): boolean => VACCINE_ADMINISTRATION_CPT_CODES.has(code.trim());

/**
 * The CPT codes to put on the claim for a dose: all of them for private stock; for VFC or state stock only the
 * administration codes, since the vaccine itself was supplied free and must not be charged.
 */
export const cptCodesToBillForDose = <T extends { code: string }>(
  cptCodes: T[],
  fundingSource: VaccineFundingSource | undefined
): T[] => (isPublicFunding(fundingSource) ? cptCodes.filter((cpt) => isVaccineAdministrationCpt(cpt.code)) : cptCodes);

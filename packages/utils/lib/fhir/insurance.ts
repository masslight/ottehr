import { VALUE_SETS } from '../ottehr-config/value-sets';
import { CoverageSlotChanges, OrderedCoverages } from '../types/data/account';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

export const INSURANCE_CANDID_PLAN_TYPE_CODES = VALUE_SETS.insuranceTypeOptions.map(
  (planType) => planType.candidCode
) as string[];

// A slot changed when it now holds a different coverage: moved in from the other slot, newly added, or a replacement
// Coverage (e.g. with a corrected member ID).
export const getCoverageSlotChanges = (before: OrderedCoverages, after: OrderedCoverages): CoverageSlotChanges => ({
  primaryCoverageChanged: !!after.primary?.id && after.primary.id !== before.primary?.id,
  secondaryCoverageChanged: !!after.secondary?.id && after.secondary.id !== before.secondary?.id,
});

import { Account } from 'fhir/r4b';
import { VALUE_SETS } from '../ottehr-config/value-sets';
import { CoverageSlotChanges } from '../types/data/account';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

export const INSURANCE_CANDID_PLAN_TYPE_CODES = VALUE_SETS.insuranceTypeOptions.map(
  (planType) => planType.candidCode
) as string[];

const getCoverageIdForPriority = (account: Account, priority: number): string | undefined =>
  account.coverage?.find((coverage) => coverage.priority === priority)?.coverage?.reference?.split('/')[1];

// A slot changed when it now holds a different coverage: moved in from the other slot, newly added, or a replacement
// Coverage (e.g. with a corrected member ID).
export const getCoverageSlotChanges = (accountBefore: Account, accountAfter: Account): CoverageSlotChanges => {
  const primaryAfter = getCoverageIdForPriority(accountAfter, 1);
  const secondaryAfter = getCoverageIdForPriority(accountAfter, 2);

  return {
    primaryCoverageChanged: !!primaryAfter && primaryAfter !== getCoverageIdForPriority(accountBefore, 1),
    secondaryCoverageChanged: !!secondaryAfter && secondaryAfter !== getCoverageIdForPriority(accountBefore, 2),
  };
};

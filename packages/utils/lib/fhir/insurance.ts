import { Account } from 'fhir/r4b';
import { VALUE_SETS } from '../ottehr-config/value-sets';
import { CoverageSlotChanges } from '../types/data/account';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

export const INSURANCE_CANDID_PLAN_TYPE_CODES = VALUE_SETS.insuranceTypeOptions.map(
  (planType) => planType.candidCode
) as string[];

const getCoverageIdForPriority = (account: Account, priority: number): string | undefined =>
  account.coverage?.find((coverage) => coverage.priority === priority)?.coverage?.reference?.split('/')[1];

export const getCoverageSlotChanges = (accountBefore: Account, accountAfter: Account): CoverageSlotChanges => {
  const primaryBefore = getCoverageIdForPriority(accountBefore, 1);
  const secondaryBefore = getCoverageIdForPriority(accountBefore, 2);

  return {
    primaryCoverageChanged: !!primaryBefore && primaryBefore !== getCoverageIdForPriority(accountAfter, 1),
    secondaryCoverageChanged: !!secondaryBefore && secondaryBefore !== getCoverageIdForPriority(accountAfter, 2),
  };
};

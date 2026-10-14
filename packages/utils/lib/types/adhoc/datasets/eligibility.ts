import { InsuranceEligibilityCheckStatus } from '../../data/paperwork/paperwork.types';

export const ELIGIBILITY_STATUS_VALUES = Object.values(InsuranceEligibilityCheckStatus) as [
  InsuranceEligibilityCheckStatus,
  ...InsuranceEligibilityCheckStatus[],
];

export const ELIGIBILITY_STATUS_DESCRIPTION =
  'eligibility-confirmed = the payer confirmed active coverage (shown as ELIGIBLE); eligibility-not-confirmed = not ' +
  'eligible, or the payer answered with an error (NOT ELIGIBLE); eligibility-check-not-supported = the payer does not ' +
  "support real-time checks (UNKNOWN); eligibility-not-checked = the payer's reply could not be read (UNKNOWN).";

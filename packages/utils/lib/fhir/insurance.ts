import { VALUE_SETS } from '../ottehr-config/value-sets';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

export const INSURANCE_CANDID_PLAN_TYPE_CODES = VALUE_SETS.insuranceTypeOptions.map(
  (planType) => planType.candidCode
) as string[];

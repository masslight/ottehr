import { VALUE_SETS } from '../ottehr-config/value-sets';
import { OrderedCoverages } from '../types/data/account';
import { InsurancePriorityChanges } from '../types/data/paperwork/paperwork.types';

export const CANDID_PLAN_TYPE_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/candid-plan-type';

export const INSURANCE_CANDID_PLAN_TYPE_CODES = VALUE_SETS.insuranceTypeOptions.map(
  (planType) => planType.candidCode
) as string[];

export const getInsurancePriorityChanges = (
  before: OrderedCoverages,
  after: OrderedCoverages
): InsurancePriorityChanges => ({
  primaryBecameSecondary: !!before.primary?.id && before.primary.id === after.secondary?.id,
  secondaryBecamePrimary: !!before.secondary?.id && before.secondary.id === after.primary?.id,
});

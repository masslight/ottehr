import { Organization } from 'fhir/r4b';
import { eligibilityRequirementKeys, getPayerId, InsurancePlanDTO, InsurancePlanRequirementKeyBooleans } from 'utils';

export const createInsurancePlanDto = (insuranceOrg: Organization): InsurancePlanDTO => {
  const { id, name } = insuranceOrg;

  const payerId = getPayerId(insuranceOrg);

  if (!id || !name) {
    throw new Error('Insurance missing id or name.');
  }

  if (!payerId) {
    throw new Error('Insurance is missing payerId.');
  }

  const insurancePlanDto: InsurancePlanDTO = {
    id,
    name,
    payerId,
    ...(Object.fromEntries(
      eligibilityRequirementKeys.map((key) => [key, false])
    ) as InsurancePlanRequirementKeyBooleans),
  };

  return insurancePlanDto;
};

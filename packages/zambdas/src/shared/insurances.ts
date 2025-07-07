import { Organization } from 'fhir/r4b';
import {
  eligibilityRequirementKeys,
  getPayerId,
  INSURANCE_REQ_EXTENSION_URL,
  InsurancePlanDTO,
  InsurancePlanRequirementKeyBooleans,
  InsurancePlanRequirementKeys,
} from 'utils';

export const createInsurancePlanDto = (insuranceOrg: Organization): InsurancePlanDTO => {
  const { id, name, extension } = insuranceOrg;

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

  extension
    ?.find((extension) => extension.url === INSURANCE_REQ_EXTENSION_URL)
    ?.extension?.forEach((requirement) => {
      insurancePlanDto[requirement.url as InsurancePlanRequirementKeys] = requirement.valueBoolean || false;
    });

  return insurancePlanDto;
};

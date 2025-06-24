import { InsurancePlan } from 'fhir/r4b';
import {
  eligibilityRequirementKeys,
  InsurancePlanDTO,
  InsurancePlanRequirementKeyBooleans,
  InsurancePlanRequirementKeys,
} from 'utils';

export const createInsurancePlanDto = (insurancePlan: InsurancePlan): InsurancePlanDTO => {
  const { id, name, extension } = insurancePlan;

  if (!id || !name) {
    throw new Error('Insurance missing id or name.');
  }

  const insurancePlanDto: InsurancePlanDTO = {
    id,
    name,
    ...(Object.fromEntries(
      eligibilityRequirementKeys.map((key) => [key, false])
    ) as InsurancePlanRequirementKeyBooleans),
  };

  extension
    ?.find((extension) => extension.url === 'https://extensions.fhir.zapehr.com/insurance-requirements')
    ?.extension?.forEach((requirement) => {
      insurancePlanDto[requirement.url as InsurancePlanRequirementKeys] = requirement.valueBoolean || false;
    });

  return insurancePlanDto;
};

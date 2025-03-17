import Oystehr from '@oystehr/sdk';
import { InsurancePlan } from 'fhir/r4b';

export const getInsurancePlan = async (
  oystehr: Oystehr,
  insuranceCompanyID?: string
): Promise<InsurancePlan | undefined> => {
  if (oystehr && insuranceCompanyID) {
    return await oystehr.fhir.get<InsurancePlan>({
      resourceType: 'InsurancePlan',
      id: insuranceCompanyID,
    });
  }

  throw new Error('fhir client not defined or Insurance Plan ID not provided');
};

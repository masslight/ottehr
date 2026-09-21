import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { ListCustomInsuranceOrganizationsInput } from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import {
  ClinicalCustomInsuranceOrgOption,
  ListCustomInsuranceOrganizationsResponse,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';

// Clinical code's one door to billing-owned custom insurance organization data: the billing zambda
// interface, invoked over the wire. Clinical code never imports billing modules directly, the same
// way nio-directory.ts fronts non-insurance organizations.
export async function listCustomInsuranceOrganizations(
  oystehr: Oystehr,
  input: ListCustomInsuranceOrganizationsInput
): Promise<ClinicalCustomInsuranceOrgOption[]> {
  const response = await oystehr.zambda.execute({ id: 'list-custom-insurance-organizations', ...input });
  return chooseJson<ListCustomInsuranceOrganizationsResponse | undefined>(response)?.organizations ?? [];
}

// Resolves a deleted org too (active: false), so a stored reference token stays displayable and
// callers can distinguish "retired" from "never existed".
export async function getCustomInsuranceOrganizationById(
  oystehr: Oystehr,
  insuranceOrgId: string
): Promise<ClinicalCustomInsuranceOrgOption | undefined> {
  return (await listCustomInsuranceOrganizations(oystehr, { insuranceOrgId }))[0];
}

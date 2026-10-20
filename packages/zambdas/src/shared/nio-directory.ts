import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { ListNonInsuranceOrganizationsInput } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import {
  ClinicalNioOption,
  ListNonInsuranceOrganizationsResponse,
} from 'utils/lib/types/data/billing/non-insurance-org.types';

// Clinical code's one door to billing-owned non-insurance organization data: the billing zambda
// interface, invoked over the wire. Clinical code never imports billing modules and never reads
// billing FHIR resources directly.
export async function listNonInsuranceOrganizations(
  oystehr: Oystehr,
  input: ListNonInsuranceOrganizationsInput
): Promise<ClinicalNioOption[]> {
  const response = await oystehr.zambda.execute({ id: 'list-non-insurance-organizations', ...input });
  return chooseJson<ListNonInsuranceOrganizationsResponse | undefined>(response)?.organizations ?? [];
}

// Resolves deleted NIOs too (active: false), so stored references stay displayable and callers can
// distinguish "retired" from "never existed".
export async function getNonInsuranceOrganizationById(
  oystehr: Oystehr,
  nioId: string
): Promise<ClinicalNioOption | undefined> {
  return (await listNonInsuranceOrganizations(oystehr, { nioId }))[0];
}

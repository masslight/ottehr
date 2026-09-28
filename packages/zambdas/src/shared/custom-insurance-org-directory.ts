import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { codeableConcept } from 'utils/lib/fhir/helpers';
import { extractCustomInsuranceOrgIdFromReferenceUrl } from 'utils/lib/helpers/helpers';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { ORG_TYPE_PAYER_CODE } from 'utils/lib/types/constants';
import { ListCustomInsuranceOrganizationsInput } from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import {
  ClinicalCustomInsuranceOrgOption,
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
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

// Resolves a custom insurance org reference token into a stand-in payer Organization for clinical
// consumers (harvest, labs) that expect one per Coverage.payor. It is built from the
// clinical-facing DTO, never a direct FHIR read, and carries just enough (name + business id) for
// Coverage building and display.
export async function resolveCustomInsuranceOrgReference(oystehr: Oystehr, ref: string): Promise<Organization> {
  const insuranceOrgId = extractCustomInsuranceOrgIdFromReferenceUrl(ref);
  const option = insuranceOrgId ? await getCustomInsuranceOrganizationById(oystehr, insuranceOrgId) : undefined;
  if (!option) {
    throw new Error(`No custom insurance organization matches reference "${ref}"`);
  }
  return {
    resourceType: 'Organization',
    id: option.id,
    name: option.name,
    active: option.active,
    identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: option.orgId }],
    // The "pay" organization-type coding is how every payer org is recognized downstream (RCM
    // payers carry it too — see the dummy "00000/Other" org in harvest); without it, a custom org
    // would be filtered out of the resolved insuranceOrgs list wherever callers select payer-type
    // Organizations from a broader resource set (e.g. getCoverageUpdateResourcesFromUnbundled).
    type: [codeableConcept(ORG_TYPE_PAYER_CODE, FHIR_EXTENSION.Organization.organizationType.url)],
  };
}

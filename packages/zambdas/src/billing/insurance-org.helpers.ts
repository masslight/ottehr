import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import {
  CreateInsuranceOrgInput,
  INSURANCE_ORG_TYPES,
  InsuranceOrgClaimForm,
  InsuranceOrgSubmissionMechanism,
  InsuranceOrgType,
} from 'utils/lib/types/data/billing/insurance-org.schemas';
import {
  INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL,
  INSURANCE_ORG_ID_SYSTEM,
  INSURANCE_ORG_KIND_CODE,
  INSURANCE_ORG_NOTE_EXTENSION_URL,
  INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL,
  INSURANCE_ORG_TYPE_SYSTEM,
  InsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';

// --- Type guard ---

export function isInsuranceOrganization(org: Organization): boolean {
  return !!org.type?.some(
    (concept) =>
      concept.coding?.some(
        (coding) => coding.system === NIO_ORGANIZATION_KIND_SYSTEM && coding.code === INSURANCE_ORG_KIND_CODE
      )
  );
}

export function getInsuranceOrgBusinessId(org: Organization): string {
  return org.identifier?.find((id) => id.system === INSURANCE_ORG_ID_SYSTEM)?.value ?? '';
}

// --- Resource builder (full replace: owns every field it writes) ---

export function buildInsuranceOrganization(input: CreateInsuranceOrgInput, existing?: Organization): Organization {
  return {
    resourceType: 'Organization',
    ...(existing?.id ? { id: existing.id } : {}),
    active: true,
    name: input.name,
    identifier: [{ system: INSURANCE_ORG_ID_SYSTEM, value: input.orgId }],
    type: [
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: INSURANCE_ORG_KIND_CODE }] },
      ...input.insuranceTypes.map((type) => ({ coding: [{ system: INSURANCE_ORG_TYPE_SYSTEM, code: type }] })),
    ],
    extension: [
      { url: INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL, valueCode: input.submissionMechanism },
      { url: INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL, valueCode: input.acceptedClaimForm },
      ...(input.note ? [{ url: INSURANCE_ORG_NOTE_EXTENSION_URL, valueString: input.note }] : []),
    ],
  };
}

// --- FHIR → DTO mapping ---

export function mapInsuranceOrganization(org: Organization): InsuranceOrganizationItem {
  const insuranceTypes = (org.type ?? [])
    .flatMap((concept) => concept.coding ?? [])
    .filter((coding) => coding.system === INSURANCE_ORG_TYPE_SYSTEM)
    .map((coding) => coding.code)
    .filter((code): code is InsuranceOrgType => (INSURANCE_ORG_TYPES as readonly string[]).includes(code ?? ''));

  const submissionMechanism = org.extension?.find((ext) => ext.url === INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL)
    ?.valueCode as InsuranceOrgSubmissionMechanism;
  const acceptedClaimForm = org.extension?.find((ext) => ext.url === INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL)
    ?.valueCode as InsuranceOrgClaimForm;
  const note = org.extension?.find((ext) => ext.url === INSURANCE_ORG_NOTE_EXTENSION_URL)?.valueString;

  return {
    id: org.id ?? '',
    orgId: getInsuranceOrgBusinessId(org),
    name: org.name ?? '',
    active: org.active !== false,
    insuranceTypes,
    submissionMechanism,
    acceptedClaimForm,
    ...(note ? { note } : {}),
  };
}

// --- Business-id uniqueness lookup ---

export async function findInsuranceOrgByBusinessId(
  oystehr: Oystehr,
  orgId: string,
  excludeId?: string
): Promise<Organization | undefined> {
  const bundle = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      { name: 'identifier', value: `${INSURANCE_ORG_ID_SYSTEM}|${orgId}` },
      { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${INSURANCE_ORG_KIND_CODE}` },
    ],
  });
  return bundle.unbundle().find((org) => org.id !== excludeId);
}

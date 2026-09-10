import Oystehr from '@oystehr/sdk';
import { Address, ContactPoint, Extension, Organization } from 'fhir/r4b';
import {
  CreateInsuranceOrgInput,
  INSURANCE_ORG_TYPES,
  InsuranceOrgAddress,
  InsuranceOrgClaimForm,
  InsuranceOrgSubmissionMechanism,
  InsuranceOrgType,
} from 'utils/lib/types/data/billing/insurance-org.schemas';
import {
  INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL,
  INSURANCE_ORG_ID_SYSTEM,
  INSURANCE_ORG_KIND_CODE,
  INSURANCE_ORG_NOTE_EXTENSION_URL,
  INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL,
  INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL,
  INSURANCE_ORG_TYPE_SYSTEM,
  InsuranceOrganizationItem,
  InsuranceOrgSubmissionDetails,
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

// --- Address conversion ---

function toFhirAddress(address: InsuranceOrgAddress | undefined): Address | undefined {
  if (!address) return undefined;
  const line = [address.line1, address.line2].filter((part): part is string => !!part);
  const result: Address = {
    ...(line.length ? { line } : {}),
    ...(address.city ? { city: address.city } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.zip ? { postalCode: address.zip } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

function toInsuranceOrgAddress(address: Address | undefined): InsuranceOrgAddress | undefined {
  if (!address) return undefined;
  const result: InsuranceOrgAddress = {
    ...(address.line?.[0] ? { line1: address.line[0] } : {}),
    ...(address.line?.[1] ? { line2: address.line[1] } : {}),
    ...(address.city ? { city: address.city } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.postalCode ? { zip: address.postalCode } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

// --- Resource builder (full replace: owns every field it writes) ---

export function buildInsuranceOrganization(input: CreateInsuranceOrgInput, existing?: Organization): Organization {
  const details = input.submissionDetails;

  const telecom: ContactPoint[] = [];
  if (details?.email) telecom.push({ system: 'email', value: details.email });
  if (details?.faxNumber) telecom.push({ system: 'fax', value: details.faxNumber });
  if (details?.portalUrl) telecom.push({ system: 'url', value: details.portalUrl });
  const address = toFhirAddress(details?.mailAddress);

  const extension: Extension[] = [
    { url: INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL, valueCode: input.submissionMechanism },
    { url: INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL, valueCode: input.acceptedClaimForm },
    ...(input.note ? [{ url: INSURANCE_ORG_NOTE_EXTENSION_URL, valueString: input.note }] : []),
    ...(details?.portalDetails
      ? [{ url: INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL, valueString: details.portalDetails }]
      : []),
  ];

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
    extension,
    ...(telecom.length ? { telecom } : {}),
    ...(address ? { address: [address] } : {}),
  };
}

// --- FHIR → DTO mapping ---

function mapSubmissionDetails(org: Organization): InsuranceOrgSubmissionDetails | undefined {
  const email = org.telecom?.find((point) => point.system === 'email')?.value;
  const faxNumber = org.telecom?.find((point) => point.system === 'fax')?.value;
  const portalUrl = org.telecom?.find((point) => point.system === 'url')?.value;
  const portalDetails = org.extension?.find((ext) => ext.url === INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL)
    ?.valueString;
  const mailAddress = toInsuranceOrgAddress(org.address?.[0]);

  const details: InsuranceOrgSubmissionDetails = {
    ...(email ? { email } : {}),
    ...(faxNumber ? { faxNumber } : {}),
    ...(portalUrl ? { portalUrl } : {}),
    ...(portalDetails ? { portalDetails } : {}),
    ...(mailAddress ? { mailAddress } : {}),
  };
  return Object.keys(details).length > 0 ? details : undefined;
}

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
  const submissionDetails = mapSubmissionDetails(org);

  return {
    id: org.id ?? '',
    orgId: getInsuranceOrgBusinessId(org),
    name: org.name ?? '',
    active: org.active !== false,
    insuranceTypes,
    submissionMechanism,
    ...(submissionDetails ? { submissionDetails } : {}),
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

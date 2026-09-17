import Oystehr from '@oystehr/sdk';
import { Address, ContactPoint, Extension, Organization } from 'fhir/r4b';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import {
  CreateCustomInsuranceOrgInput,
  CUSTOM_INSURANCE_ORG_TYPES,
  CustomInsuranceOrgAddress,
  CustomInsuranceOrgClaimForm,
  CustomInsuranceOrgSubmissionMechanism,
  CustomInsuranceOrgType,
} from 'utils/lib/types/data/billing/custom-insurance-org.schemas';
import {
  CUSTOM_INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL,
  CUSTOM_INSURANCE_ORG_ID_PREFIX,
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
  CUSTOM_INSURANCE_ORG_NOTE_EXTENSION_URL,
  CUSTOM_INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL,
  CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL,
  CUSTOM_INSURANCE_ORG_TYPE_SYSTEM,
  CustomInsuranceOrgItem,
  CustomInsuranceOrgSubmissionDetails,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NioContact } from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { toFhirContact, toNioContact } from './non-insurance-org.helpers';

// --- Type guard ---

export function isCustomInsuranceOrganization(org: Organization): boolean {
  return !!org.type?.some(
    (concept) =>
      concept.coding?.some(
        (coding) => coding.system === NIO_ORGANIZATION_KIND_SYSTEM && coding.code === CUSTOM_INSURANCE_ORG_KIND_CODE
      )
  );
}

// --- Payer resolution ---

// Resolve a chosen payer id to its Organization, whether it's an RCM payer or a billing-app custom
// insurance organization (a plain FHIR Organization, not in RCM's payer directory). Tries RCM first
// (the common case, and avoids an extra FHIR read for it), then falls back to a direct FHIR read
// guarded by the type check so an arbitrary Organization id can't masquerade as a payer.
export async function resolvePayerOrganization(oystehr: Oystehr, payerId: string): Promise<Organization> {
  if (isCustomInsuranceOrgBusinessId(payerId)) {
    const customOrg = await findCustomInsuranceOrgByBusinessId(oystehr, payerId);
    if (customOrg) {
      return customOrg;
    } else {
      throw INVALID_INPUT_ERROR(`No custom insurance organization matches id "${payerId}"`);
    }
  }
  try {
    return await oystehr.rcm.getPayer({ id: payerId });
  } catch (error) {
    const org = await oystehr.fhir
      .get<Organization>({ resourceType: 'Organization', id: payerId })
      .catch(() => undefined);
    if (org && isCustomInsuranceOrganization(org)) return org;
    throw error;
  }
}

export function getCustomInsuranceOrgBusinessId(org: Organization): string {
  return org.identifier?.find((id) => id.system === CUSTOM_INSURANCE_ORG_ID_SYSTEM)?.value ?? '';
}

// --- Address conversion ---

function toFhirAddress(address: CustomInsuranceOrgAddress | undefined): Address | undefined {
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

function toCustomInsuranceOrgAddress(address: Address | undefined): CustomInsuranceOrgAddress | undefined {
  if (!address) return undefined;
  const result: CustomInsuranceOrgAddress = {
    ...(address.line?.[0] ? { line1: address.line[0] } : {}),
    ...(address.line?.[1] ? { line2: address.line[1] } : {}),
    ...(address.city ? { city: address.city } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.postalCode ? { zip: address.postalCode } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

// --- Resource builder (full replace: owns every field it writes) ---

export function buildCustomInsuranceOrganization(
  input: CreateCustomInsuranceOrgInput,
  existing?: Organization
): Organization {
  const details = input.submissionDetails;

  const telecom: ContactPoint[] = [];
  if (details?.email) telecom.push({ system: 'email', value: details.email });
  if (details?.faxNumber) telecom.push({ system: 'fax', value: details.faxNumber });
  if (details?.portalUrl) telecom.push({ system: 'url', value: details.portalUrl });
  const address = toFhirAddress(details?.mailAddress);
  const contacts = (input.contacts ?? []).map(toFhirContact);

  const extension: Extension[] = [
    { url: CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL, valueCode: input.submissionMechanism },
    { url: CUSTOM_INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL, valueCode: input.acceptedClaimForm },
    ...(input.note ? [{ url: CUSTOM_INSURANCE_ORG_NOTE_EXTENSION_URL, valueString: input.note }] : []),
    ...(details?.portalDetails
      ? [{ url: CUSTOM_INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL, valueString: details.portalDetails }]
      : []),
  ];

  return {
    resourceType: 'Organization',
    ...(existing?.id ? { id: existing.id } : {}),
    active: true,
    name: input.name,
    identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: input.orgId }],
    type: [
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] },
      ...input.insuranceTypes.map((type) => ({ coding: [{ system: CUSTOM_INSURANCE_ORG_TYPE_SYSTEM, code: type }] })),
    ],
    extension,
    ...(telecom.length ? { telecom } : {}),
    ...(address ? { address: [address] } : {}),
    ...(contacts.length ? { contact: contacts } : {}),
  };
}

// --- FHIR → DTO mapping ---

function mapSubmissionDetails(org: Organization): CustomInsuranceOrgSubmissionDetails | undefined {
  const email = org.telecom?.find((point) => point.system === 'email')?.value;
  const faxNumber = org.telecom?.find((point) => point.system === 'fax')?.value;
  const portalUrl = org.telecom?.find((point) => point.system === 'url')?.value;
  const portalDetails = org.extension?.find((ext) => ext.url === CUSTOM_INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL)
    ?.valueString;
  const mailAddress = toCustomInsuranceOrgAddress(org.address?.[0]);

  const details: CustomInsuranceOrgSubmissionDetails = {
    ...(email ? { email } : {}),
    ...(faxNumber ? { faxNumber } : {}),
    ...(portalUrl ? { portalUrl } : {}),
    ...(portalDetails ? { portalDetails } : {}),
    ...(mailAddress ? { mailAddress } : {}),
  };
  return Object.keys(details).length > 0 ? details : undefined;
}

export function mapCustomInsuranceOrganization(org: Organization): CustomInsuranceOrgItem {
  const insuranceTypes = (org.type ?? [])
    .flatMap((concept) => concept.coding ?? [])
    .filter((coding) => coding.system === CUSTOM_INSURANCE_ORG_TYPE_SYSTEM)
    .map((coding) => coding.code)
    .filter((code): code is CustomInsuranceOrgType =>
      (CUSTOM_INSURANCE_ORG_TYPES as readonly string[]).includes(code ?? '')
    );

  const submissionMechanism = org.extension?.find(
    (ext) => ext.url === CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL
  )?.valueCode as CustomInsuranceOrgSubmissionMechanism;
  const acceptedClaimForm = org.extension?.find(
    (ext) => ext.url === CUSTOM_INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL
  )?.valueCode as CustomInsuranceOrgClaimForm;
  const note = org.extension?.find((ext) => ext.url === CUSTOM_INSURANCE_ORG_NOTE_EXTENSION_URL)?.valueString;
  const submissionDetails = mapSubmissionDetails(org);
  const contacts = (org.contact ?? [])
    .map(toNioContact)
    .filter((contact): contact is NioContact => contact !== undefined);

  return {
    id: org.id ?? '',
    orgId: getCustomInsuranceOrgBusinessId(org),
    name: org.name ?? '',
    active: org.active !== false,
    insuranceTypes,
    submissionMechanism,
    ...(submissionDetails ? { submissionDetails } : {}),
    acceptedClaimForm,
    ...(note ? { note } : {}),
    contacts,
  };
}

// --- Business-id uniqueness lookup ---

export async function findCustomInsuranceOrgByBusinessId(
  oystehr: Oystehr,
  orgId: string,
  excludeId?: string
): Promise<Organization | undefined> {
  const bundle = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      { name: 'identifier', value: `${CUSTOM_INSURANCE_ORG_ID_SYSTEM}|${orgId}` },
      { name: 'type', value: `${NIO_ORGANIZATION_KIND_SYSTEM}|${CUSTOM_INSURANCE_ORG_KIND_CODE}` },
    ],
  });
  return bundle.unbundle().find((org) => org.id !== excludeId);
}

// Every business id starts with this prefix — a "payer id" search/filter value shaped like one names
// a custom insurance organization rather than an RCM payer.
export function isCustomInsuranceOrgBusinessId(value: string): boolean {
  return value.trim().toUpperCase().startsWith(CUSTOM_INSURANCE_ORG_ID_PREFIX);
}

// The Claim.insurer / PaymentReconciliation payment-issuer filter value for a chosen "payer id" —
// claims/ERAs never store a custom insurance organization's business id directly (Claim.insurer
// references it by Organization/{id}, see buildPayorReference), so a business-id-shaped value is
// resolved to that org first. An ordinary RCM payer id needs no lookup: getPayerUrl builds its
// filter value directly from the id.
export async function resolvePayerIssuerFilter(oystehr: Oystehr, payerId: string): Promise<string> {
  if (isCustomInsuranceOrgBusinessId(payerId)) {
    const org = await findCustomInsuranceOrgByBusinessId(oystehr, payerId);
    if (!org?.id) throw INVALID_INPUT_ERROR(`No custom insurance organization matches id "${payerId}"`);
    return `Organization/${org.id}`;
  }
  return getPayerUrl(payerId);
}

import Oystehr from '@oystehr/sdk';
import { Address, ContactPoint, Extension, Organization, OrganizationAffiliation, Reference } from 'fhir/r4b';
import { extractPayerIdFromUrl, getNioReferenceUrl, getPayerId, isPayerUrl } from 'utils/lib/helpers/helpers';
import { BillingPayerOption } from 'utils/lib/types/data/billing/billing.types';
import {
  CreateNonInsuranceOrgInput,
  NIO_COVERAGE_CATEGORIES,
  NIO_SUBMISSION_MECHANISMS,
  NIO_WC_BILLING_MODES,
  NioAddress,
  NioContact,
  NioCoverageCategory,
  NioCoverageInput,
  NioSubmission,
} from 'utils/lib/types/data/billing/non-insurance-org.schemas';
import {
  ClinicalNioOption,
  NIO_COVERAGE_CATEGORY_LABELS,
  NIO_COVERAGE_CATEGORY_SYSTEM,
  NIO_COVERAGE_KIND_CODE,
  NIO_EMPLOYER_KIND_CODE,
  NIO_KIND_CODE,
  NIO_ORGANIZATION_KIND_SYSTEM,
  NIO_PORTAL_NOTES_EXTENSION_URL,
  NIO_PREFERRED_SUBMISSION_EXTENSION_URL,
  NIO_WC_BILLING_MODE_EXTENSION_URL,
  NIO_WC_PAYER_EXTENSION_URL,
  NioCoverageDetail,
  NonInsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { buildPayorReference, payerDisplay } from './shared';

type OrganizationContact = NonNullable<Organization['contact']>[number];

// --- Type guards & readers ---

function hasKindCoding(org: Organization, code: string): boolean {
  return !!org.type?.some(
    (concept) =>
      concept.coding?.some((coding) => coding.system === NIO_ORGANIZATION_KIND_SYSTEM && coding.code === code)
  );
}

export function isNonInsuranceOrganization(org: Organization): boolean {
  return hasKindCoding(org, NIO_KIND_CODE);
}

export function isNioEmployer(org: Organization): boolean {
  return hasKindCoding(org, NIO_EMPLOYER_KIND_CODE);
}

export function getNioCoverageCategory(
  concepts: OrganizationAffiliation['code'] | Organization['type']
): NioCoverageCategory | undefined {
  for (const concept of concepts ?? []) {
    for (const coding of concept.coding ?? []) {
      if (
        coding.system === NIO_COVERAGE_CATEGORY_SYSTEM &&
        (NIO_COVERAGE_CATEGORIES as readonly string[]).includes(coding.code ?? '')
      ) {
        return coding.code as NioCoverageCategory;
      }
    }
  }
  return undefined;
}

function getExtension(org: Organization, url: string): Extension | undefined {
  return org.extension?.find((ext) => ext.url === url);
}

// --- Input ⇄ FHIR field conversions ---

function toFhirAddress(address: NioAddress | undefined): Address | undefined {
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

function toNioAddress(address: Address | undefined): NioAddress | undefined {
  if (!address) return undefined;
  const result: NioAddress = {
    ...(address.line?.[0] ? { line1: address.line[0] } : {}),
    ...(address.line?.[1] ? { line2: address.line[1] } : {}),
    ...(address.city ? { city: address.city } : {}),
    ...(address.state ? { state: address.state } : {}),
    ...(address.postalCode ? { zip: address.postalCode } : {}),
  };
  return Object.keys(result).length > 0 ? result : undefined;
}

// Contact title lives in purpose.text — the same mapping the WC-employer paperwork harvest writes.
function toFhirContact(contact: NioContact): OrganizationContact {
  const telecom: ContactPoint[] = [];
  if (contact.phone) telecom.push({ system: 'phone', value: contact.phone });
  if (contact.email) telecom.push({ system: 'email', value: contact.email });
  return {
    name: { text: contact.name },
    ...(contact.title ? { purpose: { text: contact.title } } : {}),
    ...(telecom.length ? { telecom } : {}),
  };
}

function toNioContact(contact: OrganizationContact): NioContact | undefined {
  const name = contact.name?.text;
  if (!name) return undefined;
  const phone = contact.telecom?.find((point) => point.system === 'phone')?.value;
  const email = contact.telecom?.find((point) => point.system === 'email')?.value;
  return {
    name,
    ...(contact.purpose?.text ? { title: contact.purpose.text } : {}),
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
  };
}

function mapSubmission(org: Organization): NioSubmission | undefined {
  const preferredCode = getExtension(org, NIO_PREFERRED_SUBMISSION_EXTENSION_URL)?.valueCode;
  const preferredMechanism = (NIO_SUBMISSION_MECHANISMS as readonly string[]).includes(preferredCode ?? '')
    ? (preferredCode as NioSubmission['preferredMechanism'])
    : undefined;
  const email = org.telecom?.find((point) => point.system === 'email')?.value;
  const fax = org.telecom?.find((point) => point.system === 'fax')?.value;
  const portalNotes = getExtension(org, NIO_PORTAL_NOTES_EXTENSION_URL)?.valueString;
  const mailAddress = toNioAddress(org.address?.[0]);
  const submission: NioSubmission = {
    ...(preferredMechanism ? { preferredMechanism } : {}),
    ...(email ? { email } : {}),
    ...(fax ? { fax } : {}),
    ...(portalNotes ? { portalNotes } : {}),
    ...(mailAddress ? { mailAddress } : {}),
  };
  return Object.keys(submission).length > 0 ? submission : undefined;
}

// --- Resource builders (full replace: these own every field they write) ---

export function buildNioOrganization(input: CreateNonInsuranceOrgInput, existing?: Organization): Organization {
  const address = toFhirAddress(input.address);
  const contacts = (input.contacts ?? []).map(toFhirContact);
  return {
    resourceType: 'Organization',
    ...(existing?.id ? { id: existing.id } : {}),
    active: true,
    name: input.name,
    type: [
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: NIO_KIND_CODE }] },
      ...(input.employer ? [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: NIO_EMPLOYER_KIND_CODE }] }] : []),
    ],
    ...(address ? { address: [address] } : {}),
    ...(contacts.length ? { contact: contacts } : {}),
  };
}

export interface NioPayerReference {
  reference: string;
  display?: string;
}

export function buildCoverageOrganization(params: {
  nioName: string;
  coverage: NioCoverageInput;
  payerRef?: NioPayerReference;
  existing?: Organization;
}): Organization {
  const { nioName, coverage, payerRef, existing } = params;

  const extension: Extension[] = [];
  if (coverage.category === 'workers-comp') {
    extension.push({ url: NIO_WC_BILLING_MODE_EXTENSION_URL, valueCode: coverage.billingMode });
    if (payerRef) {
      extension.push({
        url: NIO_WC_PAYER_EXTENSION_URL,
        valueReference: { reference: payerRef.reference, ...(payerRef.display ? { display: payerRef.display } : {}) },
      });
    }
  }
  const submission = coverage.submission;
  if (submission?.preferredMechanism) {
    extension.push({ url: NIO_PREFERRED_SUBMISSION_EXTENSION_URL, valueCode: submission.preferredMechanism });
  }
  if (submission?.portalNotes) {
    extension.push({ url: NIO_PORTAL_NOTES_EXTENSION_URL, valueString: submission.portalNotes });
  }

  const telecom: ContactPoint[] = [];
  if (submission?.email) telecom.push({ system: 'email', value: submission.email });
  if (submission?.fax) telecom.push({ system: 'fax', value: submission.fax });
  const mailAddress = toFhirAddress(submission?.mailAddress);

  // 'other' keeps exactly the user-entered name (possibly none) so it round-trips into the edit
  // form; the coded categories get a derived name for admin/debugging legibility.
  const name =
    coverage.category === 'other' ? coverage.name : `${nioName} — ${NIO_COVERAGE_CATEGORY_LABELS[coverage.category]}`;

  return {
    resourceType: 'Organization',
    ...(existing?.id ? { id: existing.id } : {}),
    active: true,
    ...(name ? { name } : {}),
    type: [
      { coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: NIO_COVERAGE_KIND_CODE }] },
      { coding: [{ system: NIO_COVERAGE_CATEGORY_SYSTEM, code: coverage.category }] },
    ],
    ...(extension.length ? { extension } : {}),
    ...(telecom.length ? { telecom } : {}),
    ...(mailAddress ? { address: [mailAddress] } : {}),
  };
}

export function buildNioAffiliation(params: {
  nioReference: string;
  coverageReference: string;
  category: NioCoverageCategory;
  existing?: OrganizationAffiliation;
}): OrganizationAffiliation {
  return {
    resourceType: 'OrganizationAffiliation',
    ...(params.existing?.id ? { id: params.existing.id } : {}),
    active: true,
    organization: { reference: params.nioReference },
    participatingOrganization: { reference: params.coverageReference },
    code: [{ coding: [{ system: NIO_COVERAGE_CATEGORY_SYSTEM, code: params.category }] }],
  };
}

// --- FHIR → DTO mapping ---

function fallbackPayerOption(ref: Reference): BillingPayerOption {
  const reference = ref.reference ?? '';
  return {
    id: reference.startsWith('Organization/') ? reference.slice('Organization/'.length) : '',
    name: ref.display ?? '',
    payerId: extractPayerIdFromUrl(reference) ?? '',
  };
}

function mapCoverageDetail(
  category: NioCoverageCategory,
  coverageOrg: Organization | undefined,
  payerOptionsByRef: Map<string, BillingPayerOption> | undefined
): NioCoverageDetail {
  const submission = coverageOrg ? mapSubmission(coverageOrg) : undefined;
  if (category === 'workers-comp') {
    const modeCode = coverageOrg ? getExtension(coverageOrg, NIO_WC_BILLING_MODE_EXTENSION_URL)?.valueCode : undefined;
    const billingMode = (NIO_WC_BILLING_MODES as readonly string[]).includes(modeCode ?? '')
      ? (modeCode as (typeof NIO_WC_BILLING_MODES)[number])
      : 'direct';
    const payerRef = coverageOrg ? getExtension(coverageOrg, NIO_WC_PAYER_EXTENSION_URL)?.valueReference : undefined;
    const payer = payerRef?.reference
      ? payerOptionsByRef?.get(payerRef.reference) ?? fallbackPayerOption(payerRef)
      : undefined;
    return { category, billingMode, ...(payer ? { payer } : {}), ...(submission ? { submission } : {}) };
  }
  if (category === 'other') {
    return {
      category,
      ...(coverageOrg?.name ? { name: coverageOrg.name } : {}),
      ...(submission ? { submission } : {}),
    };
  }
  return { category, ...(submission ? { submission } : {}) };
}

export function mapNonInsuranceOrganization(params: {
  org: Organization;
  affiliations: OrganizationAffiliation[];
  coverageOrgsById: Map<string, Organization>;
  payerOptionsByRef?: Map<string, BillingPayerOption>;
}): NonInsuranceOrganizationItem {
  const { org, affiliations, coverageOrgsById, payerOptionsByRef } = params;

  const covers: NioCoverageDetail[] = [];
  for (const affiliation of affiliations) {
    if (affiliation.active === false) continue;
    const category = getNioCoverageCategory(affiliation.code);
    if (!category || covers.some((detail) => detail.category === category)) continue;
    const coverageOrgId = referencedId(affiliation.participatingOrganization);
    const coverageOrg = coverageOrgId ? coverageOrgsById.get(coverageOrgId) : undefined;
    covers.push(mapCoverageDetail(category, coverageOrg, payerOptionsByRef));
  }
  covers.sort((a, b) => NIO_COVERAGE_CATEGORIES.indexOf(a.category) - NIO_COVERAGE_CATEGORIES.indexOf(b.category));

  const contacts = (org.contact ?? [])
    .map(toNioContact)
    .filter((contact): contact is NioContact => contact !== undefined);
  const address = toNioAddress(org.address?.[0]);

  return {
    id: org.id ?? '',
    name: org.name ?? '',
    employer: isNioEmployer(org),
    active: org.active !== false,
    ...(address ? { address } : {}),
    contacts,
    covers,
  };
}

export function referencedId(reference: Reference | undefined): string | undefined {
  return reference?.reference?.split('/')[1];
}

// The minimal clinical-facing shape; `reference` is the NIO token clinical code stores verbatim.
export function mapClinicalNioOption(org: Organization, coversCategories: NioCoverageCategory[]): ClinicalNioOption {
  const address = toNioAddress(org.address?.[0]);
  return {
    id: org.id ?? '',
    reference: getNioReferenceUrl(org.id ?? ''),
    name: org.name ?? '',
    employer: isNioEmployer(org),
    active: org.active !== false,
    ...(address ? { address } : {}),
    coversCategories,
  };
}

// --- Coverage pair fetching & reconciliation ---

export interface NioCoveragePair {
  affiliation: OrganizationAffiliation;
  coverageOrg?: Organization;
}

// All affiliation/coverage-org pairs for one NIO, inactive included (an unchecked category's pair
// is kept around inactive so re-checking it later reactivates instead of duplicating).
export async function fetchNioCoveragePairs(oystehr: Oystehr, nioId: string): Promise<NioCoveragePair[]> {
  const bundle = await oystehr.fhir.search<Organization | OrganizationAffiliation>({
    resourceType: 'OrganizationAffiliation',
    params: [
      { name: 'organization', value: `Organization/${nioId}` },
      { name: '_include', value: 'OrganizationAffiliation:participating-organization' },
      { name: '_count', value: '1000' },
    ],
  });
  const resources = bundle.unbundle();
  const orgsById = new Map<string, Organization>();
  resources.forEach((resource) => {
    if (resource.resourceType === 'Organization' && resource.id) orgsById.set(resource.id, resource);
  });
  return resources
    .filter((resource): resource is OrganizationAffiliation => resource.resourceType === 'OrganizationAffiliation')
    .map((affiliation) => {
      const coverageOrgId = referencedId(affiliation.participatingOrganization);
      return { affiliation, coverageOrg: coverageOrgId ? orgsById.get(coverageOrgId) : undefined };
    });
}

export interface CoverageChanges {
  creates: NioCoverageInput[];
  // Category present in the input and already paired: rebuild the coverage org; reactivate the
  // affiliation when it was inactive.
  updates: { coverage: NioCoverageInput; pair: NioCoveragePair }[];
  deactivates: NioCoveragePair[];
}

export function computeCoverageChanges(covers: NioCoverageInput[], pairs: NioCoveragePair[]): CoverageChanges {
  const chosen = new Set<NioCoveragePair>();
  const creates: NioCoverageInput[] = [];
  const updates: CoverageChanges['updates'] = [];

  for (const coverage of covers) {
    // A pair whose coverage org went missing (data drift) is not reusable — it gets deactivated
    // below and the category recreated fresh.
    const candidates = pairs.filter(
      (pair) => pair.coverageOrg && getNioCoverageCategory(pair.affiliation.code) === coverage.category
    );
    const pair = candidates.find((candidate) => candidate.affiliation.active !== false) ?? candidates[0];
    if (pair) {
      chosen.add(pair);
      updates.push({ coverage, pair });
    } else {
      creates.push(coverage);
    }
  }

  const deactivates = pairs.filter((pair) => !chosen.has(pair) && pair.affiliation.active !== false);
  return { creates, updates, deactivates };
}

// --- Payer resolution (Oystehr RCM) ---

// The workers-comp payer selection arrives as the RCM payer Organization id (what PayerSelect
// stores); persist it in the same canonical reference form Coverage.payor uses.
export async function resolveWcPayerReference(
  oystehr: Oystehr,
  covers: NioCoverageInput[] | undefined
): Promise<NioPayerReference | undefined> {
  const workersComp = covers?.find((coverage) => coverage.category === 'workers-comp');
  if (!workersComp || workersComp.category !== 'workers-comp' || !workersComp.payerId) return undefined;
  let payerOrg: Organization | undefined;
  try {
    payerOrg = await oystehr.rcm.getPayer({ id: workersComp.payerId });
  } catch (error) {
    console.error(`Failed to look up payer ${workersComp.payerId}:`, error);
  }
  if (!payerOrg) throw INVALID_INPUT_ERROR(`Unknown payer id ${workersComp.payerId}`);
  return { reference: buildPayorReference(payerOrg), display: payerDisplay(payerOrg) };
}

// Resolve stored WC payer references back to live BillingPayerOptions so the edit form's
// PayerSelect round-trips; mapCoverageDetail falls back to the stored reference + display for
// anything that fails to resolve.
export async function resolvePayerOptionsByRef(
  oystehr: Oystehr,
  coverageOrgs: Organization[]
): Promise<Map<string, BillingPayerOption>> {
  const refs = new Set<string>();
  coverageOrgs.forEach((org) => {
    const reference = getExtension(org, NIO_WC_PAYER_EXTENSION_URL)?.valueReference?.reference;
    if (reference) refs.add(reference);
  });
  const byRef = new Map<string, BillingPayerOption>();
  await Promise.all(
    [...refs].map(async (ref) => {
      try {
        let payerOrg: Organization | undefined;
        if (isPayerUrl(ref)) {
          payerOrg = await oystehr.rcm.getPayerByUrl({ url: ref });
        } else if (ref.startsWith('Organization/')) {
          payerOrg = await oystehr.rcm.getPayer({ id: ref.slice('Organization/'.length) });
        }
        if (payerOrg) {
          byRef.set(ref, { id: payerOrg.id ?? '', name: payerOrg.name ?? '', payerId: getPayerId(payerOrg) ?? '' });
        }
      } catch (error) {
        console.error(`Failed to resolve NIO payer ${ref}:`, error);
      }
    })
  );
  return byRef;
}

import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coverage, Device, Extension, Location, Organization, Practitioner, Provenance } from 'fhir/r4b';
import {
  CLAIM_HISTORY_RESOURCE_LABELS,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  ClaimHistoryEntry,
  ClaimHistoryLink,
  ClaimProvenanceDiff,
  GetClaimHistoryResponse,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fetchById, fhirName, resolvePayersByRef, SOURCE_IDENTIFIER_SYSTEM } from '../shared';
import { GetClaimHistoryParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-history';

// Reference-typed Claim fields that link to a billing-app screen, and which screen.
const PROVIDER_FACILITY_FIELD_SCREEN: Record<string, ClaimHistoryLink['screen']> = {
  billingProvider: 'billing-providers',
  renderingProvider: 'rendering-providers',
  facility: 'service-facilities',
};
// All reference-typed fields whose stored values are resource references / payer URLs, not plain text.
const REFERENCE_FIELDS = new Set([...Object.keys(PROVIDER_FACILITY_FIELD_SCREEN), 'coverage', 'payer']);

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(oystehr: Oystehr, params: GetClaimHistoryParams): Promise<GetClaimHistoryResponse> {
  const { claimId } = params;

  // Build the set of resources that make up this claim. Every Provenance targets the single resource
  // it changed, and working copies are per-claim, so querying for Provenances targeting any resource in
  // this graph reconstructs the claim's full history.
  const claim = await fetchById<Claim>(oystehr, 'Claim', claimId);
  const targets = new Set<string>([`Claim/${claimId}`]);
  const addRef = (ref?: string): void => {
    if (ref && !ref.startsWith('urn:') && ref.includes('/')) targets.add(ref);
  };
  addRef(claim.patient?.reference);
  addRef(claim.provider?.reference);
  addRef(claim.facility?.reference);
  (claim.careTeam ?? []).forEach((member) => addRef(member.provider?.reference));

  const coverageIds = (claim.insurance ?? [])
    .map((entry) => entry.coverage?.reference)
    .filter((ref): ref is string => !!ref && ref.startsWith('Coverage/'))
    .map((ref) => ref.replace('Coverage/', ''));
  coverageIds.forEach((id) => targets.add(`Coverage/${id}`));

  // Coverages carry the subscriber (policy holder) RelatedPerson, which is also editable on the claim.
  if (coverageIds.length > 0) {
    const coverages = (
      await oystehr.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [
          { name: '_id', value: coverageIds.join(',') },
          { name: '_include', value: 'Coverage:subscriber' },
        ],
      })
    ).unbundle();
    coverages.forEach((c) => addRef(c.subscriber?.reference));
  }

  const searchResults = (
    await oystehr.fhir.search<Provenance | Practitioner | Device>({
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: [...targets].join(',') },
        { name: '_include', value: 'Provenance:agent' },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();

  const provenances = searchResults.filter((r): r is Provenance => r.resourceType === 'Provenance');
  const agentsByRef = new Map<string, Practitioner | Device>();
  searchResults.forEach((r) => {
    if (r.resourceType === 'Practitioner' || r.resourceType === 'Device')
      agentsByRef.set(`${r.resourceType}/${r.id}`, r);
  });

  const entries: ClaimHistoryEntry[] = provenances
    .map((provenance) => toHistoryEntry(provenance, agentsByRef))
    // Newest first. Sort here rather than relying on a server-side _sort on `recorded`.
    .sort((a, b) => (a.recorded < b.recorded ? 1 : a.recorded > b.recorded ? -1 : 0));

  // Reference values are stored as raw FHIR references; resolve them to friendly names + screen links
  // for the non-technical audience of the history view.
  await enrichReferences(oystehr, entries);

  return { entries };
}

function toHistoryEntry(provenance: Provenance, agentsByRef: Map<string, Practitioner | Device>): ClaimHistoryEntry {
  const diffString = provenance.extension?.find((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString;
  const diff: ClaimProvenanceDiff = diffString
    ? (JSON.parse(diffString) as ClaimProvenanceDiff)
    : { resourceType: '', changes: [] };

  const activityCode = provenance.activity?.coding?.[0]?.code ?? '';
  const targetRef = provenance.target?.[0]?.reference ?? '';
  const resourceType = diff.resourceType || targetRef.split('/')[0] || '';
  const resourceId = targetRef.split('/')[1] ?? '';

  const agentRef = provenance.agent?.[0]?.who?.reference ?? '';
  const agentTypeCode = provenance.agent?.[0]?.type?.coding?.[0]?.code;

  return {
    id: provenance.id ?? '',
    recorded: provenance.recorded ?? '',
    activity: activityDisplay(activityCode, resourceType),
    activityCode,
    resourceType,
    resourceId,
    actor: {
      reference: agentRef,
      display: actorDisplay(agentsByRef.get(agentRef), agentRef),
      type: agentTypeCode === 'system' ? 'system' : 'user',
    },
    changes: diff.changes ?? [],
  };
}

// Resolve every reference-typed value across all entries to a friendly name, and attach a screen link
// for provider / facility references (pointing at the master resource behind the working copy).
async function enrichReferences(oystehr: Oystehr, entries: ClaimHistoryEntry[]): Promise<void> {
  const idsByType: Record<string, Set<string>> = {
    Practitioner: new Set(),
    Organization: new Set(),
    Location: new Set(),
    Coverage: new Set(),
  };
  const payerUrls = new Set<string>();

  const collect = (field: string, value: string | null): void => {
    if (!value) return;
    // Coverage values may be a comma-joined list; provider/facility/payer are single.
    for (const ref of field === 'coverage' ? value.split(', ') : [value]) {
      if (field === 'payer' && !ref.includes('/')) {
        payerUrls.add(ref); // an Oystehr RCM payer URL
        continue;
      }
      const [type, id] = ref.split('/');
      if (id && idsByType[type]) idsByType[type].add(id);
    }
  };

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (!REFERENCE_FIELDS.has(change.field)) continue;
      collect(change.field, change.previousValue);
      collect(change.field, change.newValue);
    }
  }

  const resourcesByRef = new Map<string, Practitioner | Organization | Location | Coverage>();
  await Promise.all(
    Object.keys(idsByType).map(async (type) => {
      const ids = [...idsByType[type]];
      if (ids.length === 0) return;
      const found = (
        await oystehr.fhir.search<Practitioner | Organization | Location | Coverage>({
          resourceType: type as 'Practitioner' | 'Organization' | 'Location' | 'Coverage',
          params: [{ name: '_id', value: ids.join(',') }],
        })
      ).unbundle();
      found.forEach((r) => {
        if (r.id) resourcesByRef.set(`${r.resourceType}/${r.id}`, r);
      });
    })
  );

  // Coverages contribute their payer URL for name resolution.
  resourcesByRef.forEach((r) => {
    if (r.resourceType === 'Coverage' && r.payor?.[0]?.reference) payerUrls.add(r.payor[0].reference);
  });
  const payersByRef = await resolvePayersByRef(oystehr, [...payerUrls]);

  const resolve = (field: string, value: string): { display: string; link: ClaimHistoryLink | null } => {
    if (field === 'payer') {
      const resource = resourcesByRef.get(value) as Organization | undefined;
      return { display: payersByRef.get(value)?.name ?? resource?.name ?? value, link: null };
    }
    if (field === 'coverage') {
      const display = value
        .split(', ')
        .map((ref) => {
          const coverage = resourcesByRef.get(ref) as Coverage | undefined;
          const payerName = coverage?.payor?.[0]?.reference
            ? payersByRef.get(coverage.payor[0].reference)?.name
            : undefined;
          return payerName ?? coverage?.subscriberId ?? ref;
        })
        .join(', ');
      return { display, link: null };
    }
    // provider / facility reference
    const resource = resourcesByRef.get(value);
    if (!resource) return { display: value, link: null };
    const name =
      resource.resourceType === 'Practitioner' ? fhirName(resource) : (resource as Organization | Location).name ?? '';
    const linkId = sourceId(resource) ?? resource.id;
    return {
      display: name || value,
      link: linkId ? { screen: PROVIDER_FACILITY_FIELD_SCREEN[field], id: linkId } : null,
    };
  };

  for (const entry of entries) {
    for (const change of entry.changes) {
      if (!REFERENCE_FIELDS.has(change.field)) continue;
      if (change.previousValue) {
        const { display, link } = resolve(change.field, change.previousValue);
        change.previousValue = display;
        change.previousLink = link;
      }
      if (change.newValue) {
        const { display, link } = resolve(change.field, change.newValue);
        change.newValue = display;
        change.newLink = link;
      }
    }
  }
}

// The master resource id behind a working copy (from its source-identifier extension), so links open
// the canonical record the provider / facility screens manage rather than the per-claim copy.
function sourceId(resource: { extension?: Extension[] }): string | undefined {
  const ref = resource.extension?.find((e) => e.url === SOURCE_IDENTIFIER_SYSTEM)?.valueReference?.reference;
  if (!ref) return undefined;
  return ref.includes('/') ? ref.split('/')[1] : ref;
}

function activityDisplay(code: string, resourceType: string): string {
  const label = CLAIM_HISTORY_RESOURCE_LABELS[resourceType] ?? resourceType ?? 'Resource';
  switch (code) {
    case CLAIM_PROVENANCE_ACTIVITY_CODES.create:
      return `Create ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.update:
      return `Update ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.delete:
      return `Delete ${label}`;
    case CLAIM_PROVENANCE_ACTIVITY_CODES.statusChange:
      return 'Status change';
    case CLAIM_PROVENANCE_ACTIVITY_CODES.tagChange:
      return 'Tag change';
    default:
      return label;
  }
}

function actorDisplay(actor: Practitioner | Device | undefined, ref: string): string {
  if (!actor) return ref.startsWith('Device/') ? CLAIM_RULES_ENGINE_DEVICE_NAME : ref || 'Unknown';
  if (actor.resourceType === 'Practitioner') return fhirName(actor) || ref;
  return actor.deviceName?.[0]?.name ?? CLAIM_RULES_ENGINE_DEVICE_NAME;
}

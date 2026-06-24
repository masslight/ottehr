import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Coverage, Device, Practitioner, Provenance } from 'fhir/r4b';
import {
  CLAIM_HISTORY_RESOURCE_LABELS,
  CLAIM_PROVENANCE_ACTIVITY_CODES,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_RULES_ENGINE_DEVICE_NAME,
  ClaimHistoryEntry,
  ClaimProvenanceDiff,
  GetClaimHistoryResponse,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createBillingClient, fetchById, fhirName } from '../shared';
import { GetClaimHistoryParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-claim-history';

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

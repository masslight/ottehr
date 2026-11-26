import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Claim,
  ClaimItem,
  DomainResource,
  FhirResource,
  Organization,
  Practitioner,
  ProvenanceAgent,
  Resource,
} from 'fhir/r4b';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { InternalError } from 'utils/lib/helpers/oystehrApi';
import { SplitBillingClaimInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import {
  CLAIM_STATUS_DATE_EXTENSION_URLS,
  CLAIM_STATUS_FIELDS_BY_KEY,
  CLAIM_STATUS_TAG_SYSTEMS,
  claimStatusValuesToTags,
  getClaimStatusFieldValue,
  withArStageInitialization,
} from 'utils/lib/types/data/billing/claim-status';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { fetchClaimResponsesByClaimIds } from '../claim-amounts';
import { claimProvenanceRequest, claimResourceChangeRequests, recordedNow, resolveClaimActor } from '../provenance';
import {
  BILLING_WORKING_COPY_TAG,
  CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM,
  copySourceId,
  createBillingClient,
  CURRENT_STATUS_TAG_SYSTEM,
  fetchClaimGraph,
  linkPatientCopyViaPerson,
  pruneUnreferencedOrderingProviders,
} from '../shared';

type SplitClaimParams = ValidatedZambdaInput<typeof SplitBillingClaimInputSchema>;

let m2mToken: string;
const ZAMBDA_NAME = 'split-billing-claim';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(SplitBillingClaimInputSchema, input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const agent = await resolveClaimActor('caller', oystehr, input.headers?.Authorization, params.secrets);

  const response = await performEffect(oystehr, params, agent);
  return { statusCode: 200, body: JSON.stringify(response) };
});

/**
 * Moves the selected service lines off a claim onto a new claim that carries everything else the
 * original has — its own copies of the patient, coverages, providers and facility, diagnoses, care
 * team, tags and claim-level extensions — and removes those lines from the original. Both writes and
 * their history entries are committed in one transaction.
 */
export async function performEffect(
  oystehr: Oystehr,
  params: SplitClaimParams,
  agent: ProvenanceAgent
): Promise<{ claimId: string }> {
  const graph = await fetchClaimGraph(oystehr, params.claimId);
  const { claim } = graph;
  const { moved, kept } = partitionItems(claim.item ?? [], params.itemSequences);

  // Remits match their lines by Claim.item.sequence, which splitting renumbers.
  const remits = (await fetchClaimResponsesByClaimIds(oystehr, [params.claimId])).get(params.claimId) ?? [];
  if (remits.length) throw INVALID_INPUT_ERROR('A claim with remits cannot be split');

  // Every working copy the claim points at gets its own copy for the new claim, so editing one
  // claim's patient, coverage, provider or facility never changes the other claim.
  const careTeamProviders = await fetchCareTeamProviders(oystehr, claim, graph.renderingProvider);
  const workingCopies = new Map<string, DomainResource>();
  for (const resource of [
    graph.patient,
    graph.billingProvider,
    graph.serviceFacility,
    ...careTeamProviders,
    ...graph.coverages,
    ...graph.subscribers,
  ]) {
    if (resource?.id && isWorkingCopy(resource)) workingCopies.set(`${resource.resourceType}/${resource.id}`, resource);
  }
  const urnByReference = new Map([...workingCopies.keys()].map((ref) => [ref, `urn:uuid:${randomUUID()}`]));
  const copyRequests: BatchInputRequest<FhirResource>[] = [...workingCopies.entries()].map(([ref, resource]) => ({
    method: 'POST',
    url: `/${resource.resourceType}`,
    resource: rewriteReferences(cloneResource(resource), urnByReference) as FhirResource,
    fullUrl: urnByReference.get(ref),
  }));

  const newClaim = rewriteReferences(buildSplitClaim(claim, moved), urnByReference);
  const newClaimUrn = `urn:uuid:${randomUUID()}`;
  const newClaimProvenance = claimProvenanceRequest({
    targetReference: newClaimUrn,
    claimReference: newClaimUrn,
    after: newClaim,
    agent,
    activity: 'create',
    recorded: recordedNow(),
    sourceReference: `Claim/${claim.id}`,
    extraChanges: [
      {
        field: 'splitFrom',
        label: 'Split from claim',
        previousValue: null,
        newValue: `Claim ${claim.id}`,
        newRef: `Claim/${claim.id}`,
      },
    ],
  });

  const before = structuredClone(claim);
  removeSplitLines(claim, kept);
  const splitChange: ClaimFieldChange = {
    field: 'splitInto',
    label: 'Split off into new claim',
    previousValue: null,
    newValue: moved.map(lineLabel).join('; '),
    newRef: newClaimUrn,
  };

  const requests: BatchInputRequest<FhirResource>[] = [
    ...copyRequests,
    { method: 'POST', url: '/Claim', resource: newClaim, fullUrl: newClaimUrn },
    ...(newClaimProvenance ? [newClaimProvenance as BatchInputRequest<FhirResource>] : []),
    ...claimResourceChangeRequests({
      resource: claim,
      before,
      agent,
      claimReference: `Claim/${claim.id}`,
      extraChanges: [splitChange],
      // A concurrent edit of the original fails the split rather than being overwritten.
      ifMatch: makeOptimisticLockIfMatchHeader(before),
    }),
  ];
  const tx = await oystehr.fhir.transaction<FhirResource>({ requests });
  const created = (tx.entry ?? [])
    .map((entry) => entry.resource)
    .find((r): r is Claim => r?.resourceType === 'Claim' && r.id !== claim.id);
  if (!created?.id) throw InternalError;

  const patientCopyId = created.patient?.reference?.replace('Patient/', '');
  if (graph.patient?.id && patientCopyId && patientCopyId !== graph.patient.id) {
    await linkPatientCopyViaPerson(oystehr, copySourceId(graph.patient) ?? graph.patient.id, patientCopyId);
  }

  return { claimId: created.id };
}

export function partitionItems(items: ClaimItem[], sequences: number[]): { moved: ClaimItem[]; kept: ClaimItem[] } {
  const selected = new Set(sequences);
  const unknown = [...selected].filter((sequence) => !items.some((item) => item.sequence === sequence));
  if (unknown.length) throw INVALID_INPUT_ERROR(`The claim has no service line ${unknown.join(', ')}`);
  const moved = items.filter((item) => selected.has(item.sequence));
  const kept = items.filter((item) => !selected.has(item.sequence));
  if (!kept.length) throw INVALID_INPUT_ERROR('At least one service line must stay on the original claim');
  return { moved, kept };
}

// The new claim: the original with only the moved lines, starting over as a never-submitted claim in
// the original's AR stage. Attachments stay with the original (deleting one deletes its document).
export function buildSplitClaim(original: Claim, moved: ClaimItem[]): Claim {
  const claim = cloneResource(original);
  claim.status = 'draft';
  claim.item = moved.map((item) => structuredClone(item));
  pruneDiagnosesToItems(claim);

  const keptInfo = (claim.supportingInfo ?? []).filter(
    (info) => !info.valueReference?.reference?.startsWith('DocumentReference/')
  );
  claim.supportingInfo = keptInfo.length ? keptInfo : undefined;
  const infoSequences = new Set(keptInfo.map((info) => info.sequence));
  claim.item = claim.item.map((item, i) => {
    const informationSequence = item.informationSequence?.filter((sequence) => infoSequences.has(sequence));
    return {
      ...item,
      sequence: i + 1,
      informationSequence: informationSequence?.length ? informationSequence : undefined,
    };
  });
  finalizeItems(claim);

  // Submission-specific identity (the payer's claim control number) belongs to the original only.
  const identifier = claim.identifier?.filter((id) => id.system !== CLAIM_PAYER_CLAIM_CONTROL_NUMBER_IDENTIFIER_SYSTEM);
  claim.identifier = identifier?.length ? identifier : undefined;
  const statusDateUrls = new Set<string>(Object.values(CLAIM_STATUS_DATE_EXTENSION_URLS));
  const extension = claim.extension?.filter((ext) => !statusDateUrls.has(ext.url));
  claim.extension = extension?.length ? extension : undefined;

  const statusSystems = new Set<string>([...Object.values(CLAIM_STATUS_TAG_SYSTEMS), CURRENT_STATUS_TAG_SYSTEM]);
  const arStage = getClaimStatusFieldValue(original, CLAIM_STATUS_FIELDS_BY_KEY.arStage);
  claim.meta = {
    tag: [
      ...(claim.meta?.tag ?? []).filter((tag) => !tag.system || !statusSystems.has(tag.system)),
      { system: CURRENT_STATUS_TAG_SYSTEM, code: 'open' },
      ...claimStatusValuesToTags(withArStageInitialization({ arStage })),
    ],
  };
  return claim;
}

// The original keeps everything but the moved lines, renumbered from 1.
export function removeSplitLines(claim: Claim, kept: ClaimItem[]): void {
  claim.item = kept.map((item, i) => ({ ...item, sequence: i + 1 }));
  finalizeItems(claim);
}

function finalizeItems(claim: Claim): void {
  pruneUnreferencedOrderingProviders(claim);
  const total = (claim.item ?? []).reduce((sum, item) => sum + (item.net?.value ?? 0), 0);
  claim.total = { value: Math.round(total * 100) / 100, currency: 'USD' };
}

// Keeps only the diagnoses the claim's lines point at, renumbered in their original order. A line
// without pointers relies on the whole list, so then every diagnosis stays.
export function pruneDiagnosesToItems(claim: Claim): void {
  const items = claim.item ?? [];
  if (!claim.diagnosis?.length || items.some((item) => !item.diagnosisSequence?.length)) return;
  const used = new Set(items.flatMap((item) => item.diagnosisSequence ?? []));
  const keptDiagnoses = claim.diagnosis.filter((dx) => used.has(dx.sequence));
  const newSequence = new Map(keptDiagnoses.map((dx, i) => [dx.sequence, i + 1]));
  claim.diagnosis = keptDiagnoses.map((dx, i) => ({ ...dx, sequence: i + 1 }));
  claim.item = items.map((item) => ({
    ...item,
    diagnosisSequence: item.diagnosisSequence
      ?.map((sequence) => newSequence.get(sequence))
      .filter((sequence): sequence is number => sequence !== undefined),
  }));
}

// The rendering provider plus any other care team providers (the claim graph resolves only the first).
async function fetchCareTeamProviders(
  oystehr: Oystehr,
  claim: Claim,
  renderingProvider: DomainResource | undefined
): Promise<DomainResource[]> {
  const known = renderingProvider?.id ? `${renderingProvider.resourceType}/${renderingProvider.id}` : undefined;
  const references = [
    ...new Set(
      (claim.careTeam ?? [])
        .map((member) => member.provider?.reference)
        .filter((ref): ref is string => !!ref && /^(Practitioner|Organization)\//.test(ref) && ref !== known)
    ),
  ];
  const others = await Promise.all(
    references.map((ref) => {
      const [resourceType, id] = ref.split('/') as ['Practitioner' | 'Organization', string];
      return oystehr.fhir.get<Practitioner | Organization>({ resourceType, id }).catch(() => undefined);
    })
  );
  return [renderingProvider, ...others].filter((r): r is DomainResource => !!r);
}

function isWorkingCopy(resource: Resource): boolean {
  return (
    resource.meta?.tag?.some(
      (tag) => tag.system === BILLING_WORKING_COPY_TAG.system && tag.code === BILLING_WORKING_COPY_TAG.code
    ) ?? false
  );
}

// A resource as a new resource: everything but its server-assigned id and version metadata.
function cloneResource<T extends Resource>(resource: T): T {
  const copy = structuredClone(resource);
  delete copy.id;
  copy.meta = resource.meta?.tag?.length ? { tag: structuredClone(resource.meta.tag) } : undefined;
  return copy;
}

// Points every Reference at a resource being copied at its copy instead.
function rewriteReferences<T>(value: T, urnByReference: Map<string, string>): T {
  if (Array.isArray(value)) return value.map((entry) => rewriteReferences(entry, urnByReference)) as T;
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    result[key] =
      key === 'reference' && typeof entry === 'string' && urnByReference.has(entry)
        ? urnByReference.get(entry)
        : rewriteReferences(entry, urnByReference);
  }
  return result as T;
}

function lineLabel(item: ClaimItem): string {
  const code = item.productOrService?.coding?.[0]?.code ?? '?';
  const modifiers = (item.modifier ?? []).map((m) => m.coding?.[0]?.code).filter(Boolean);
  return modifiers.length ? `${code}-${modifiers.join('-')}` : code;
}

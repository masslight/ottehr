import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { createHash } from 'crypto';
import { Claim, ClaimResponse, FhirResource, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BILLING_RESOURCE_TAG, CLAIM_STATUS_RESPONSE_EVENT_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  getCoding,
  isVersionConflictError,
  makeOptimisticLockIfMatchHeader,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { CLAIM_STATUS_PROCESSED_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  ClaimFieldChange,
} from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR, PRECONDITION_FAILED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ClassifiedClaimStatusResponse, classifyClaimStatusResponse } from './claim-status-response';
import { claimMetaTagsWithProvenanceRequests, claimProvenanceRequest, recordedNow } from './provenance';
import { buildUpdatedClaimStatusTags, fetchById, findById, hasTag } from './shared';

export interface ClaimStatusContext {
  claimResponse: ClaimResponse;
  claim: Claim;
  classification: ClassifiedClaimStatusResponse;
  history: Provenance[];
  recordedFields: ReadonlySet<string>;
}

export async function processClaimStatusResponse(
  projectClient: Oystehr,
  billingClient: Oystehr,
  claimResponseId: string,
  agent: ProvenanceAgent,
  allowStatusChange: boolean
): Promise<void> {
  await withVersionConflictRetries(async () => {
    const context = await loadClaimStatusContext(projectClient, claimResponseId);
    if (!context) return;
    const completion = claimStatusCompletionRequest(context.claimResponse);
    if (!completion) return;
    const requests = claimRejectionRequests(context, agent, allowStatusChange);
    const { claim } = context;
    // History-only writes also lock the Claim, preventing duplicate messages across concurrent responses.
    if (requests.length > 0 && !requests.some((request) => request.url === `/Claim/${claim.id}`)) {
      if (!makeOptimisticLockIfMatchHeader(claim)) {
        throw INVALID_INPUT_ERROR(`Claim/${claim.id} needs a version for rejection history processing`);
      }
      requests.unshift(...claimMetaTagsWithProvenanceRequests(claim, claim.meta?.tag ?? [], 'statusChange', agent));
    }
    await billingClient.fhir.transaction({ requests: [...requests, completion] });
  }).catch((cause) => {
    if (isVersionConflictError(cause)) {
      throw {
        ...PRECONDITION_FAILED(
          `ClaimResponse/${claimResponseId} processing conflicted with another update; retry processing`
        ),
        cause,
      };
    }
    throw cause;
  });
}

// Sender and chronology checks decide whether AR can change; rejection history is recorded either way.
export function claimRejectionRequests(
  { claim, claimResponse, classification, history, recordedFields }: ClaimStatusContext,
  agent: ProvenanceAgent,
  allowStatusChange: boolean
): BatchInputRequest<FhirResource>[] {
  if (
    classification.kind !== 'rejection-candidate' ||
    !hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)
  )
    return [];
  if (!claim.id || !claimResponse.id) {
    throw INVALID_INPUT_ERROR('Claim and ClaimResponse IDs are required for rejection processing');
  }
  // ClaimMD reports Mountain time
  const sourceTime = classification.raw.response_time?.trim().toUpperCase() ?? '';
  const format = 'yyyy-MM-dd hh:mm:ssa';
  const eventTime = DateTime.fromFormat(sourceTime, format, { zone: 'America/Denver' });
  const statusActivity = CLAIM_PROVENANCE_ACTIVITY.statusChange;
  const statusChanges = history.filter(
    (entry) => getCoding(entry.activity, statusActivity.system!)?.code === statusActivity.code
  );
  const chronologyAllowsChange =
    eventTime.isValid &&
    eventTime.getPossibleOffsets().length === 1 &&
    eventTime.toFormat(format) === sourceTime &&
    statusChanges.every((entry) => {
      const recorded = DateTime.fromISO(entry.recorded);
      return recorded.isValid && recorded.toMillis() < eventTime.toMillis();
    });
  const status = getClaimStatusValues(claim);
  const canChangeAr =
    allowStatusChange &&
    chronologyAllowsChange &&
    status.arStage === AR_STAGE.insurancePayer &&
    ['submitted', 'adjudicated'].includes(status.insuranceArStatus) &&
    (!status.insurancePaidStatus || status.insurancePaidStatus === 'unpaid') &&
    (!status.adjudicationStatus || status.adjudicationStatus === 'rejected');
  const extraChanges = claimRejectionHistoryChanges(classification, recordedFields);
  if (!canChangeAr) {
    const history = claimProvenanceRequest({
      targetReference: `ClaimResponse/${claimResponse.id}`,
      claimReference: `Claim/${claim.id}`,
      sourceReference: `ClaimResponse/${claimResponse.id}`,
      agent,
      activity: 'update',
      recorded: recordedNow(),
      extraChanges,
    });
    return history ? [history] : [];
  }
  if (!makeOptimisticLockIfMatchHeader(claim)) {
    throw INVALID_INPUT_ERROR('Claim and ClaimResponse IDs and Claim version are required for rejection processing');
  }
  const adjudicated: Claim = {
    ...claim,
    meta: { ...claim.meta, tag: buildUpdatedClaimStatusTags(claim, 'insuranceArStatus', 'adjudicated') },
  };
  const tags = buildUpdatedClaimStatusTags(adjudicated, 'adjudicationStatus', 'rejected');
  return claimMetaTagsWithProvenanceRequests(claim, tags, 'statusChange', agent, {
    sourceReference: `ClaimResponse/${claimResponse.id}`,
    extraChanges,
  });
}

export function claimRejectionHistoryChanges(
  classification: ClassifiedClaimStatusResponse,
  recordedFields: ReadonlySet<string> = new Set()
): ClaimFieldChange[] {
  if (classification.kind !== 'rejection-candidate') return [];
  const { raw, eventIdentifier } = classification;
  const account = eventIdentifier.slice(0, eventIdentifier.indexOf(':'));
  const seen = new Set(recordedFields);
  const fallback = classification.messages.some((message) => message.message?.trim())
    ? 'Claim rejected; no details provided.'
    : classification.details.join('\n');
  const messages: typeof classification.messages = classification.messages.length
    ? classification.messages
    : classification.details.map((message) => ({ message }));
  return messages.flatMap((message) => {
    const text = message.message?.trim() || fallback;
    // Without message IDs, deduplicate within an event; later events can repeat a rejection after resubmission.
    const payload = [
      eventIdentifier,
      raw.senderid,
      raw.sender_name,
      raw.sender_icn,
      message.mesgid,
      message.fields,
      text,
    ];
    const identity = message.responseid
      ? `id:${message.responseid}`
      : `payload:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`;
    const field = `rejection.${account}:${identity}`;
    if (seen.has(field)) return [];
    seen.add(field);
    return [{ field, label: 'Error', previousValue: null, newValue: text }];
  });
}

// Save this request with the AR/history writes in one transaction; the tag means all required writes succeeded.
export function claimStatusCompletionRequest(
  response: ClaimResponse
): BatchInputPatchRequest<FhirResource> | undefined {
  const eventIdentifier = response.identifier?.find((id) => id.system === CLAIM_STATUS_RESPONSE_EVENT_SYSTEM)?.value;
  if (!eventIdentifier?.trim()) {
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} is missing a claim status event ID`);
  }
  const missingTags = [
    BILLING_RESOURCE_TAG,
    { system: CLAIM_STATUS_PROCESSED_TAG_SYSTEM, code: eventIdentifier },
  ].filter((tag) => !hasTag(response, tag.system, tag.code));
  if (missingTags.length === 0) return undefined;
  const ifMatch = makeOptimisticLockIfMatchHeader(response);
  if (!response.id || !ifMatch)
    throw INVALID_INPUT_ERROR('ClaimResponse ID and version are required for billing tagging');

  return getPatchBinary({
    resourceType: 'ClaimResponse',
    resourceId: response.id,
    ifMatch,
    patchOperations: [
      {
        op: 'add',
        path: '/meta/tag',
        value: [...(response.meta?.tag ?? []), ...missingTags],
      },
    ],
  });
}

export async function loadClaimStatusContext(
  projectClient: Oystehr,
  claimResponseId: string
): Promise<ClaimStatusContext | undefined> {
  // Use the project client as Oystehr ClaimResponses do not have the billing workspace tag yet.
  const claimResponse = await fetchById<ClaimResponse>(projectClient, 'ClaimResponse', claimResponseId);
  const classification = classifyClaimStatusResponse(claimResponse);
  if (!classification) return undefined;
  if (
    hasTag(claimResponse, CLAIM_STATUS_PROCESSED_TAG_SYSTEM, classification.eventIdentifier) &&
    hasTag(claimResponse, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)
  )
    return undefined;

  const claim = await resolveClaimForStatusResponse(projectClient, claimResponse);
  if (!claim) return undefined;

  const history =
    classification.kind === 'rejection-candidate'
      ? await loadClaimStatusHistory(projectClient, claim.id!)
      : { history: [], recordedFields: new Set<string>() };
  return { claimResponse, claim, classification, ...history };
}

export async function loadClaimStatusHistory(
  projectClient: Oystehr,
  claimId: string
): Promise<Pick<ClaimStatusContext, 'history' | 'recordedFields'>> {
  const history = await getAllFhirSearchPages<Provenance>(
    {
      resourceType: 'Provenance',
      params: [
        { name: 'target', value: `Claim/${claimId}` },
        { name: '_tag', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      ],
    },
    projectClient
  );
  const recordedFields = new Set<string>();
  for (const provenance of history) {
    // Rejection message keys belong to history linked to a source ClaimResponse.
    if (
      !provenance.entity?.some(
        (entity) => entity.role === 'source' && entity.what.reference?.startsWith('ClaimResponse/')
      )
    )
      continue;
    const extension = provenance.extension?.find((ext) => ext.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL);
    if (!extension) continue;
    try {
      const changes = z.array(z.object({ field: z.string() })).parse(JSON.parse(extension.valueString ?? ''));
      changes.forEach(({ field }) => {
        if (field.startsWith('rejection.')) recordedFields.add(field);
      });
    } catch (cause) {
      if (cause instanceof SyntaxError || cause instanceof z.ZodError) {
        throw { ...INVALID_INPUT_ERROR(`Provenance/${provenance.id} has an invalid claim history change set`), cause };
      }
      throw cause;
    }
  }
  return { history, recordedFields };
}

export async function resolveClaimForStatusResponse(
  oystehr: Oystehr,
  response: Pick<ClaimResponse, 'id' | 'request'>
): Promise<Claim | undefined> {
  const referenceParts = response.request?.reference?.split('/') ?? [];
  const [resourceType, claimId] = referenceParts;
  if (referenceParts.length !== 2 || resourceType !== 'Claim' || !claimId) {
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} must reference a Claim/<id>`);
  }

  const claim = await findById<Claim>(oystehr, 'Claim', claimId);
  if (!claim) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Claim/${claimId} referenced by ClaimResponse/${response.id} was not found`);
  }
  // The project feed can reference clinical claims so validate it.
  return hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code) ? claim : undefined;
}

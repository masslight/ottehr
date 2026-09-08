import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { createHash } from 'crypto';
import { Claim, ClaimResponse, FhirResource, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ClassifiedClaimStatusResponse, classifyClaimStatusResponse } from './claim-status-response';
import { claimMetaTagsWithProvenanceRequests, claimProvenanceRequest, recordedNow } from './provenance';
import { buildUpdatedClaimStatusTags, fetchById, findById, hasTag } from './shared';

interface ClaimStatusContext {
  claimResponse: ClaimResponse;
  claim: Claim;
  classification: ClassifiedClaimStatusResponse;
  recordedFields: ReadonlySet<string>;
}

export function claimRejectionRequests(
  { claim, claimResponse, classification, recordedFields }: ClaimStatusContext,
  agent: ProvenanceAgent
): BatchInputRequest<FhirResource>[] {
  if (!classification.rejection || !hasTag(claim, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code)) return [];
  if (!claim.id || !claimResponse.id) {
    throw INVALID_INPUT_ERROR('Claim and ClaimResponse IDs are required for rejection processing');
  }
  const status = getClaimStatusValues(claim);
  const extraChanges = claimRejectionHistoryChanges(classification, recordedFields);
  if (status.arStage !== AR_STAGE.insurancePayer) {
    const rejectionHistory = claimProvenanceRequest({
      targetReference: `ClaimResponse/${claimResponse.id}`,
      claimReference: `Claim/${claim.id}`,
      sourceReference: `ClaimResponse/${claimResponse.id}`,
      agent,
      activity: 'update',
      recorded: recordedNow(),
      extraChanges,
    });
    return rejectionHistory ? [rejectionHistory] : [];
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
  if (!classification.rejection) return [];
  const { raw, eventIdentifier, rejection } = classification;
  const account = eventIdentifier.slice(0, eventIdentifier.indexOf(':'));
  const seen = new Set(recordedFields);
  return rejection.flatMap((entry) => {
    // Without a message ID, deduplicate within this event so later rejections remain separate.
    const identifyingFields = [
      eventIdentifier,
      raw.senderid,
      raw.sender_name,
      raw.sender_icn,
      entry.mesgid,
      entry.fields,
      entry.text,
    ];
    const identity = entry.responseid
      ? `id:${entry.responseid}`
      : `payload:${createHash('sha256').update(JSON.stringify(identifyingFields)).digest('hex')}`;
    const field = `rejection.${account}:${identity}`;
    if (seen.has(field)) return [];
    seen.add(field);
    return [{ field, label: 'Error', previousValue: null, newValue: entry.text }];
  });
}

// Commit this tag in the same transaction as the status and history.
export function claimStatusCompletionRequest(
  response: ClaimResponse
): BatchInputPatchRequest<FhirResource> | undefined {
  const missingTags = [BILLING_RESOURCE_TAG, CLAIM_STATUS_PROCESSED_TAG].filter(
    (tag) => !hasTag(response, tag.system, tag.code)
  );
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
  // New ClaimResponses do not have the billing tag yet.
  const claimResponse = await fetchById<ClaimResponse>(projectClient, 'ClaimResponse', claimResponseId);
  const classification = classifyClaimStatusResponse(claimResponse);
  if (!classification) return undefined;
  const alreadyProcessed =
    hasTag(claimResponse, CLAIM_STATUS_PROCESSED_TAG.system, CLAIM_STATUS_PROCESSED_TAG.code) &&
    hasTag(claimResponse, BILLING_RESOURCE_TAG.system, BILLING_RESOURCE_TAG.code);
  if (alreadyProcessed) return undefined;

  const claim = await resolveClaimForStatusResponse(projectClient, claimResponse);
  if (!claim) return undefined;

  const recordedFields = classification.rejection
    ? await loadClaimStatusHistory(projectClient, claim.id!)
    : new Set<string>();
  return { claimResponse, claim, classification, recordedFields };
}

const isLinkedToClaimResponse = (provenance: Provenance): boolean =>
  provenance.entity?.some(
    (entity) => entity.role === 'source' && entity.what.reference?.startsWith('ClaimResponse/')
  ) ?? false;

export async function loadClaimStatusHistory(projectClient: Oystehr, claimId: string): Promise<Set<string>> {
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
    if (!isLinkedToClaimResponse(provenance)) continue;
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
  return recordedFields;
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

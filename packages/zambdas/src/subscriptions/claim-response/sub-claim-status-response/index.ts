import Oystehr, { BatchInputPatchRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createHash } from 'crypto';
import { Claim, ClaimResponse, FhirResource, Provenance, ProvenanceAgent } from 'fhir/r4b';
import {
  BILLING_RESOURCE_TAG,
  CLAIM_STATUS_RESPONSE_EVENT_SYSTEM,
  RAW_RESPONSE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import {
  isVersionConflictError,
  makeOptimisticLockIfMatchHeader,
  withVersionConflictRetries,
} from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { CLAIM_STATUS_PROCESSED_TAG } from 'utils/lib/types/data/billing/billing.constants';
import { CLAIM_PROVENANCE_DIFF_EXTENSION_URL, ClaimFieldChange } from 'utils/lib/types/data/billing/claim-history';
import { AR_STAGE, getClaimStatusValues } from 'utils/lib/types/data/billing/claim-status';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  INVALID_INPUT_ERROR,
  isApiError,
  PRECONDITION_FAILED,
} from 'utils/lib/types/errors';
import { z } from 'zod';
import {
  claimMetaTagsWithProvenanceRequests,
  claimProvenanceRequest,
  recordedNow,
  resolveClaimActor,
} from '../../../billing/provenance';
import {
  buildUpdatedClaimStatusTags,
  createBillingClient,
  createEraReadClient,
  fetchById,
  findById,
  hasTag,
} from '../../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { sendErrors } from '../../../shared/errors';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'sub-claim-status-response';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets, ...restOfParams } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success', restOfParams);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const billingClient = createBillingClient(m2mToken, secrets);
  const projectClient = createEraReadClient(m2mToken, secrets);
  try {
    await withVersionConflictRetries(
      async () => {
        console.group('complexValidation');
        const validated = await complexValidation(projectClient, params.claimResponseId);
        console.groupEnd();
        console.debug('complexValidation success', { skipped: validated == null });
        if (!validated) return;

        console.group('performEffect');
        await performEffect(billingClient, validated, secrets);
        console.groupEnd();
        console.debug('performEffect success');
      },
      { onConflict: (attempt) => console.debug('retrying after a version conflict', { attempt }) }
    );
    return { statusCode: 200, body: JSON.stringify({}) };
  } catch (cause) {
    const error = isVersionConflictError(cause)
      ? {
          ...PRECONDITION_FAILED(
            `ClaimResponse/${params.claimResponseId} processing conflicted with another update and was not processed`
          ),
          cause,
        }
      : cause;
    if (isApiError(error)) await sendErrors(error, getSecret(SecretsKeys.ENVIRONMENT, secrets));
    throw error;
  }
});

export interface ComplexValidationOutput {
  claimResponse: ClaimResponse;
  claim: Claim;
  classification: ClassifiedClaimStatusResponse;
  recordedFields: ReadonlySet<string>;
  completion: BatchInputPatchRequest<FhirResource>;
}

export async function complexValidation(
  projectClient: Oystehr,
  claimResponseId: string
): Promise<ComplexValidationOutput | undefined> {
  // New ClaimResponses do not have the billing tag yet.
  const claimResponse = await fetchById<ClaimResponse>(projectClient, 'ClaimResponse', claimResponseId);
  const classification = classifyClaimStatusResponse(claimResponse);
  if (!classification) return undefined;
  const completion = claimStatusCompletionRequest(claimResponse);
  if (!completion) return undefined;

  const claim = await resolveClaimForStatusResponse(projectClient, claimResponse);
  if (!claim) return undefined;

  const recordedFields = classification.rejection
    ? await loadClaimStatusHistory(projectClient, claim.id!)
    : new Set<string>();
  return { claimResponse, claim, classification, recordedFields, completion };
}

export async function performEffect(
  oystehr: Oystehr,
  validated: ComplexValidationOutput,
  secrets: Secrets
): Promise<void> {
  const { claim, completion } = validated;
  const agent = await resolveClaimActor('system', oystehr, undefined, secrets);
  const requests = claimRejectionRequests(validated, agent);
  // Lock the Claim for history-only writes to prevent concurrent duplicate messages.
  if (requests.length > 0 && !requests.some((request) => request.url === `/Claim/${claim.id}`)) {
    if (!makeOptimisticLockIfMatchHeader(claim)) {
      throw INVALID_INPUT_ERROR(`Claim/${claim.id} needs a version for rejection history processing`);
    }
    requests.unshift(...claimMetaTagsWithProvenanceRequests(claim, claim.meta?.tag ?? [], 'statusChange', agent));
  }
  await oystehr.fhir.transaction({ requests: [...requests, completion] });
}

export function claimRejectionRequests(
  {
    claim,
    claimResponse,
    classification,
    recordedFields,
  }: Pick<ComplexValidationOutput, 'claim' | 'claimResponse' | 'classification' | 'recordedFields'>,
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

const ClaimStatusMessageSchema = z
  .object({
    status: z.string().optional(),
    responseid: z
      .union([z.string(), z.number()])
      .transform((id) => String(id))
      .optional(),
    message: z.string().optional(),
    mesgid: z.string().optional(),
    fields: z.string().optional(),
  })
  .passthrough();

const ClaimStatusResponseSchema = z
  .object({
    status: z.string().optional(),
    response_time: z.string().optional(),
    sender_name: z.string().optional(),
    senderid: z.string().optional(),
    sender_icn: z.string().optional(),
    messages: z.array(ClaimStatusMessageSchema).optional(),
  })
  .passthrough();

const NO_DETAILS = 'Claim rejected; no details provided.';

type RejectionEntry = z.infer<typeof ClaimStatusMessageSchema> & { text: string };

export interface ParsedClaimStatusResponse {
  eventIdentifier: string;
  raw: z.infer<typeof ClaimStatusResponseSchema>;
}

export function parseClaimStatusResponse(response: ClaimResponse): ParsedClaimStatusResponse | undefined {
  const identifier = response.identifier?.find((entry) => entry.system === CLAIM_STATUS_RESPONSE_EVENT_SYSTEM);
  // Submission responses can also have raw-response; only the event identifier selects this feed.
  if (!identifier) return undefined;
  if (!identifier.value?.trim())
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} has an empty claim status event ID`);
  const separator = identifier.value.indexOf(':');
  if (separator < 1 || separator === identifier.value.length - 1)
    throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} must have an account:event claim status event ID`);
  const raw = response.extension?.find((entry) => entry.url === RAW_RESPONSE_EXTENSION_URL)?.valueString;
  if (!raw) throw INVALID_INPUT_ERROR(`ClaimResponse/${response.id} is missing the raw claim status response`);
  try {
    return { eventIdentifier: identifier.value, raw: ClaimStatusResponseSchema.parse(JSON.parse(raw)) };
  } catch (cause) {
    if (cause instanceof SyntaxError || cause instanceof z.ZodError) {
      throw { ...INVALID_INPUT_ERROR(`ClaimResponse/${response.id} has an invalid raw claim status response`), cause };
    }
    throw cause;
  }
}

export type ClassifiedClaimStatusResponse = ParsedClaimStatusResponse & { rejection?: RejectionEntry[] };

export function classifyClaimStatusResponse(response: ClaimResponse): ClassifiedClaimStatusResponse | undefined {
  const parsed = parseClaimStatusResponse(response);
  if (!parsed) return undefined;
  const { raw } = parsed;
  if (raw.status !== 'R') return parsed;

  const entries = (raw.messages ?? [])
    .filter((message) => message.status === 'R')
    .map((message) => ({ ...message, text: message.message?.trim() || NO_DETAILS }));
  return { ...parsed, rejection: entries.length ? entries : [{ text: NO_DETAILS }] };
}

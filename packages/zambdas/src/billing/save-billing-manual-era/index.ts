import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Claim,
  ClaimResponse,
  FhirResource,
  Organization,
  PaymentReconciliation,
  Practitioner,
  Provenance,
  Reference,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getNPI, getTaxID, makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { ERA_SOURCE } from 'utils/lib/types/data/billing/billing.constants';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { SaveManualEraResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR, MANUAL_ERA_VERSION_CONFLICT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { eraProvenanceTargetIds, fetchEraProcessingProvenances, isMatchedToClaim } from '../claim-amounts';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  entryClaimToInput,
  manualEraClaimFromFhir,
  ManualEraContext,
  manualEraHeaderFromFhir,
} from '../manual-era';
import {
  createBillingClient,
  fetchById,
  fhirName,
  findById,
  getEraSource,
  hasTag,
  MANUAL_ERA_IDEMPOTENCY_SYSTEM,
  payerDisplay,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_TAG,
  resolvePayersByRef,
} from '../shared';
import { SaveManualEraParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-manual-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const user = await getUser(params.userToken, params.secrets);
  if (!user.profile?.startsWith('Practitioner/')) throw NOT_AUTHORIZED;
  const actor: Reference = { reference: user.profile, display: user.email || user.name };

  const response = await performEffect(oystehr, params, actor, DateTime.now().toISO());
  return { statusCode: 200, body: JSON.stringify(response) };
});

interface StoredManualEra {
  pr: PaymentReconciliation;
  // manual ERAs keep a single era-processing Provenance; more would only come from outside edits
  provenances: Provenance[];
  // in the order the remit lists them (the Provenance targets)
  claimResponses: ClaimResponse[];
}

// Creates a manual ERA or applies one editor save to it, in a single transaction.
//
// Provenances are never updated in place: when the set of claims changes, the ERA's era-processing
// Provenance is replaced by one carrying the new target list plus the original author and time (so
// "Entered by" survives and no target is left pointing at a deleted claim).
export async function performEffect(
  oystehr: Oystehr,
  params: SaveManualEraParams,
  actor: Reference,
  now: string
): Promise<SaveManualEraResponse> {
  if (!params.eraId && params.idempotencyKey) {
    // a retried create returns the remit the first attempt made
    const replayed = await findByIdempotencyKey(oystehr, params.idempotencyKey);
    if (replayed?.id) return { eraId: replayed.id, versionId: replayed.meta?.versionId ?? '', claims: [] };
  }

  const stored = params.eraId ? await loadManualEra(oystehr, params.eraId, params.expectedVersionId) : undefined;
  const header: ManualEraHeader = params.header ?? manualEraHeaderFromFhir(stored!.pr);
  const context = await resolveContext(oystehr, header);

  const storedClaimResponses = stored?.claimResponses ?? [];
  const storedById = new Map(storedClaimResponses.map((claimResponse) => [claimResponse.id ?? '', claimResponse]));
  for (const claim of params.claims) {
    if (claim.claimResponseId && !storedById.has(claim.claimResponseId)) {
      throw INVALID_INPUT_ERROR(`Claim ${claim.claimResponseId} is not part of this remit`);
    }
  }
  for (const id of params.deleteClaimResponseIds) {
    const claimResponse = storedById.get(id);
    if (!claimResponse) throw INVALID_INPUT_ERROR(`Claim ${id} is not part of this remit`);
    // removing it would silently drop a posted payment; unmatching first makes that explicit
    if (isMatchedToClaim(claimResponse))
      throw INVALID_INPUT_ERROR('Unmatch this claim before removing it from the remit');
  }
  const matchedClaims = await loadMatchedClaims(oystehr, params.claims);

  const deleted = new Set(params.deleteClaimResponseIds);
  const upserts = new Map(
    params.claims.flatMap((claim) => (claim.claimResponseId ? [[claim.claimResponseId, claim] as const] : []))
  );
  const added = params.claims.filter((claim) => !claim.claimResponseId);

  const prReference = stored?.pr.id ? `PaymentReconciliation/${stored.pr.id}` : `urn:uuid:${randomUUID()}`;
  const requests: BatchInputRequest<FhirResource>[] = [];
  const pr = buildManualPaymentReconciliation({
    header,
    context,
    created: stored?.pr.created ?? now,
    editedAt: now,
    idempotencyKey: params.idempotencyKey,
    existing: stored?.pr,
  });
  // always written: the version bump is what makes a concurrent save of the same remit fail
  requests.push(
    stored
      ? {
          method: 'PUT',
          url: `/PaymentReconciliation/${stored.pr.id}`,
          resource: pr,
          ifMatch: makeOptimisticLockIfMatchHeader(stored.pr),
        }
      : { method: 'POST', url: '/PaymentReconciliation', resource: pr, fullUrl: prReference }
  );

  const claimReferences: string[] = [];
  const savedClaims: { clientKey?: string; claimResponseId?: string; requestIndex?: number }[] = [];
  for (const claimResponse of storedClaimResponses) {
    if (deleted.has(claimResponse.id ?? '')) continue;
    claimReferences.push(`ClaimResponse/${claimResponse.id}`);
    const upsert = upserts.get(claimResponse.id ?? '');
    if (upsert) savedClaims.push({ clientKey: upsert.clientKey, claimResponseId: claimResponse.id });
    // a claim is rebuilt when it was edited, or when the header it copies (payer, billing provider,
    // remit date) may have changed
    if (!upsert && !params.header) continue;
    const input: ManualEraClaim = upsert ?? entryClaimToInput(manualEraClaimFromFhir(claimResponse));
    const rebuilt = buildManualClaimResponse({ claim: input, header, context, existing: claimResponse });
    // an unchanged write would still re-fire the claim-response subscriptions
    if (sameContent(rebuilt, claimResponse)) continue;
    requests.push({ method: 'PUT', url: `/ClaimResponse/${claimResponse.id}`, resource: rebuilt });
  }
  for (const claim of added) {
    const fullUrl = `urn:uuid:${randomUUID()}`;
    claimReferences.push(fullUrl);
    const matchedClaim = claim.matchedClaimId ? matchedClaims.get(claim.matchedClaimId) : undefined;
    requests.push({
      method: 'POST',
      url: '/ClaimResponse',
      resource: buildManualClaimResponse({ claim, header, context, matchedClaim }),
      fullUrl,
    });
    savedClaims.push({ clientKey: claim.clientKey, requestIndex: requests.length - 1 });
  }

  const claimsChanged = !stored || added.length > 0 || deleted.size > 0;
  if (claimsChanged) {
    // the original record keeps its author and time; any extra ones are folded into it
    const original = [...(stored?.provenances ?? [])].sort((a, b) =>
      (a.recorded ?? '').localeCompare(b.recorded ?? '')
    )[0];
    for (const provenance of stored?.provenances ?? []) {
      requests.push({ method: 'DELETE', url: `/Provenance/${provenance.id}` });
    }
    for (const id of deleted) requests.push({ method: 'DELETE', url: `/ClaimResponse/${id}` });
    const { id: _originalId, ...originalContent } = original ?? {};
    requests.push({
      method: 'POST',
      url: '/Provenance',
      resource: buildManualEraProvenance({
        targets: [prReference, ...claimReferences],
        agent: actor,
        recorded: now,
        existing: original ? (originalContent as Provenance) : undefined,
      }),
    });
  }

  let bundle;
  try {
    bundle = await oystehr.fhir.transaction<FhirResource>({ requests });
  } catch (error) {
    if (isVersionConflict(error)) throw MANUAL_ERA_VERSION_CONFLICT_ERROR;
    throw error;
  }

  const entries = bundle.entry ?? [];
  const prEntry = entries[0];
  const eraId = prEntry?.resource?.id ?? idFromLocation(prEntry?.response?.location) ?? stored?.pr.id ?? '';
  const versionId = prEntry?.resource?.meta?.versionId ?? versionFromLocation(prEntry?.response?.location) ?? '';
  return {
    eraId,
    versionId,
    claims: savedClaims.map((saved) => {
      const entry = saved.requestIndex === undefined ? undefined : entries[saved.requestIndex];
      return {
        ...(saved.clientKey ? { clientKey: saved.clientKey } : {}),
        claimResponseId:
          saved.claimResponseId ?? entry?.resource?.id ?? idFromLocation(entry?.response?.location) ?? '',
      };
    }),
  };
}

async function findByIdempotencyKey(oystehr: Oystehr, key: string): Promise<PaymentReconciliation | undefined> {
  const bundle = await oystehr.fhir.search<PaymentReconciliation>({
    resourceType: 'PaymentReconciliation',
    params: [{ name: 'identifier', value: `${MANUAL_ERA_IDEMPOTENCY_SYSTEM}|${key}` }],
  });
  return bundle.unbundle()[0];
}

async function loadManualEra(oystehr: Oystehr, eraId: string, expectedVersionId?: string): Promise<StoredManualEra> {
  const pr = await fetchById<PaymentReconciliation>(oystehr, 'PaymentReconciliation', eraId);
  if (getEraSource(pr) !== ERA_SOURCE.manual) {
    throw INVALID_INPUT_ERROR('Only manually entered remits can be edited');
  }
  if (pr.meta?.versionId !== expectedVersionId) throw MANUAL_ERA_VERSION_CONFLICT_ERROR;

  const provenances = await fetchEraProcessingProvenances(oystehr, [`PaymentReconciliation/${eraId}`]);
  const ids = [...new Set(provenances.flatMap((provenance) => eraProvenanceTargetIds(provenance, 'ClaimResponse')))];
  const found =
    ids.length > 0
      ? (
          await oystehr.fhir.search<ClaimResponse>({
            resourceType: 'ClaimResponse',
            params: [
              { name: '_id', value: ids.join(',') },
              { name: '_count', value: String(ids.length) },
            ],
          })
        ).unbundle()
      : [];
  const byId = new Map(found.map((claimResponse) => [claimResponse.id, claimResponse]));
  return {
    pr,
    provenances,
    claimResponses: ids.flatMap((id) => byId.get(id) ?? []),
  };
}

async function resolveContext(oystehr: Oystehr, header: ManualEraHeader): Promise<ManualEraContext> {
  const payerUrl = getPayerUrl(header.payerId);
  const payer = (await resolvePayersByRef(oystehr, [payerUrl])).get(payerUrl);
  if (!payer) throw INVALID_INPUT_ERROR(`Payer ${header.payerId} was not found`);

  const [resourceType, id] = header.billingProviderRef.split('/') as ['Organization' | 'Practitioner', string];
  const provider = await findById<Organization | Practitioner>(oystehr, resourceType, id);
  if (!provider || !hasTag(provider, PROVIDER_ROLE_TAG, PROVIDER_ROLE_BILLING)) {
    throw INVALID_INPUT_ERROR('The billing provider was not found');
  }
  return {
    payer: { reference: payerUrl, display: payerDisplay(payer) ?? header.payerId },
    billingProvider: {
      reference: header.billingProviderRef,
      name: provider.resourceType === 'Organization' ? provider.name ?? '' : fhirName(provider),
      npi: getNPI(provider),
      taxId: getTaxID(provider),
    },
  };
}

async function loadMatchedClaims(oystehr: Oystehr, claims: ManualEraClaim[]): Promise<Map<string, Claim>> {
  const ids = [...new Set(claims.flatMap((claim) => (claim.matchedClaimId ? [claim.matchedClaimId] : [])))];
  if (ids.length === 0) return new Map();
  const found = (
    await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: ids.join(',') },
        { name: '_count', value: String(ids.length) },
      ],
    })
  ).unbundle();
  const byId = new Map(found.map((claim) => [claim.id ?? '', claim]));
  for (const id of ids) {
    if (!byId.has(id)) throw INVALID_INPUT_ERROR(`Claim ${id} was not found`);
  }
  return byId;
}

// Both sides as they would serialize, without the server's bookkeeping.
function sameContent(built: ClaimResponse, stored: ClaimResponse): boolean {
  const normalize = (resource: ClaimResponse): unknown => {
    const { meta: _meta, text: _text, ...rest } = JSON.parse(JSON.stringify(resource)) as ClaimResponse;
    return rest;
  };
  return isDeepStrictEqual(normalize(built), normalize(stored));
}

function isVersionConflict(error: unknown): boolean {
  if (!(error instanceof Oystehr.OystehrSdkError)) return false;
  return String(error.code) === '412' || String(error.code) === '409';
}

// "<Type>/<id>/_history/<version>"
const idFromLocation = (location: string | undefined): string | undefined => location?.split('/')[1];
const versionFromLocation = (location: string | undefined): string | undefined => location?.split('/')[3];

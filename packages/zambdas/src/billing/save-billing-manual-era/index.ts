import { randomUUID } from 'node:crypto';
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
import { getNPI, getTaxID, isVersionConflictError, makeOptimisticLockIfMatchHeader } from 'utils/lib/fhir/helpers';
import { getPayerId, getPayerUrl } from 'utils/lib/helpers/helpers';
import { ERA_SOURCE } from 'utils/lib/types/data/billing/billing.constants';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { SaveManualEraResponse } from 'utils/lib/types/data/billing/billing.types';
import { INVALID_INPUT_ERROR, MANUAL_ERA_VERSION_CONFLICT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { eraProvenanceTargetIds, fetchEraProcessingProvenances, isMatchedToClaim } from '../claim-amounts';
import { isCustomInsuranceOrganization, resolvePayerOrganization } from '../custom-insurance-org.helpers';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  entryClaimToInput,
  ManualEraBillingProviderAndPayer,
  manualEraClaimFromFhir,
  manualEraHeaderFromFhir,
  ManualEraPayer,
} from '../manual-era';
import {
  createBillingClient,
  fetchById,
  fhirName,
  findById,
  getEraSource,
  hasTag,
  payerDisplay,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_TAG,
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

  const validated = await complexValidation(oystehr, params);
  const response = await performEffect(oystehr, params, validated, actor, DateTime.now().toISO());
  return { statusCode: 200, body: JSON.stringify(response) };
});

export interface StoredManualEra {
  pr: PaymentReconciliation;
  // links the remit to its claims, as an imported ERA's era-processing Provenance does
  provenance?: Provenance;
  // in the order the remit lists them (the Provenance targets)
  claimResponses: ClaimResponse[];
}

// What a save writes from, once its input checks out against what's stored.
export interface ValidatedManualEraSave {
  // the remit being edited, at the version the editor loaded; absent when creating one
  stored?: StoredManualEra;
  header: ManualEraHeader;
  billingProviderAndPayer: ManualEraBillingProviderAndPayer;
  // the Claims new remit claims are associated with, by id
  matchedClaims: Map<string, Claim>;
}

// Loads what a save works from and checks the input against it: the stored remit, the remit details
// to save with their payer and billing provider, the claims being edited or removed, and the Claims
// new remit claims are associated with.
export async function complexValidation(
  oystehr: Oystehr,
  params: SaveManualEraParams
): Promise<ValidatedManualEraSave> {
  const stored = params.eraId ? await loadManualEra(oystehr, params.eraId, params.expectedVersionId) : undefined;
  // a save without remit details keeps the stored ones; a new remit has none to keep
  const header = params.header ?? (stored ? manualEraHeaderFromFhir(stored.pr) : undefined);
  if (!header) throw INVALID_INPUT_ERROR('"header" is required to create a remit');
  const billingProviderAndPayer = await resolveManualEraBillingProviderAndPayer(oystehr, header);

  const storedById = new Map(
    (stored?.claimResponses ?? []).map((claimResponse) => [claimResponse.id ?? '', claimResponse])
  );
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

  return { stored, header, billingProviderAndPayer, matchedClaims };
}

// Creates a manual ERA or applies one editor save to it, in a single transaction.
//
// The remit's era-processing Provenance is what links it to its claims. Adding or removing a claim
// updates that Provenance's target list in place; its author and time stay those of whoever keyed the
// remit in, which the remit shows as "Entered by".
export async function performEffect(
  oystehr: Oystehr,
  params: SaveManualEraParams,
  validated: ValidatedManualEraSave,
  actor: Reference,
  now: string
): Promise<SaveManualEraResponse> {
  const { stored, header, billingProviderAndPayer, matchedClaims } = validated;
  const storedClaimResponses = stored?.claimResponses ?? [];
  const deleted = new Set(params.deleteClaimResponseIds);
  const upserts = new Map(
    params.claims.flatMap((claim) => (claim.claimResponseId ? [[claim.claimResponseId, claim] as const] : []))
  );
  const added = params.claims.filter((claim) => !claim.claimResponseId);

  const prReference = stored?.pr.id ? `PaymentReconciliation/${stored.pr.id}` : `urn:uuid:${randomUUID()}`;
  const requests: BatchInputRequest<FhirResource>[] = [];
  const pr = buildManualPaymentReconciliation({
    header,
    billingProviderAndPayer,
    created: stored?.pr.created ?? now,
    editedAt: now,
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

  // Each claim copies the remit's payer, billing provider and remit date. Every write of a matched claim
  // re-runs the subscription that sets its Claim's status and ICN, so a claim is rewritten only when it
  // was edited or one of those changed.
  const storedHeader = stored && manualEraHeaderFromFhir(stored.pr);
  const copiedHeaderChanged =
    !!storedHeader &&
    (header.payerId !== storedHeader.payerId ||
      header.billingProviderRef !== storedHeader.billingProviderRef ||
      header.remitDate !== storedHeader.remitDate);
  const claimReferences: string[] = [];
  const savedClaims: { clientKey?: string; claimResponseId?: string; requestIndex?: number }[] = [];
  for (const claimResponse of storedClaimResponses) {
    if (deleted.has(claimResponse.id ?? '')) continue;
    claimReferences.push(`ClaimResponse/${claimResponse.id}`);
    const upsert = upserts.get(claimResponse.id ?? '');
    if (upsert) savedClaims.push({ clientKey: upsert.clientKey, claimResponseId: claimResponse.id });
    if (!upsert && !copiedHeaderChanged) continue;
    const input: ManualEraClaim = upsert ?? entryClaimToInput(manualEraClaimFromFhir(claimResponse));
    requests.push({
      method: 'PUT',
      url: `/ClaimResponse/${claimResponse.id}`,
      resource: buildManualClaimResponse({ claim: input, header, billingProviderAndPayer, existing: claimResponse }),
    });
  }
  for (const claim of added) {
    const fullUrl = `urn:uuid:${randomUUID()}`;
    claimReferences.push(fullUrl);
    const matchedClaim = claim.matchedClaimId ? matchedClaims.get(claim.matchedClaimId) : undefined;
    requests.push({
      method: 'POST',
      url: '/ClaimResponse',
      resource: buildManualClaimResponse({ claim, header, billingProviderAndPayer, matchedClaim }),
      fullUrl,
    });
    savedClaims.push({ clientKey: claim.clientKey, requestIndex: requests.length - 1 });
  }

  for (const id of deleted) requests.push({ method: 'DELETE', url: `/ClaimResponse/${id}` });
  const targets = [prReference, ...claimReferences];
  if (!stored?.provenance) {
    requests.push({
      method: 'POST',
      url: '/Provenance',
      resource: buildManualEraProvenance({ targets, agent: actor, recorded: now }),
    });
  } else if (added.length > 0 || deleted.size > 0) {
    requests.push({
      method: 'PATCH',
      url: `/Provenance/${stored.provenance.id}`,
      operations: [{ op: 'replace', path: '/target', value: targets.map((reference) => ({ reference })) }],
    });
  }

  let bundle;
  try {
    bundle = await oystehr.fhir.transaction<FhirResource>({ requests });
  } catch (error) {
    if (isVersionConflictError(error)) throw MANUAL_ERA_VERSION_CONFLICT_ERROR;
    throw error;
  }

  const entries = bundle.entry ?? [];
  const prEntry = entries[0];
  const eraId = prEntry?.resource?.id ?? idFromLocation(prEntry?.response?.location) ?? stored?.pr.id;
  const versionId = prEntry?.resource?.meta?.versionId ?? versionFromLocation(prEntry?.response?.location);
  // the server gives every write an id and a version; the editor's next save needs both
  if (!eraId || !versionId) throw new Error('The remit was saved without an id or version');
  return {
    eraId,
    versionId,
    claims: savedClaims.map((saved) => {
      const entry = saved.requestIndex === undefined ? undefined : entries[saved.requestIndex];
      const claimResponseId = saved.claimResponseId ?? entry?.resource?.id ?? idFromLocation(entry?.response?.location);
      if (!claimResponseId) throw new Error('A claim on the remit was saved without an id');
      return { ...(saved.clientKey ? { clientKey: saved.clientKey } : {}), claimResponseId };
    }),
  };
}

async function loadManualEra(oystehr: Oystehr, eraId: string, expectedVersionId?: string): Promise<StoredManualEra> {
  const pr = await fetchById<PaymentReconciliation>(oystehr, 'PaymentReconciliation', eraId);
  if (getEraSource(pr) !== ERA_SOURCE.manual) {
    throw INVALID_INPUT_ERROR('Only manually entered remits can be edited');
  }
  if (pr.meta?.versionId !== expectedVersionId) throw MANUAL_ERA_VERSION_CONFLICT_ERROR;

  const [provenance] = await fetchEraProcessingProvenances(oystehr, [`PaymentReconciliation/${eraId}`]);
  const ids = provenance ? eraProvenanceTargetIds(provenance, 'ClaimResponse') : [];
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
    provenance,
    claimResponses: ids.flatMap((id) => byId.get(id) ?? []),
  };
}

// The payer as PayerSelect names it: an RCM payer, referenced by its payer list URL as the ERA
// converters reference it, or a billing-app custom insurance organization, referenced directly as
// Organization/{id} (as billing claims reference it, and as the ERA list's payer filter matches it).
async function resolvePayer(oystehr: Oystehr, payerId: string): Promise<ManualEraPayer> {
  const payer = await resolvePayerOrganization(oystehr, payerId).catch(() => undefined);
  if (!payer) throw INVALID_INPUT_ERROR(`Payer ${payerId} was not found`);
  const reference = isCustomInsuranceOrganization(payer)
    ? `Organization/${payer.id}`
    : getPayerUrl(getPayerId(payer) ?? payerId);
  return { reference, display: payerDisplay(payer) ?? payerId };
}

async function resolveManualEraBillingProviderAndPayer(
  oystehr: Oystehr,
  header: ManualEraHeader
): Promise<ManualEraBillingProviderAndPayer> {
  const payer = await resolvePayer(oystehr, header.payerId);

  const [resourceType, id] = header.billingProviderRef.split('/') as ['Organization' | 'Practitioner', string];
  const provider = await findById<Organization | Practitioner>(oystehr, resourceType, id);
  if (!provider || !hasTag(provider, PROVIDER_ROLE_TAG, PROVIDER_ROLE_BILLING)) {
    throw INVALID_INPUT_ERROR('The billing provider was not found');
  }
  return {
    payer,
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

// "<Type>/<id>/_history/<version>"
const idFromLocation = (location: string | undefined): string | undefined => location?.split('/')[1];
const versionFromLocation = (location: string | undefined): string | undefined => location?.split('/')[3];

import Oystehr from '@oystehr/sdk';
import { ClaimResponse, ClaimResponseItemAdjudication, PaymentReconciliation } from 'fhir/r4b';
import { ClaimRemitAdjustment } from 'utils';
import { fetchAllPages } from '../shared';
import { ERA_ID_SYSTEM, getEraIdValue, getLinkedClaimResponseIds, getLinkedPaymentReconciliationId } from './shared';

export const OYSTEHR_ADJUDICATION_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/adjudication';
export const X12_ADJUSTMENT_GROUP_SYSTEM = 'https://x12.org/codes/claim-adjustment-group-codes';
export const ADJUDICATION_CODES = {
  PAID: 'paid',
  ALLOWED: 'allowed',
  ALLOWED_X12: 'B6',
} as const;
export const ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY = 'PR';

export interface ClaimResponseAmounts {
  paid: number;
  // undefined = the ClaimResponse carries no allowed data (distinct from an explicit 0)
  allowed: number | undefined;
  // undefined = the ClaimResponse carries no adjudication data at all, so PR can't be read off it
  patientResp: number | undefined;
}

export interface ClaimPaymentSummary {
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  adjudicated: boolean;
}

function allAdjudications(claimResponse: ClaimResponse): ClaimResponseItemAdjudication[] {
  return [
    ...(claimResponse.item ?? []).flatMap((item) => item.adjudication ?? []),
    ...(claimResponse.addItem ?? []).flatMap((item) => item.adjudication ?? []),
  ];
}

function adjudicationCode(adj: ClaimResponseItemAdjudication): string | undefined {
  return adj.category?.coding?.[0]?.code;
}

function sumAmounts(adjudications: ClaimResponseItemAdjudication[]): number {
  return adjudications.reduce((sum, adj) => sum + (adj.amount?.value ?? 0), 0);
}

export function extractClaimResponseAmounts(claimResponse: ClaimResponse): ClaimResponseAmounts {
  const adjudications = allAdjudications(claimResponse);

  const totalPaid = claimResponse.total?.find((t) => t.category?.coding?.[0]?.code === ADJUDICATION_CODES.PAID)?.amount
    ?.value;
  const paid =
    totalPaid ?? sumAmounts(adjudications.filter((adj) => adjudicationCode(adj) === ADJUDICATION_CODES.PAID));

  const allowedCodes: string[] = [ADJUDICATION_CODES.ALLOWED, ADJUDICATION_CODES.ALLOWED_X12];
  const allowedAdjudications = adjudications.filter((adj) => allowedCodes.includes(adjudicationCode(adj) ?? ''));
  const totalAllowed = claimResponse.total?.find((t) => t.category?.coding?.[0]?.code === ADJUDICATION_CODES.ALLOWED)
    ?.amount?.value;
  const allowed = allowedAdjudications.length > 0 ? sumAmounts(allowedAdjudications) : totalAllowed;
  const patientResp =
    adjudications.length > 0
      ? sumAmounts(adjudications.filter((adj) => adjudicationCode(adj) === ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY))
      : undefined;

  return {
    paid,
    allowed,
    patientResp,
  };
}

// CAS adjustments as written by both ERA converters: category = group code (system
// X12_ADJUSTMENT_GROUP_SYSTEM), reason = CARC reason code, amount = the adjusted amount.
export function extractRemitAdjustments(claimResponse: ClaimResponse): ClaimRemitAdjustment[] {
  return allAdjudications(claimResponse)
    .filter((adj) => adj.category?.coding?.[0]?.system === X12_ADJUSTMENT_GROUP_SYSTEM)
    .map((adj) => ({
      groupCode: adjudicationCode(adj) ?? '',
      reasonCode: adj.reason?.coding?.[0]?.code ?? '',
      amount: adj.amount?.value ?? 0,
    }));
}

export function sortClaimResponsesByRecency(claimResponses: ClaimResponse[]): ClaimResponse[] {
  return [...claimResponses].sort(
    (a, b) =>
      (a.created ?? '').localeCompare(b.created ?? '') ||
      (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? '')
  );
}

export function summarizeClaimPayments(claimResponses: ClaimResponse[], billed: number): ClaimPaymentSummary {
  // patientPaid comes from the patient-payments subsystem, which is not wired yet
  const patientPaid = 0;

  if (claimResponses.length === 0) {
    return {
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid,
      balance: billed,
      adjudicated: false,
    };
  }

  const amounts = sortClaimResponsesByRecency(claimResponses).map(extractClaimResponseAmounts);

  const insurancePaid = amounts.reduce((sum, a) => sum + a.paid, 0);
  const allowed = amounts.findLast((a) => a.allowed !== undefined)?.allowed ?? 0;
  const latestPatientResp = amounts[amounts.length - 1].patientResp;
  // fallback for adjudications without CAS data, wont go negative
  const patientResp = latestPatientResp ?? Math.max(allowed - insurancePaid - patientPaid, 0);

  return {
    allowed,
    insurancePaid,
    patientResp,
    patientPaid,
    balance: patientResp - patientPaid,
    adjudicated: true,
  };
}

// Oystehr leaves unmatched ERA ClaimResponses pointing at a contained '#request' claim instead of a
// real Claim/{id} reference.
export function isMatchedToClaim(claimResponse: ClaimResponse): boolean {
  return claimResponse.request?.reference?.startsWith('Claim/') ?? false;
}

export interface EraClaimCounts {
  total: number;
  matched: number;
  unmatched: number;
}

export function countEraClaims(claimResponses: ClaimResponse[]): EraClaimCounts {
  const matched = new Set(
    claimResponses.filter(isMatchedToClaim).map((claimResponse) => claimResponse.request?.reference)
  ).size;
  const unmatched = claimResponses.filter((claimResponse) => !isMatchedToClaim(claimResponse)).length;
  return {
    total: matched + unmatched,
    matched,
    unmatched,
  };
}

const BATCH = 100;
const PAGE_SIZE = 200;

async function fetchClaimResponsesGrouped(
  oystehr: Oystehr,
  ids: string[],
  buildParam: (batch: string[]) => { name: string; value: string },
  groupKeyOf: (claimResponse: ClaimResponse) => string | undefined
): Promise<Map<string, ClaimResponse[]>> {
  const grouped = new Map<string, ClaimResponse[]>();
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const batch = uniqueIds.slice(i, i + BATCH);
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<ClaimResponse>({
        resourceType: 'ClaimResponse',
        params: [
          buildParam(batch),
          {
            name: '_count',
            value: String(count),
          },
          {
            name: '_offset',
            value: String(offset),
          },
        ],
      });
      for (const claimResponse of bundle.unbundle()) {
        const key = groupKeyOf(claimResponse);
        if (!key) continue;
        const list = grouped.get(key) ?? [];
        list.push(claimResponse);
        grouped.set(key, list);
      }
      return bundle;
    }, PAGE_SIZE);
  }
  return grouped;
}

// Fetch every matched ClaimResponse for the given claims, grouped by claim id. Unmatched ERA
// ClaimResponses never carry a Claim/{id} request reference, so this returns matched ones only.
export async function fetchClaimResponsesByClaimIds(
  oystehr: Oystehr,
  claimIds: string[]
): Promise<Map<string, ClaimResponse[]>> {
  return fetchClaimResponsesGrouped(
    oystehr,
    claimIds,
    (batch) => ({
      name: 'request',
      value: batch.map((id) => `Claim/${id}`).join(','),
    }),
    (claimResponse) => claimResponse.request?.reference?.replace('Claim/', '')
  );
}

// Fetch every ClaimResponse produced by the given ERAs, grouped by ERA business identifier.
// Includes unmatched responses (contained '#request' claims) so callers can count both.
export async function fetchClaimResponsesByEraIds(
  oystehr: Oystehr,
  eraIdValues: string[]
): Promise<Map<string, ClaimResponse[]>> {
  return fetchClaimResponsesGrouped(
    oystehr,
    eraIdValues,
    (batch) => ({
      name: 'identifier',
      value: batch.map((id) => `${ERA_ID_SYSTEM}|${id}`).join(','),
    }),
    (claimResponse) => getEraIdValue(claimResponse)
  );
}

export async function fetchClaimResponsesByPaymentReconciliations(
  oystehr: Oystehr,
  paymentReconciliations: PaymentReconciliation[]
): Promise<Map<string, ClaimResponse[]>> {
  const linkedIdsByPrId = new Map<string, string[]>();
  const eraIdByPrId = new Map<string, string>();
  for (const pr of paymentReconciliations) {
    if (!pr.id) continue;
    const eraIdValue = getEraIdValue(pr);
    if (eraIdValue) {
      eraIdByPrId.set(pr.id, eraIdValue);
      continue;
    }
    const linkedIds = getLinkedClaimResponseIds(pr);
    if (linkedIds.length > 0) linkedIdsByPrId.set(pr.id, linkedIds);
  }

  const [byId, byEraId] = await Promise.all([
    fetchClaimResponsesGrouped(
      oystehr,
      [...linkedIdsByPrId.values()].flat(),
      (batch) => ({
        name: '_id',
        value: batch.join(','),
      }),
      (claimResponse) => claimResponse.id
    ),
    fetchClaimResponsesByEraIds(oystehr, [...eraIdByPrId.values()]),
  ]);

  const grouped = new Map<string, ClaimResponse[]>();
  for (const [prId, linkedIds] of linkedIdsByPrId) {
    grouped.set(
      prId,
      linkedIds.flatMap((id) => byId.get(id) ?? [])
    );
  }
  for (const [prId, eraIdValue] of eraIdByPrId) {
    grouped.set(prId, byEraId.get(eraIdValue) ?? []);
  }
  return grouped;
}

export async function fetchPaymentReconciliationsByClaimResponses(
  oystehr: Oystehr,
  claimResponses: ClaimResponse[]
): Promise<PaymentReconciliation[]> {
  const eraIds = new Set<string>();
  const prIds = new Set<string>();
  for (const cr of claimResponses) {
    const eraIdValue = getEraIdValue(cr);
    if (eraIdValue) {
      eraIds.add(eraIdValue);
      continue;
    }
    const prId = getLinkedPaymentReconciliationId(cr);
    if (prId) prIds.add(prId);
  }

  const searchParamsList: { name: string; value: string }[][] = [];
  if (eraIds.size > 0) {
    searchParamsList.push([
      {
        name: 'identifier',
        value: [...eraIds].map((v) => `${ERA_ID_SYSTEM}|${v}`).join(','),
      },
    ]);
  }
  if (prIds.size > 0) {
    searchParamsList.push([
      {
        name: '_id',
        value: [...prIds].join(','),
      },
    ]);
  }

  const bundles = await Promise.all(
    searchParamsList.map((params) =>
      oystehr.fhir.search<PaymentReconciliation>({
        resourceType: 'PaymentReconciliation',
        params: [
          ...params,
          {
            name: '_count',
            value: '1000',
          },
        ],
      })
    )
  );
  const paymentReconciliations = bundles.flatMap((bundle) => bundle.unbundle());
  return [...new Map(paymentReconciliations.map((pr) => [pr.id, pr])).values()];
}

// check era-id, fallback to payment reconciliation id match
export function claimResponseBelongsToEra(
  claimResponse: ClaimResponse,
  paymentReconciliation: PaymentReconciliation
): boolean {
  const eraIdValue = getEraIdValue(paymentReconciliation);
  if (eraIdValue) return getEraIdValue(claimResponse) === eraIdValue;
  return !!paymentReconciliation.id && getLinkedPaymentReconciliationId(claimResponse) === paymentReconciliation.id;
}

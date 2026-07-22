import Oystehr from '@oystehr/sdk';
import { ClaimResponse, ClaimResponseItemAdjudication, PaymentReconciliation, Provenance } from 'fhir/r4b';
import { ClaimRemitAdjustment, X12_ADJUSTMENT_GROUP_CODE, X12AdjustmentGroupCode } from 'utils';
import { fetchAllPages } from '../shared';
import { isEraProcessingProvenance } from './shared';

export const OYSTEHR_ADJUDICATION_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/adjudication';
export const X12_ADJUSTMENT_GROUP_SYSTEM = 'https://x12.org/codes/claim-adjustment-group-codes';
export const ADJUDICATION_CODES = {
  PAID: 'paid',
  ALLOWED: 'allowed',
  ALLOWED_X12: 'B6',
} as const;
export const ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY = X12_ADJUSTMENT_GROUP_CODE.patientResponsibility;

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
    .filter((adj) => adj.category?.coding?.[0]?.system === X12_ADJUSTMENT_GROUP_SYSTEM && adjudicationCode(adj) != null)
    .map((adj) => ({
      groupCode: adjudicationCode(adj) as X12AdjustmentGroupCode,
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

// Fetch the era-processing Provenances (one per ERA, targeting its PR + ClaimResponses) that point
// at any of the given resource references, deduped by id.
export async function fetchEraProcessingProvenances(oystehr: Oystehr, targetRefs: string[]): Promise<Provenance[]> {
  const byId = new Map<string, Provenance>();
  const uniqueRefs = [...new Set(targetRefs)];
  for (let i = 0; i < uniqueRefs.length; i += BATCH) {
    const batch = uniqueRefs.slice(i, i + BATCH);
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [
          {
            name: 'target',
            value: batch.join(','),
          },
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
      for (const provenance of bundle.unbundle()) {
        if (provenance.id && isEraProcessingProvenance(provenance)) byId.set(provenance.id, provenance);
      }
      return bundle;
    }, PAGE_SIZE);
  }
  return [...byId.values()];
}

export function eraProvenanceTargetIds(provenance: Provenance, resourceType: string): string[] {
  const prefix = `${resourceType}/`;
  return (provenance.target ?? [])
    .map((target) => target.reference ?? '')
    .filter((reference) => reference.startsWith(prefix))
    .map((reference) => reference.slice(prefix.length));
}

async function fetchPaymentReconciliationsByIds(oystehr: Oystehr, ids: string[]): Promise<PaymentReconciliation[]> {
  const results: PaymentReconciliation[] = [];
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += BATCH) {
    const batch = uniqueIds.slice(i, i + BATCH);
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<PaymentReconciliation>({
        resourceType: 'PaymentReconciliation',
        params: [
          {
            name: '_id',
            value: batch.join(','),
          },
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
      results.push(...bundle.unbundle());
      return bundle;
    }, PAGE_SIZE);
  }
  return results;
}

export async function fetchClaimResponsesByPaymentReconciliations(
  oystehr: Oystehr,
  paymentReconciliations: PaymentReconciliation[]
): Promise<Map<string, ClaimResponse[]>> {
  const prIds = paymentReconciliations.map((pr) => pr.id).filter((id): id is string => !!id);
  const provenances = await fetchEraProcessingProvenances(
    oystehr,
    prIds.map((id) => `PaymentReconciliation/${id}`)
  );
  return fetchClaimResponsesFromEraProvenances(oystehr, provenances);
}

export async function fetchClaimResponsesFromEraProvenances(
  oystehr: Oystehr,
  provenances: Provenance[]
): Promise<Map<string, ClaimResponse[]>> {
  const claimResponseIdsByPrId = new Map<string, string[]>();
  for (const provenance of provenances) {
    const claimResponseIds = eraProvenanceTargetIds(provenance, 'ClaimResponse');
    for (const prId of eraProvenanceTargetIds(provenance, 'PaymentReconciliation')) {
      claimResponseIdsByPrId.set(prId, [...(claimResponseIdsByPrId.get(prId) ?? []), ...claimResponseIds]);
    }
  }

  const claimResponsesById = await fetchClaimResponsesGrouped(
    oystehr,
    [...new Set([...claimResponseIdsByPrId.values()].flat())],
    (batch) => ({
      name: '_id',
      value: batch.join(','),
    }),
    (claimResponse) => claimResponse.id
  );

  const grouped = new Map<string, ClaimResponse[]>();
  for (const [prId, claimResponseIds] of claimResponseIdsByPrId) {
    grouped.set(
      prId,
      claimResponseIds.flatMap((id) => claimResponsesById.get(id) ?? [])
    );
  }
  return grouped;
}

export interface ClaimEraLinks {
  paymentReconciliations: PaymentReconciliation[];
  claimResponseByPrId: Map<string, ClaimResponse>;
}

export async function fetchClaimEraLinks(oystehr: Oystehr, claimResponses: ClaimResponse[]): Promise<ClaimEraLinks> {
  const claimResponseById = new Map(claimResponses.filter((cr) => cr.id).map((cr) => [cr.id as string, cr]));
  const provenances = await fetchEraProcessingProvenances(
    oystehr,
    [...claimResponseById.keys()].map((id) => `ClaimResponse/${id}`)
  );

  const prIds = new Set<string>();
  const claimResponseByPrId = new Map<string, ClaimResponse>();
  for (const provenance of provenances) {
    const linkedClaimResponse = eraProvenanceTargetIds(provenance, 'ClaimResponse')
      .map((id) => claimResponseById.get(id))
      .find((cr): cr is ClaimResponse => !!cr);
    for (const prId of eraProvenanceTargetIds(provenance, 'PaymentReconciliation')) {
      prIds.add(prId);
      if (linkedClaimResponse) claimResponseByPrId.set(prId, linkedClaimResponse);
    }
  }

  const paymentReconciliations = prIds.size > 0 ? await fetchPaymentReconciliationsByIds(oystehr, [...prIds]) : [];
  return {
    paymentReconciliations,
    claimResponseByPrId,
  };
}

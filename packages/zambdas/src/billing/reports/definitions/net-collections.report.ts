import Oystehr from '@oystehr/sdk';
import { ClaimResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { ReportDateWindowParams, ReportDateWindowParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingNetCollectionsReportResponse,
  NetCollectionsBucket,
  NetCollectionsMonthlyPoint,
  NetCollectionsPayerRow,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import {
  extractClaimResponseAmounts,
  fetchClaimResponsesByPaymentReconciliations,
  isMatchedToClaim,
} from '../../claim-amounts';
import { resolvePayersByRef } from '../../shared';
import { ReportDefinition } from '../framework/types';
import {
  checkDateInRange,
  claimResponseClaimId,
  eraCheckMonth,
  eraPayerRef,
  eraReportedPayerName,
  fetchAllEras,
  fetchPartialClaimsById,
  payerIdFromRef,
  payerNamesByRef,
  UNKNOWN_PAYER_NAME,
  WATERFALL_UNKNOWN_MONTH,
} from '../shared';
import { MatchedClaimKeys, patientNetCollections } from './patient-payments.report';

type NetCollectionsPayload = Omit<GetBillingNetCollectionsReportResponse, 'fromCache' | 'status'>;

const round = (value: number): number => roundNumberToDecimalPlaces(value, 2);

const emptyBucket = (): NetCollectionsBucket => ({ collected: 0, expected: 0 });

const roundBucket = (bucket: NetCollectionsBucket): NetCollectionsBucket => ({
  collected: round(bucket.collected),
  expected: round(bucket.expected),
});

// Net collection rate, cash-basis, over matched claims only: insurance figures come from posted
// ERAs' ClaimResponses that are matched to real Claims, bucketed by check month; patient
// collections (net of refunds) count only payments against those matched claims' patient
// responsibility, bucketed by payment month. Expected amounts are contractual: allowed for the
// practice, allowed − patient responsibility for insurance, patient responsibility for patients.
export const netCollectionsReport: ReportDefinition<ReportDateWindowParams, NetCollectionsPayload> = {
  kind: 'net-collections',
  cacheVersion: 'v1',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({
    overall: emptyBucket(),
    insurance: emptyBucket(),
    patient: emptyBucket(),
    payerRows: [],
    monthly: [],
    generatedAt: '',
  }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('aggregating posted ERAs…');
    const insurance = await computeInsuranceSide(ctx.oystehr, ctx.untaggedClient, params);
    await onProgress('rolling up patient payments…');
    const patient = await patientNetCollections(
      ctx.oystehr,
      ctx.untaggedClient,
      params,
      ctx.secrets,
      insurance.matched,
      onProgress
    );

    const patientRespTotal = insurance.payerRows.reduce((sum, row) => sum + row.patientResp, 0);
    const allowedTotal = insurance.payerRows.reduce((sum, row) => sum + row.allowed, 0);
    const paidTotal = insurance.payerRows.reduce((sum, row) => sum + row.paid, 0);

    const months = [...new Set([...insurance.byMonth.keys(), ...patient.byMonth.keys()])].sort();
    const monthly: NetCollectionsMonthlyPoint[] = months.map((month) => {
      const insMonth = insurance.byMonth.get(month);
      return {
        month,
        insurance: roundBucket(insMonth?.insurance ?? emptyBucket()),
        patient: roundBucket({
          collected: patient.byMonth.get(month) ?? 0,
          expected: insMonth?.patientResp ?? 0,
        }),
      };
    });

    const payload: NetCollectionsPayload = {
      overall: roundBucket({ collected: paidTotal + patient.net, expected: allowedTotal }),
      insurance: roundBucket({ collected: paidTotal, expected: allowedTotal - patientRespTotal }),
      patient: roundBucket({ collected: patient.net, expected: patientRespTotal }),
      payerRows: insurance.payerRows,
      monthly,
      generatedAt: DateTime.now().toUTC().toISO() ?? '',
    };
    return { payload };
  },
  summarize: (payload) => {
    const rate =
      payload.overall.expected > 0 ? Math.round((payload.overall.collected / payload.overall.expected) * 1000) / 10 : 0;
    return `net collections cached (${rate}% overall, ${payload.payerRows.length} payers)`;
  },
};

interface InsuranceMonth {
  insurance: NetCollectionsBucket;
  // that month's ERA-assigned patient responsibility: the patient-side monthly denominator
  patientResp: number;
}

const emptyMatched = (): MatchedClaimKeys => ({ claimIds: new Set(), encounterIds: new Set() });

// Per-payer and per-check-month rollup of allowed / patient responsibility / insurance paid
// over the ERAs whose check date falls in the window, counting only ClaimResponses matched to
// real Claims — unmatched remit rows (and ERAs with no matched claims at all) contribute
// nothing. Mirrors the payments report's payer attribution (paymentIssuer, else the
// ClaimResponses' insurer).
async function computeInsuranceSide(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: ReportDateWindowParams
): Promise<{ payerRows: NetCollectionsPayerRow[]; byMonth: Map<string, InsuranceMonth>; matched: MatchedClaimKeys }> {
  const allEras = await fetchAllEras(eraReadClient);
  const eras = allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo));
  if (eras.length === 0) return { payerRows: [], byMonth: new Map(), matched: emptyMatched() };

  const fetched = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, eras);
  const claimResponsesByPrId = new Map(
    [...fetched].map(([prId, claimResponses]) => [prId, claimResponses.filter(isMatchedToClaim)])
  );
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  const harvestedNamesByRef = payerNamesByRef(allClaimResponses);
  const payersByRef = await resolvePayersByRef(oystehr, [
    ...eras.map((pr) => pr.paymentIssuer?.reference),
    ...allClaimResponses.map((cr) => cr.insurer?.reference),
  ]);

  const rowsByPayerKey = new Map<string, NetCollectionsPayerRow>();
  const byMonth = new Map<string, InsuranceMonth>();
  for (const era of eras) {
    const claimResponses = claimResponsesByPrId.get(era.id ?? '') ?? [];
    if (claimResponses.length === 0) continue;
    const payerRefOfEra = eraPayerRef(era, claimResponses);
    const refPayerIdOfEra = payerIdFromRef(payerRefOfEra);
    const payer = payerRefOfEra ? payersByRef.get(payerRefOfEra) : undefined;
    const payerName =
      payer?.name ??
      harvestedNamesByRef.get(payerRefOfEra ?? '') ??
      eraReportedPayerName(claimResponses) ??
      era.paymentIssuer?.display ??
      (refPayerIdOfEra ? `Payer ${refPayerIdOfEra}` : UNKNOWN_PAYER_NAME);

    const key = payerRefOfEra ?? 'unknown';
    let row = rowsByPayerKey.get(key);
    if (!row) {
      row = {
        payerId: getPayerId(payer) ?? refPayerIdOfEra ?? '',
        payerName,
        claimCount: 0,
        allowed: 0,
        patientResp: 0,
        expected: 0,
        paid: 0,
      };
      rowsByPayerKey.set(key, row);
    }
    row.claimCount += claimResponses.length;

    const checkMonth = eraCheckMonth(era);
    let month = byMonth.get(checkMonth);
    if (!month && checkMonth !== WATERFALL_UNKNOWN_MONTH) {
      month = { insurance: emptyBucket(), patientResp: 0 };
      byMonth.set(checkMonth, month);
    }

    for (const claimResponse of claimResponses) {
      const amounts = extractClaimResponseAmounts(claimResponse);
      const allowed = amounts.allowed ?? 0;
      // no CAS data falls back to allowed-but-unpaid, floored — summarizeClaimPayments semantics;
      // coalescing to 0 would count the whole allowed amount as insurance-collectible
      const patientResp = Math.max(amounts.patientResp ?? allowed - amounts.paid, 0);
      row.allowed += allowed;
      row.patientResp += patientResp;
      row.paid += amounts.paid;
      if (month) {
        month.insurance.expected += allowed - patientResp;
        month.insurance.collected += amounts.paid;
        month.patientResp += patientResp;
      }
    }
  }

  const payerRows = [...rowsByPayerKey.values()]
    .map((row) => ({
      ...row,
      allowed: round(row.allowed),
      patientResp: round(row.patientResp),
      expected: round(row.allowed - row.patientResp),
      paid: round(row.paid),
    }))
    .sort((a, b) => b.expected - a.expected);
  return { payerRows, byMonth, matched: await matchedClaimKeysOf(oystehr, allClaimResponses) };
}

// Claim ids adjudicated by the windowed ERAs plus their encounter ids (the claim-encounter-id
// identifier) — the keys patient payments link back through.
async function matchedClaimKeysOf(oystehr: Oystehr, claimResponses: ClaimResponse[]): Promise<MatchedClaimKeys> {
  const claimIds = new Set(claimResponses.map(claimResponseClaimId).filter((id): id is string => !!id));
  const claimsById = await fetchPartialClaimsById(oystehr, [...claimIds]);
  const encounterSystem = ottehrIdentifierSystem('claim-encounter-id');
  const encounterIds = new Set(
    [...claimsById.values()]
      .map((claim) => claim.identifier?.find((identifier) => identifier.system === encounterSystem)?.value)
      .filter((id): id is string => !!id)
  );
  return { claimIds, encounterIds };
}

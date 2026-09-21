import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { ReportDateWindowParams, ReportDateWindowParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingNetCollectionsReportResponse,
  NetCollectionsBucket,
  NetCollectionsMonthlyPoint,
  NetCollectionsPayerRow,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { extractClaimResponseAmounts, fetchClaimResponsesByPaymentReconciliations } from '../../claim-amounts';
import { resolvePayersByRef } from '../../shared';
import { ReportDefinition } from '../framework/types';
import {
  checkDateInRange,
  eraCheckMonth,
  eraPayerRef,
  eraReportedPayerName,
  fetchAllEras,
  payerIdFromRef,
  payerNamesByRef,
  UNKNOWN_PAYER_NAME,
  WATERFALL_UNKNOWN_MONTH,
} from '../shared';
import { patientNetCollections } from './patient-payments.report';

type NetCollectionsPayload = Omit<GetBillingNetCollectionsReportResponse, 'fromCache' | 'status'>;

const round = (value: number): number => roundNumberToDecimalPlaces(value, 2);

const emptyBucket = (): NetCollectionsBucket => ({ collected: 0, expected: 0 });

const roundBucket = (bucket: NetCollectionsBucket): NetCollectionsBucket => ({
  collected: round(bucket.collected),
  expected: round(bucket.expected),
});

// Net collection rate, cash-basis: insurance figures come from posted ERAs bucketed by check
// month; patient collections (net of refunds) come from PaymentNotices bucketed by payment month.
// Expected amounts are contractual: allowed for the practice, allowed − patient responsibility
// for insurance, patient responsibility for patients.
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
    const patient = await patientNetCollections(ctx.oystehr, ctx.untaggedClient, params, ctx.secrets, onProgress);

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

// Per-payer and per-check-month rollup of allowed / patient responsibility / insurance paid
// over the ERAs whose check date falls in the window. Mirrors the payments report's payer
// attribution (paymentIssuer, else the ClaimResponses' insurer).
async function computeInsuranceSide(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: ReportDateWindowParams
): Promise<{ payerRows: NetCollectionsPayerRow[]; byMonth: Map<string, InsuranceMonth> }> {
  const allEras = await fetchAllEras(eraReadClient);
  const eras = allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo));
  if (eras.length === 0) return { payerRows: [], byMonth: new Map() };

  const claimResponsesByPrId = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, eras);
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
      const patientResp = amounts.patientResp ?? 0;
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
  return { payerRows, byMonth };
}

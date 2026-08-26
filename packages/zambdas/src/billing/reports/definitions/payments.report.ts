import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { getPayerId } from 'utils/lib/helpers/helpers';
import { ReportDateWindowParams, ReportDateWindowParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingPaymentsReportResponse,
  PaymentsReportPayerRow,
  PaymentsReportWaterfallCell,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import {
  extractClaimResponseAmounts,
  extractReportedCharge,
  fetchClaimResponsesByPaymentReconciliations,
} from '../../claim-amounts';
import { resolvePayersByRef } from '../../shared';
import { ReportDefinition } from '../framework/types';
import {
  checkDateInRange,
  claimResponseClaimId,
  claimResponseServiceDay,
  eraCheckMonth,
  eraPayerRef,
  eraReportedPayerName,
  fetchAllEras,
  fetchPartialClaimsById,
  payerIdFromRef,
  payerNamesByRef,
  toMonth,
  UNKNOWN_PAYER_NAME,
  WATERFALL_UNKNOWN_MONTH,
} from '../shared';

type PaymentsReportPayload = Omit<GetBillingPaymentsReportResponse, 'fromCache' | 'status'>;

export const paymentsReport: ReportDefinition<ReportDateWindowParams, PaymentsReportPayload> = {
  kind: 'payments',
  cacheVersion: 'v1',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({ rows: [], totals: totalsOf([]), waterfall: [], generatedAt: '' }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('aggregating posted ERAs…');
    const { rows, waterfall } = await computeInsurancePayments(ctx.oystehr, ctx.untaggedClient, params);
    return { rows, totals: totalsOf(rows), waterfall, generatedAt: DateTime.now().toUTC().toISO() };
  },
  summarize: (payload) => `payments report cached (${payload.rows.length} payers)`,
};

// Aggregates over posted ERAs: each PaymentReconciliation and its ClaimResponses roll up to the
// ERA's payer (paymentIssuer, else the ClaimResponses' insurer). Payer rows honor the check-date
// window; the waterfall matrix (DOS month × check month) always spans all ERAs.
async function computeInsurancePayments(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: ReportDateWindowParams
): Promise<{ rows: PaymentsReportPayerRow[]; waterfall: PaymentsReportWaterfallCell[] }> {
  const allEras = await fetchAllEras(eraReadClient);
  if (allEras.length === 0) return { rows: [], waterfall: [] };

  const claimResponsesByPrId = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, allEras);
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  const harvestedNamesByRef = payerNamesByRef(allClaimResponses);
  // process-era PaymentReconciliations carry no paymentIssuer; fall back to the ClaimResponses' payer
  const [payersByRef, partialClaimsById] = await Promise.all([
    resolvePayersByRef(oystehr, [
      ...allEras.map((pr) => pr.paymentIssuer?.reference),
      ...allClaimResponses.map((cr) => cr.insurer?.reference),
    ]),
    fetchPartialClaimsById(oystehr, allClaimResponses.map(claimResponseClaimId).filter(Boolean) as string[]),
  ]);

  // no FHIR search parameter exists for paymentDate, so the check-date window filters in memory
  const erasInWindow = new Set(
    allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo)).map((era) => era.id)
  );

  const rowsByPayerKey = new Map<string, PaymentsReportPayerRow>();
  const paidByMatrixKey = new Map<string, number>();
  for (const era of allEras) {
    const claimResponses = claimResponsesByPrId.get(era.id ?? '') ?? [];
    const checkMonth = eraCheckMonth(era);
    const inWindow = erasInWindow.has(era.id);

    let row: PaymentsReportPayerRow | undefined;
    if (inWindow) {
      const payerRef = eraPayerRef(era, claimResponses);
      const payer = payerRef ? payersByRef.get(payerRef) : undefined;
      const key = payerRef ?? 'unknown';
      const refPayerId = payerIdFromRef(payerRef);

      row = rowsByPayerKey.get(key);
      if (!row) {
        row = {
          payerId: getPayerId(payer) ?? refPayerId ?? '',
          payerName:
            payer?.name ??
            harvestedNamesByRef.get(payerRef ?? '') ??
            eraReportedPayerName(claimResponses) ??
            era.paymentIssuer?.display ??
            (refPayerId ? `Payer ${refPayerId}` : UNKNOWN_PAYER_NAME),
          eraCount: 0,
          claimCount: 0,
          billed: 0,
          allowed: 0,
          insurancePaid: 0,
          checkTotal: 0,
        };
        rowsByPayerKey.set(key, row);
      }

      row.eraCount += 1;
      row.claimCount += claimResponses.length;
      row.checkTotal += era.paymentAmount?.value ?? 0;
    }

    for (const claimResponse of claimResponses) {
      const amounts = extractClaimResponseAmounts(claimResponse);
      if (row) {
        row.billed += extractReportedCharge(claimResponse) ?? 0;
        row.allowed += amounts.allowed ?? 0;
        row.insurancePaid += amounts.paid;
      }

      const serviceDay = claimResponseServiceDay(claimResponse, partialClaimsById);
      const serviceMonth = toMonth(serviceDay ?? undefined) ?? WATERFALL_UNKNOWN_MONTH;
      const matrixKey = `${serviceMonth}|${checkMonth}`;
      paidByMatrixKey.set(matrixKey, (paidByMatrixKey.get(matrixKey) ?? 0) + amounts.paid);
    }
  }

  const rows = [...rowsByPayerKey.values()]
    .map((row) => ({
      ...row,
      billed: roundNumberToDecimalPlaces(row.billed, 2),
      allowed: roundNumberToDecimalPlaces(row.allowed, 2),
      insurancePaid: roundNumberToDecimalPlaces(row.insurancePaid, 2),
      checkTotal: roundNumberToDecimalPlaces(row.checkTotal, 2),
    }))
    .sort((a, b) => b.insurancePaid - a.insurancePaid || b.checkTotal - a.checkTotal);

  const waterfall = [...paidByMatrixKey.entries()]
    .map(([matrixKey, paid]) => {
      const [serviceMonth, checkMonth] = matrixKey.split('|');
      return { serviceMonth, checkMonth, paid: roundNumberToDecimalPlaces(paid, 2) };
    })
    .sort((a, b) => a.serviceMonth.localeCompare(b.serviceMonth) || a.checkMonth.localeCompare(b.checkMonth));

  return { rows, waterfall };
}

export function totalsOf(rows: PaymentsReportPayerRow[]): GetBillingPaymentsReportResponse['totals'] {
  const totals = rows.reduce(
    (acc, row) => ({
      eraCount: acc.eraCount + row.eraCount,
      claimCount: acc.claimCount + row.claimCount,
      billed: acc.billed + row.billed,
      allowed: acc.allowed + row.allowed,
      insurancePaid: acc.insurancePaid + row.insurancePaid,
      checkTotal: acc.checkTotal + row.checkTotal,
    }),
    { eraCount: 0, claimCount: 0, billed: 0, allowed: 0, insurancePaid: 0, checkTotal: 0 }
  );
  return {
    ...totals,
    billed: roundNumberToDecimalPlaces(totals.billed, 2),
    allowed: roundNumberToDecimalPlaces(totals.allowed, 2),
    insurancePaid: roundNumberToDecimalPlaces(totals.insurancePaid, 2),
    checkTotal: roundNumberToDecimalPlaces(totals.checkTotal, 2),
  };
}

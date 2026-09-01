import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getPayerId } from 'utils/lib/helpers/helpers';
import {
  GetBillingPaymentsReportDrilldownInput,
  GetBillingPaymentsReportDrilldownInputSchema,
  ReportDateWindowParams,
  ReportDateWindowParamsSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingPaymentsReportResponse,
  PaymentsReportDetail,
  PaymentsReportDetailEra,
  PaymentsReportPayerRow,
  PaymentsReportWaterfallCell,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import {
  extractClaimResponseAmounts,
  extractReportedCharge,
  fetchClaimResponsesByPaymentReconciliations,
  sortClaimResponsesByRecency,
} from '../../claim-amounts';
import { eraPatientAccountNumber } from '../../era-remits';
import { fhirName, getEraCheckNumber, resolvePayersByRef } from '../../shared';
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
  toDay,
  toMonth,
  UNKNOWN_PAYER_NAME,
  WATERFALL_UNKNOWN_MONTH,
} from '../shared';

type PaymentsReportPayload = Omit<GetBillingPaymentsReportResponse, 'fromCache' | 'status'>;

// sentinel for ERAs with no payer reference
const NO_PAYER_SENTINEL = 'none';

const checkDayInRange = (checkDate: string, from?: string, to?: string): boolean => {
  if (!from && !to) return true;
  const day = toDay(checkDate);
  if (!day) return false;
  if (from && day < (toDay(from) ?? '')) return false;
  if (to && day > (toDay(to) ?? '')) return false;
  return true;
};

export const paymentsReport: ReportDefinition<
  ReportDateWindowParams,
  PaymentsReportPayload,
  PaymentsReportDetail,
  GetBillingPaymentsReportDrilldownInput
> = {
  kind: 'payments',
  cacheVersion: 'v2',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  // detail spans all ERAs regardless of the window
  detailCacheKeyOf: () => '',
  emptyPayload: () => ({ rows: [], totals: totalsOf([]), waterfall: [], generatedAt: '' }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('aggregating posted ERAs…');
    const { rows, waterfall, detail } = await computeInsurancePayments(ctx.oystehr, ctx.untaggedClient, params);
    return {
      payload: { rows, totals: totalsOf(rows), waterfall, generatedAt: DateTime.now().toUTC().toISO() },
      detail,
    };
  },
  drilldown: {
    paramsSchema: GetBillingPaymentsReportDrilldownInputSchema,
    empty: () => ({ eras: [] }),
    // payer row (payerId + check window) or waterfall cell (serviceMonth + checkMonth)
    select: (detail, params) => {
      const eras = detail.eras
        .filter((era) =>
          params.checkMonth
            ? era.checkMonth === params.checkMonth
            : checkDayInRange(era.checkDate, params.dateFrom, params.dateTo)
        )
        .filter(
          (era) =>
            !params.payerId ||
            (params.payerId === NO_PAYER_SENTINEL ? era.payerId === '' : era.payerId === params.payerId)
        )
        // a waterfall cell only shows the claims whose DOS lands in its service month
        .map((era) =>
          params.serviceMonth
            ? { ...era, claims: era.claims.filter((claim) => claim.serviceMonth === params.serviceMonth) }
            : era
        )
        .filter((era) => era.claims.length > 0)
        .sort((a, b) => b.checkDate.localeCompare(a.checkDate));
      return { eras };
    },
  },
  summarize: (payload) => `payments report cached (${payload.rows.length} payers)`,
};

// Aggregates over posted ERAs: each PaymentReconciliation and its ClaimResponses roll up to the
// ERA's payer (paymentIssuer, else the ClaimResponses' insurer). Payer rows honor the check-date
// window; the waterfall matrix (DOS month × check month) and the drilldown detail span all ERAs.
async function computeInsurancePayments(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: ReportDateWindowParams
): Promise<{ rows: PaymentsReportPayerRow[]; waterfall: PaymentsReportWaterfallCell[]; detail: PaymentsReportDetail }> {
  const allEras = await fetchAllEras(eraReadClient);
  if (allEras.length === 0) return { rows: [], waterfall: [], detail: { eras: [] } };

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
  const detailEras: PaymentsReportDetailEra[] = [];
  for (const era of allEras) {
    const claimResponses = claimResponsesByPrId.get(era.id ?? '') ?? [];
    const checkMonth = eraCheckMonth(era);
    const inWindow = erasInWindow.has(era.id);

    const payerRefOfEra = eraPayerRef(era, claimResponses);
    const refPayerIdOfEra = payerIdFromRef(payerRefOfEra);
    const payerNameOfEra =
      (payerRefOfEra ? payersByRef.get(payerRefOfEra)?.name : undefined) ??
      harvestedNamesByRef.get(payerRefOfEra ?? '') ??
      eraReportedPayerName(claimResponses) ??
      era.paymentIssuer?.display ??
      (refPayerIdOfEra ? `Payer ${refPayerIdOfEra}` : UNKNOWN_PAYER_NAME);

    let row: PaymentsReportPayerRow | undefined;
    if (inWindow) {
      const payer = payerRefOfEra ? payersByRef.get(payerRefOfEra) : undefined;
      const key = payerRefOfEra ?? 'unknown';

      row = rowsByPayerKey.get(key);
      if (!row) {
        row = {
          payerId: getPayerId(payer) ?? refPayerIdOfEra ?? '',
          payerName: payerNameOfEra,
          eraCount: 0,
          claimCount: 0,
          billed: 0,
          allowed: 0,
          insurancePaid: 0,
          patientResp: 0,
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
        row.patientResp += amounts.patientResp ?? 0;
      }

      const serviceDay = claimResponseServiceDay(claimResponse, partialClaimsById);
      const serviceMonth = toMonth(serviceDay ?? undefined) ?? WATERFALL_UNKNOWN_MONTH;
      const matrixKey = `${serviceMonth}|${checkMonth}`;
      paidByMatrixKey.set(matrixKey, (paidByMatrixKey.get(matrixKey) ?? 0) + amounts.paid);
    }

    // drilldown detail entry (window-independent)
    detailEras.push({
      id: era.id ?? '',
      checkNumber: getEraCheckNumber(era) ?? '',
      checkDate: era.paymentDate ?? era.created ?? '',
      checkMonth,
      payerId: refPayerIdOfEra ?? '',
      payerName: payerNameOfEra,
      checkAmount: era.paymentAmount?.value ?? 0,
      claims: sortClaimResponsesByRecency(claimResponses).map((claimResponse) => {
        const amounts = extractClaimResponseAmounts(claimResponse);
        const claimId = claimResponseClaimId(claimResponse);
        const matchedClaim = claimId ? partialClaimsById.get(claimId) : undefined;
        const containedPatient = claimResponse.contained?.find(
          (resource): resource is Patient => resource.resourceType === 'Patient'
        );
        const dos = claimResponseServiceDay(claimResponse, partialClaimsById) ?? '';
        return {
          patientName: fhirName(containedPatient),
          pcn: eraPatientAccountNumber([claimResponse], matchedClaim, !!matchedClaim),
          dos,
          serviceMonth: toMonth(dos || undefined) ?? WATERFALL_UNKNOWN_MONTH,
          billed: extractReportedCharge(claimResponse) ?? 0,
          allowed: amounts.allowed ?? 0,
          paid: amounts.paid,
          patientResp: amounts.patientResp ?? 0,
        };
      }),
    });
  }

  const rows = [...rowsByPayerKey.values()]
    .map((row) => ({
      ...row,
      billed: roundNumberToDecimalPlaces(row.billed, 2),
      allowed: roundNumberToDecimalPlaces(row.allowed, 2),
      insurancePaid: roundNumberToDecimalPlaces(row.insurancePaid, 2),
      patientResp: roundNumberToDecimalPlaces(row.patientResp, 2),
      checkTotal: roundNumberToDecimalPlaces(row.checkTotal, 2),
    }))
    .sort((a, b) => b.insurancePaid - a.insurancePaid || b.checkTotal - a.checkTotal);

  const waterfall = [...paidByMatrixKey.entries()]
    .map(([matrixKey, paid]) => {
      const [serviceMonth, checkMonth] = matrixKey.split('|');
      return { serviceMonth, checkMonth, paid: roundNumberToDecimalPlaces(paid, 2) };
    })
    .sort((a, b) => a.serviceMonth.localeCompare(b.serviceMonth) || a.checkMonth.localeCompare(b.checkMonth));

  return { rows, waterfall, detail: { eras: detailEras } };
}

export function totalsOf(rows: PaymentsReportPayerRow[]): GetBillingPaymentsReportResponse['totals'] {
  const totals = rows.reduce(
    (acc, row) => ({
      eraCount: acc.eraCount + row.eraCount,
      claimCount: acc.claimCount + row.claimCount,
      billed: acc.billed + row.billed,
      allowed: acc.allowed + row.allowed,
      insurancePaid: acc.insurancePaid + row.insurancePaid,
      patientResp: acc.patientResp + row.patientResp,
      checkTotal: acc.checkTotal + row.checkTotal,
    }),
    { eraCount: 0, claimCount: 0, billed: 0, allowed: 0, insurancePaid: 0, patientResp: 0, checkTotal: 0 }
  );
  return {
    ...totals,
    billed: roundNumberToDecimalPlaces(totals.billed, 2),
    allowed: roundNumberToDecimalPlaces(totals.allowed, 2),
    insurancePaid: roundNumberToDecimalPlaces(totals.insurancePaid, 2),
    patientResp: roundNumberToDecimalPlaces(totals.patientResp, 2),
    checkTotal: roundNumberToDecimalPlaces(totals.checkTotal, 2),
  };
}

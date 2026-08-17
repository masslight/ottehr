import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, MeasureReport, PaymentReconciliation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getPayerId } from 'utils/lib/helpers/helpers';
import {
  GetBillingPaymentsReportResponse,
  PaymentsReportPayerRow,
  PaymentsReportWaterfallCell,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { fetchAllPages } from '../../../shared/fhir';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import {
  extractClaimResponseAmounts,
  extractReportedCharge,
  fetchClaimResponsesByPaymentReconciliations,
} from '../../claim-amounts';
import { createBillingClient, createEraReadClient, resolvePayersByRef } from '../../shared';
import { GetBillingPaymentsReportParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-payments-report';

export const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
export const PAYMENTS_REPORT_NAME = 'payments-by-payer';
// bump when the cached MeasureReport shape changes, so stale-shape resources are never reused
export const PAYMENTS_REPORT_CACHE_VERSION = 'v3';
// canonical for the cached MeasureReport's required `measure` element; no Measure resource exists yet
export const PAYMENTS_REPORT_MEASURE_URL = 'https://fhir.ottehr.com/billing/measures/payments-by-payer';
export const REPORT_CACHE_TTL_MINUTES = 60;

const UNKNOWN_PAYER_NAME = 'Unknown Payer';
const METRIC_KEYS = ['billed', 'allowed', 'insurancePaid', 'checkTotal'] as const;
const ERA_PAGE_SIZE = 200;
const CLAIM_BATCH_SIZE = 100;

export const WATERFALL_UNKNOWN_MONTH = 'unknown';
// marker group inside the cached MeasureReport, distinguishing waterfall data from payer groups
const WATERFALL_GROUP_CODE = '__payment-waterfall-matrix__';

const toDay = (value?: string): string | null =>
  value ? DateTime.fromISO(value, { setZone: true }).toISODate() : null;

const toMonth = (value?: string): string | null => toDay(value)?.slice(0, 7) ?? null;

export function checkDateInRange(era: PaymentReconciliation, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const day = toDay(era.paymentDate ?? era.created);
  if (!day) return false;
  const fromDay = toDay(from);
  const toDayValue = toDay(to);
  if (fromDay && day < fromDay) return false;
  if (toDayValue && day > toDayValue) return false;
  return true;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const eraReadClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, eraReadClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: GetBillingPaymentsReportParams
): Promise<GetBillingPaymentsReportResponse> {
  const cacheKey = reportCacheKey(params);

  const cached = await findCachedReport(oystehr, cacheKey);
  if (cached && !params.refresh && isCacheFresh(cached)) {
    const rows = rowsFromMeasureReport(cached);
    return {
      rows,
      totals: totalsOf(rows),
      waterfall: waterfallFromMeasureReport(cached),
      generatedAt: cached.date ?? '',
      fromCache: true,
    };
  }

  const { rows, waterfall } = await computeInsurancePayments(oystehr, eraReadClient, params);
  const generatedAt = DateTime.now().toUTC().toISO();

  await saveCachedReport(oystehr, { cacheKey, rows, waterfall, generatedAt, params, existing: cached });

  return {
    rows,
    totals: totalsOf(rows),
    waterfall,
    generatedAt,
    fromCache: false,
  };
}

export function reportCacheKey(params: { dateFrom?: string; dateTo?: string }): string {
  return `${PAYMENTS_REPORT_NAME}:${PAYMENTS_REPORT_CACHE_VERSION}:${params.dateFrom ?? 'all'}:${
    params.dateTo ?? 'all'
  }`;
}

function isCacheFresh(report: MeasureReport): boolean {
  if (!report.date) return false;
  const age = DateTime.now().diff(DateTime.fromISO(report.date), 'minutes').minutes;
  return age >= 0 && age < REPORT_CACHE_TTL_MINUTES;
}

async function findCachedReport(oystehr: Oystehr, cacheKey: string): Promise<MeasureReport | undefined> {
  const bundle = await oystehr.fhir.search<MeasureReport>({
    resourceType: 'MeasureReport',
    params: [
      { name: 'identifier', value: `${REPORT_IDENTIFIER_SYSTEM}|${cacheKey}` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle()[0];
}

// Aggregates over posted ERAs: each PaymentReconciliation and its ClaimResponses roll up to the
// ERA's payer (paymentIssuer, else the ClaimResponses' insurer). Payer rows honor the check-date
// window; the waterfall matrix (DOS month × check month) always spans all ERAs.
async function computeInsurancePayments(
  oystehr: Oystehr,
  eraReadClient: Oystehr,
  params: { dateFrom?: string; dateTo?: string }
): Promise<{ rows: PaymentsReportPayerRow[]; waterfall: PaymentsReportWaterfallCell[] }> {
  const allEras: PaymentReconciliation[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await eraReadClient.fhir.search<PaymentReconciliation>({
      resourceType: 'PaymentReconciliation',
      params: [
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    allEras.push(...bundle.unbundle());
    return bundle;
  }, ERA_PAGE_SIZE);
  if (allEras.length === 0) return { rows: [], waterfall: [] };

  const claimResponsesByPrId = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, allEras);
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  // process-era PaymentReconciliations carry no paymentIssuer; fall back to the ClaimResponses' payer
  const [payersByRef, serviceDayByClaimId] = await Promise.all([
    resolvePayersByRef(oystehr, [
      ...allEras.map((pr) => pr.paymentIssuer?.reference),
      ...allClaimResponses.map((cr) => cr.insurer?.reference),
    ]),
    fetchClaimServiceDays(
      oystehr,
      allClaimResponses.map((cr) => cr.request?.reference?.replace('Claim/', '')).filter(Boolean) as string[]
    ),
  ]);

  // no FHIR search parameter exists for paymentDate, so the check-date window filters in memory
  const erasInWindow = new Set(
    allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo)).map((era) => era.id)
  );

  const rowsByPayerKey = new Map<string, PaymentsReportPayerRow>();
  const paidByMatrixKey = new Map<string, number>();
  for (const era of allEras) {
    const claimResponses = claimResponsesByPrId.get(era.id ?? '') ?? [];
    const checkMonth = toMonth(era.paymentDate ?? era.created) ?? WATERFALL_UNKNOWN_MONTH;
    const inWindow = erasInWindow.has(era.id);

    let row: PaymentsReportPayerRow | undefined;
    if (inWindow) {
      const payerRef =
        era.paymentIssuer?.reference ?? claimResponses.find((cr) => cr.insurer?.reference)?.insurer?.reference;
      const payer = payerRef ? payersByRef.get(payerRef) : undefined;
      const key = payerRef ?? 'unknown';

      row = rowsByPayerKey.get(key);
      if (!row) {
        row = {
          payerId: getPayerId(payer) ?? '',
          payerName: payer?.name ?? era.paymentIssuer?.display ?? UNKNOWN_PAYER_NAME,
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

      const claimId = claimResponse.request?.reference?.replace('Claim/', '');
      const serviceMonth = (claimId ? toMonth(serviceDayByClaimId.get(claimId)) : null) ?? WATERFALL_UNKNOWN_MONTH;
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

// Claim service dates for lag bucketing; Claims live in the billing FHIR store.
async function fetchClaimServiceDays(oystehr: Oystehr, claimIds: string[]): Promise<Map<string, string>> {
  const serviceDayByClaimId = new Map<string, string>();
  // unmatched ERA ClaimResponses carry logical/identifier request references, not Claim/{uuid}
  const uniqueIds = [...new Set(claimIds)].filter(isValidUUID);
  for (let i = 0; i < uniqueIds.length; i += CLAIM_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + CLAIM_BATCH_SIZE);
    const bundle = await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_elements', value: 'id,item,created' },
        { name: '_count', value: String(batch.length) },
      ],
    });
    for (const claim of bundle.unbundle()) {
      const day = toDay(claim.item?.[0]?.servicedPeriod?.start ?? claim.item?.[0]?.servicedDate ?? claim.created);
      if (claim.id && day) serviceDayByClaimId.set(claim.id, day);
    }
  }
  return serviceDayByClaimId;
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

// Each payer becomes a MeasureReport.group: ERA/claim counts in populations, dollar metrics as
// strata. The waterfall matrix rides along as one marker group (stratum per DOS×check month cell).
export function measureReportFromRows(input: {
  cacheKey: string;
  rows: PaymentsReportPayerRow[];
  waterfall: PaymentsReportWaterfallCell[];
  generatedAt: string;
  params: { dateFrom?: string; dateTo?: string };
}): MeasureReport {
  const { cacheKey, rows, waterfall, generatedAt, params } = input;
  return {
    resourceType: 'MeasureReport',
    status: 'complete',
    type: 'summary',
    measure: PAYMENTS_REPORT_MEASURE_URL,
    identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: cacheKey }],
    date: generatedAt,
    period: {
      ...(params.dateFrom ? { start: params.dateFrom } : {}),
      ...(params.dateTo ? { end: params.dateTo } : {}),
    },
    group: [
      ...rows.map((row) => ({
        code: {
          text: row.payerName,
          ...(row.payerId ? { coding: [{ system: REPORT_IDENTIFIER_SYSTEM, code: row.payerId }] } : {}),
        },
        population: [
          { code: { text: 'claims' }, count: row.claimCount },
          { code: { text: 'eras' }, count: row.eraCount },
        ],
        stratifier: [
          {
            stratum: METRIC_KEYS.map((key) => ({
              value: { text: key },
              measureScore: { value: row[key] },
            })),
          },
        ],
      })),
      {
        code: { text: WATERFALL_GROUP_CODE },
        stratifier: [
          {
            stratum: waterfall.map((cell) => ({
              value: { text: `${cell.serviceMonth}|${cell.checkMonth}` },
              measureScore: { value: cell.paid },
            })),
          },
        ],
      },
    ],
  };
}

export function rowsFromMeasureReport(report: MeasureReport): PaymentsReportPayerRow[] {
  return (report.group ?? [])
    .filter((group) => group.code?.text !== WATERFALL_GROUP_CODE)
    .map((group) => {
      const metrics = new Map(
        (group.stratifier?.[0]?.stratum ?? []).map((stratum) => [
          stratum.value?.text ?? '',
          stratum.measureScore?.value ?? 0,
        ])
      );
      const populationCount = (text: string): number =>
        group.population?.find((p) => p.code?.text === text)?.count ?? 0;
      return {
        payerId: group.code?.coding?.[0]?.code ?? '',
        payerName: group.code?.text ?? '',
        eraCount: populationCount('eras'),
        claimCount: populationCount('claims'),
        billed: metrics.get('billed') ?? 0,
        allowed: metrics.get('allowed') ?? 0,
        insurancePaid: metrics.get('insurancePaid') ?? 0,
        checkTotal: metrics.get('checkTotal') ?? 0,
      };
    });
}

export function waterfallFromMeasureReport(report: MeasureReport): PaymentsReportWaterfallCell[] {
  const group = (report.group ?? []).find((g) => g.code?.text === WATERFALL_GROUP_CODE);
  return (group?.stratifier?.[0]?.stratum ?? []).map((stratum) => {
    const [serviceMonth = WATERFALL_UNKNOWN_MONTH, checkMonth = WATERFALL_UNKNOWN_MONTH] = (
      stratum.value?.text ?? ''
    ).split('|');
    return {
      serviceMonth,
      checkMonth,
      paid: stratum.measureScore?.value ?? 0,
    };
  });
}

async function saveCachedReport(
  oystehr: Oystehr,
  input: {
    cacheKey: string;
    rows: PaymentsReportPayerRow[];
    waterfall: PaymentsReportWaterfallCell[];
    generatedAt: string;
    params: { dateFrom?: string; dateTo?: string };
    existing: MeasureReport | undefined;
  }
): Promise<void> {
  const report = measureReportFromRows(input);
  try {
    if (input.existing?.id) {
      await oystehr.fhir.update<MeasureReport>({ ...report, id: input.existing.id });
    } else {
      await oystehr.fhir.create<MeasureReport>(report);
    }
  } catch (err) {
    // the cache is an optimization; a failed write must not fail the report
    console.error('Failed to cache payments report MeasureReport:', err);
  }
}

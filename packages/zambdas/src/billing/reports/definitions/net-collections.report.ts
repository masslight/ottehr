import Oystehr from '@oystehr/sdk';
import { ClaimResponse, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  NetCollectionsDrilldownParams,
  NetCollectionsDrilldownParamsSchema,
  ReportDateWindowParams,
  ReportDateWindowParamsSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingNetCollectionsReportResponse,
  NetCollectionsBucket,
  NetCollectionsDetailEra,
  NetCollectionsMonthlyPoint,
  NetCollectionsPayerRow,
  NetCollectionsReportDetail,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import {
  extractClaimResponseAmounts,
  fetchClaimResponsesByPaymentReconciliations,
  isMatchedToClaim,
  sortClaimResponsesByRecency,
} from '../../claim-amounts';
import { eraPatientAccountNumber } from '../../era-remits';
import { fhirName, getEraCheckNumber, resolvedPayerId, resolvePayersByRef } from '../../shared';
import { ReportDefinition } from '../framework/types';
import {
  checkDateInRange,
  claimResponseClaimId,
  claimResponseServiceDay,
  eraCheckMonth,
  eraPayerRef,
  eraReportedPayerId,
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
export const netCollectionsReport: ReportDefinition<
  ReportDateWindowParams,
  NetCollectionsPayload,
  NetCollectionsReportDetail,
  NetCollectionsDrilldownParams
> = {
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

    const patientRespTotal = insurance.totals.patientResp;
    const insuranceExpectedTotal = insurance.totals.insuranceExpected;
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
      overall: roundBucket({ collected: paidTotal + patient.net, expected: insuranceExpectedTotal + patientRespTotal }),
      insurance: roundBucket({ collected: paidTotal, expected: insuranceExpectedTotal }),
      patient: roundBucket({ collected: patient.net, expected: patientRespTotal }),
      payerRows: insurance.payerRows,
      monthly,
      generatedAt: DateTime.now().toUTC().toISO() ?? '',
    };
    return { payload, detail: insurance.detail };
  },
  drilldown: {
    paramsSchema: NetCollectionsDrilldownParamsSchema,
    empty: () => ({ eras: [] }),
    select: (detail, params) => ({
      eras: detail.eras
        .filter((era) => era.payerKey === params.payerKey)
        .sort((a, b) => b.checkDate.localeCompare(a.checkDate)),
    }),
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
): Promise<{
  payerRows: NetCollectionsPayerRow[];
  byMonth: Map<string, InsuranceMonth>;
  matched: MatchedClaimKeys;
  detail: NetCollectionsReportDetail;
  // claim-chain telescoped: expected shares retired in the window + final patient responsibility
  totals: { insuranceExpected: number; patientResp: number };
}> {
  const allEras = await fetchAllEras(eraReadClient);
  const eras = allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo));
  if (allEras.length === 0)
    return {
      payerRows: [],
      byMonth: new Map(),
      matched: emptyMatched(),
      detail: { eras: [] },
      totals: { insuranceExpected: 0, patientResp: 0 },
    };

  // ClaimResponses come from ALL posted ERAs: the patient-side eligibility set and each claim's
  // adjudication history are window-independent; only the rollup below is window-scoped
  const fetched = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, allEras);
  const claimResponsesByPrId = new Map(
    [...fetched].map(([prId, claimResponses]) => [prId, claimResponses.filter(isMatchedToClaim)])
  );
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  const harvestedNamesByRef = payerNamesByRef(allClaimResponses);
  const matchedClaimIds = [...new Set(allClaimResponses.map(claimResponseClaimId).filter((id): id is string => !!id))];
  const historyByClaimId = new Map<string, ClaimResponse[]>();
  for (const claimResponse of allClaimResponses) {
    const claimId = claimResponseClaimId(claimResponse);
    if (claimId) historyByClaimId.set(claimId, [...(historyByClaimId.get(claimId) ?? []), claimResponse]);
  }
  const [payersByRef, partialClaimsById] = await Promise.all([
    resolvePayersByRef(oystehr, [
      ...eras.map((pr) => pr.paymentIssuer?.reference),
      ...allClaimResponses.map((cr) => cr.insurer?.reference),
    ]),
    fetchPartialClaimsById(oystehr, matchedClaimIds),
  ]);

  const rowsByPayerKey = new Map<string, NetCollectionsPayerRow>();
  const byMonth = new Map<string, InsuranceMonth>();
  const detailEras: NetCollectionsDetailEra[] = [];
  // per-CR attribution targets so claim-level denominators can land on the final adjudication
  const rowByEraId = new Map<string, NetCollectionsPayerRow>();
  const monthByEraId = new Map<string, InsuranceMonth>();
  const detailEraByEraId = new Map<string, NetCollectionsDetailEra>();
  const lineByCr = new Map<ClaimResponse, NetCollectionsDetailEra['claims'][number]>();
  const eraIdByCr = new Map<ClaimResponse, string>();
  const crsByClaimId = new Map<string, ClaimResponse[]>();
  for (const era of eras) {
    const claimResponses = claimResponsesByPrId.get(era.id ?? '') ?? [];
    if (claimResponses.length === 0) continue;
    const payerRefOfEra = eraPayerRef(era, claimResponses);
    const refPayerIdOfEra = payerIdFromRef(payerRefOfEra);
    const payer = payerRefOfEra ? payersByRef.get(payerRefOfEra) : undefined;
    // ERA-carried identity wins: duplicate Organizations referencing the same payer must not
    // split it into multiple rows
    const payerId = eraReportedPayerId(claimResponses) ?? refPayerIdOfEra ?? resolvedPayerId(payer) ?? '';
    const payerName =
      eraReportedPayerName(claimResponses) ??
      era.paymentIssuer?.display ??
      payer?.name ??
      harvestedNamesByRef.get(payerRefOfEra ?? '') ??
      (payerId ? `Payer ${payerId}` : UNKNOWN_PAYER_NAME);

    const key = `${payerId}|${payerName}`;
    let row = rowsByPayerKey.get(key);
    if (!row) {
      row = {
        payerId,
        payerName,
        payerKey: key,
        claimCount: 0,
        allowed: 0,
        patientResp: 0,
        expected: 0,
        paid: 0,
      };
      rowsByPayerKey.set(key, row);
    }
    rowByEraId.set(era.id ?? '', row);

    const detailEra: NetCollectionsDetailEra = {
      id: era.id ?? '',
      checkNumber: getEraCheckNumber(era) ?? '',
      checkDate: era.paymentDate ?? era.created ?? '',
      payerKey: row.payerKey,
      payerName,
      checkAmount: era.paymentAmount?.value ?? 0,
      allowed: 0,
      patientResp: 0,
      paid: 0,
      claims: [],
    };
    detailEras.push(detailEra);
    detailEraByEraId.set(era.id ?? '', detailEra);

    const checkMonth = eraCheckMonth(era);
    let month = byMonth.get(checkMonth);
    if (!month && checkMonth !== WATERFALL_UNKNOWN_MONTH) {
      month = { insurance: emptyBucket(), patientResp: 0 };
      byMonth.set(checkMonth, month);
    }
    if (month) monthByEraId.set(era.id ?? '', month);

    // collected is cash-basis: each adjudication's paid stays on its own ERA/payer/month
    for (const claimResponse of sortClaimResponsesByRecency(claimResponses)) {
      const amounts = extractClaimResponseAmounts(claimResponse);
      row.paid += amounts.paid;
      if (month) month.insurance.collected += amounts.paid;
      detailEra.paid = round(detailEra.paid + amounts.paid);

      const claimId = claimResponseClaimId(claimResponse);
      const matchedClaim = claimId ? partialClaimsById.get(claimId) : undefined;
      const containedPatient = claimResponse.contained?.find(
        (resource): resource is Patient => resource.resourceType === 'Patient'
      );
      const line = {
        patientName: fhirName(containedPatient),
        pcn: eraPatientAccountNumber([claimResponse], matchedClaim, !!matchedClaim),
        dos: claimResponseServiceDay(claimResponse, partialClaimsById) ?? '',
        allowed: 0,
        patientResp: 0,
        paid: round(amounts.paid),
      };
      detailEra.claims.push(line);
      lineByCr.set(claimResponse, line);
      eraIdByCr.set(claimResponse, era.id ?? '');
      const groupKey = claimId ?? claimResponse.id ?? '';
      crsByClaimId.set(groupKey, [...(crsByClaimId.get(groupKey) ?? []), claimResponse]);
    }
  }

  // Denominators telescope through each claim's adjudication chain: every remit's expected share
  // is the outstanding balance it retired (basis − the patient responsibility it left), so a
  // COB claim's expectation splits across the payers that actually adjudicated it. Out-of-window
  // remits only advance the running balance, so a window that catches only a later remit still
  // knows its basis.
  let insuranceExpectedTotal = 0;
  let patientRespTotal = 0;
  for (const [claimId, claimResponses] of crsByClaimId) {
    const ordered = sortClaimResponsesByRecency(claimResponses);
    const finalCr = ordered[ordered.length - 1];
    const seen = new Set<unknown>(ordered.map((cr) => cr.id ?? cr));
    const merged = sortClaimResponsesByRecency([
      ...ordered,
      ...(historyByClaimId.get(claimId) ?? []).filter((cr) => !seen.has(cr.id ?? cr)),
    ]);
    const history = merged.slice(0, merged.indexOf(finalCr) + 1);

    let outstanding = 0;
    let knownAllowed = 0;
    const countedRows = new Set<NetCollectionsPayerRow>();
    for (const claimResponse of history) {
      const amounts = extractClaimResponseAmounts(claimResponse);
      if (amounts.allowed !== undefined && amounts.allowed !== knownAllowed) {
        outstanding += amounts.allowed - knownAllowed;
        knownAllowed = amounts.allowed;
      }
      const basis = outstanding;
      // no CAS data falls back to basis-but-unpaid, floored — coalescing to 0 would count the
      // whole basis as insurance-collectible
      const stepPatientResp = Math.max(amounts.patientResp ?? basis - amounts.paid, 0);
      outstanding = stepPatientResp;

      const eraId = eraIdByCr.get(claimResponse);
      if (eraId === undefined) continue;
      insuranceExpectedTotal += basis - stepPatientResp;
      const row = rowByEraId.get(eraId);
      if (row) {
        if (!countedRows.has(row)) {
          countedRows.add(row);
          row.claimCount += 1;
        }
        row.allowed += basis;
        row.patientResp += stepPatientResp;
      }
      const month = monthByEraId.get(eraId);
      if (month) month.insurance.expected += basis - stepPatientResp;
      const detailEra = detailEraByEraId.get(eraId);
      if (detailEra) {
        detailEra.allowed = round(detailEra.allowed + basis);
        detailEra.patientResp = round(detailEra.patientResp + stepPatientResp);
      }
      const line = lineByCr.get(claimResponse);
      if (line) {
        line.allowed = round(basis);
        line.patientResp = round(stepPatientResp);
      }
    }

    // the patient owes what the final adjudication left outstanding
    patientRespTotal += outstanding;
    const finalMonth = monthByEraId.get(eraIdByCr.get(finalCr) ?? '');
    if (finalMonth) finalMonth.patientResp += outstanding;
  }

  const rateOf = (row: NetCollectionsPayerRow): number | null => (row.expected > 0 ? row.paid / row.expected : null);
  const payerRows = [...rowsByPayerKey.values()]
    .map((row) => ({
      ...row,
      allowed: round(row.allowed),
      patientResp: round(row.patientResp),
      expected: round(row.allowed - row.patientResp),
      paid: round(row.paid),
    }))
    // highest NCR first; rate-less rows follow, by paid amount
    .sort((a, b) => {
      const rateA = rateOf(a);
      const rateB = rateOf(b);
      if (rateA !== null && rateB !== null) return rateB - rateA || b.expected - a.expected;
      if (rateA !== null || rateB !== null) return rateA !== null ? -1 : 1;
      return b.paid - a.paid;
    });
  return {
    payerRows,
    byMonth,
    matched: matchedClaimKeysOf(matchedClaimIds, partialClaimsById),
    detail: { eras: detailEras },
    totals: { insuranceExpected: insuranceExpectedTotal, patientResp: patientRespTotal },
  };
}

// Claim ids adjudicated by the windowed ERAs plus their encounter ids (the claim-encounter-id
// identifier) — the keys patient payments link back through.
function matchedClaimKeysOf(
  matchedClaimIds: string[],
  claimsById: Awaited<ReturnType<typeof fetchPartialClaimsById>>
): MatchedClaimKeys {
  const encounterSystem = ottehrIdentifierSystem('claim-encounter-id');
  const encounterIds = new Set(
    [...claimsById.values()]
      .map((claim) => claim.identifier?.find((identifier) => identifier.system === encounterSystem)?.value)
      .filter((id): id is string => !!id)
  );
  return { claimIds: new Set(matchedClaimIds), encounterIds };
}

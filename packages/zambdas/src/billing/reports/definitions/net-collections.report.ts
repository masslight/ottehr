import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getPayerId } from 'utils/lib/helpers/helpers';
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
    return { payload, detail: insurance.detail };
  },
  drilldown: {
    paramsSchema: NetCollectionsDrilldownParamsSchema,
    empty: () => ({ eras: [] }),
    select: (detail, params) => ({
      eras: detail.eras
        .filter((era) => (params.payerId === 'none' ? era.payerId === '' : era.payerId === params.payerId))
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
}> {
  const allEras = await fetchAllEras(eraReadClient);
  const eras = allEras.filter((era) => checkDateInRange(era, params.dateFrom, params.dateTo));
  if (eras.length === 0) return { payerRows: [], byMonth: new Map(), matched: emptyMatched(), detail: { eras: [] } };

  const fetched = await fetchClaimResponsesByPaymentReconciliations(eraReadClient, eras);
  const claimResponsesByPrId = new Map(
    [...fetched].map(([prId, claimResponses]) => [prId, claimResponses.filter(isMatchedToClaim)])
  );
  const allClaimResponses = [...claimResponsesByPrId.values()].flat();
  const harvestedNamesByRef = payerNamesByRef(allClaimResponses);
  const matchedClaimIds = [...new Set(allClaimResponses.map(claimResponseClaimId).filter((id): id is string => !!id))];
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

    const detailEra: NetCollectionsDetailEra = {
      id: era.id ?? '',
      checkNumber: getEraCheckNumber(era) ?? '',
      checkDate: era.paymentDate ?? era.created ?? '',
      payerId: row.payerId,
      payerName,
      checkAmount: era.paymentAmount?.value ?? 0,
      allowed: 0,
      patientResp: 0,
      paid: 0,
      claims: [],
    };
    detailEras.push(detailEra);

    const checkMonth = eraCheckMonth(era);
    let month = byMonth.get(checkMonth);
    if (!month && checkMonth !== WATERFALL_UNKNOWN_MONTH) {
      month = { insurance: emptyBucket(), patientResp: 0 };
      byMonth.set(checkMonth, month);
    }

    for (const claimResponse of sortClaimResponsesByRecency(claimResponses)) {
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

      const claimId = claimResponseClaimId(claimResponse);
      const matchedClaim = claimId ? partialClaimsById.get(claimId) : undefined;
      const containedPatient = claimResponse.contained?.find(
        (resource): resource is Patient => resource.resourceType === 'Patient'
      );
      detailEra.allowed = round(detailEra.allowed + allowed);
      detailEra.patientResp = round(detailEra.patientResp + patientResp);
      detailEra.paid = round(detailEra.paid + amounts.paid);
      detailEra.claims.push({
        patientName: fhirName(containedPatient),
        pcn: eraPatientAccountNumber([claimResponse], matchedClaim, !!matchedClaim),
        dos: claimResponseServiceDay(claimResponse, partialClaimsById) ?? '',
        allowed: round(allowed),
        patientResp: round(patientResp),
        paid: round(amounts.paid),
      });
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
  return {
    payerRows,
    byMonth,
    matched: matchedClaimKeysOf(matchedClaimIds, partialClaimsById),
    detail: { eras: detailEras },
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

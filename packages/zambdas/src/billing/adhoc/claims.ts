import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Organization, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { isPayerUrl } from 'utils/lib/helpers/helpers';
import { AdHocBillingClaimsInput, AdHocBillingClaimsRow } from 'utils/lib/types/adhoc/datasets/billing-claims';
import { CLAIM_STATUS_DATE_EXTENSION_URLS } from 'utils/lib/types/data/billing/claim-status';
import { writeOffReasonLabel } from 'utils/lib/types/data/billing/write-off-reasons';
import { extractClaimResponseAmounts, extractRemitAdjustments, sortClaimResponsesByRecency } from '../claim-amounts';
import {
  buildClaimLookups,
  ClaimLookups,
  claimMatchesServiceDateRange,
  fetchClaimsPageByIds,
  getClaimServiceDate,
  mapClaimToItem,
  scanClaimIds,
} from '../claim-search';
import { resolvePayersByRef } from '../shared';
import { writeOffFromPaymentNotice } from '../write-offs';

const PAGE_SIZE = 100;
const PAGE_CONCURRENCY = 3;
const EXTRA_CLAIM_ELEMENTS = ['Claim.diagnosis', 'Claim.extension'];
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
export const ADHOC_CLAIMS_BUILD_BUDGET_MS = 12 * 60 * 1000;
export const ADHOC_CLAIMS_OVER_BUDGET_MESSAGE = 'Too many claims for one run — narrow the date range';

interface LayerFlags {
  codes: boolean;
  writeOffs: boolean;
  remits: boolean;
  timeline: boolean;
}

export async function fetchAdHocClaimRows(
  oystehr: Oystehr,
  input: AdHocBillingClaimsInput
): Promise<AdHocBillingClaimsRow[]> {
  const flags: LayerFlags = {
    codes: !!input.includeCodes,
    writeOffs: !!input.includeWriteOffs,
    remits: !!input.includeRemits,
    timeline: !!input.includeTimeline,
  };

  const startedAt = Date.now();
  const deadline = startedAt + ADHOC_CLAIMS_BUILD_BUDGET_MS;
  const scan = await scanAllClaims(oystehr);

  const claimIds = scan.claims
    .filter((claim) => claimMatchesServiceDateRange(claim, input.dateRange.start, input.dateRange.end))
    .map((claim) => claim.id);

  console.log(
    `[adhoc-billing] claims scanned=${scan.claims.length} inRange=${claimIds.length} ms=${Date.now() - startedAt}`
  );

  const payers = createPayerResolver(oystehr);
  const pages: string[][] = [];

  for (let i = 0; i < claimIds.length; i += PAGE_SIZE) pages.push(claimIds.slice(i, i + PAGE_SIZE));

  const rows: AdHocBillingClaimsRow[] = [];

  for (let i = 0; i < pages.length; i += PAGE_CONCURRENCY) {
    if (Date.now() > deadline) throw new Error(ADHOC_CLAIMS_OVER_BUDGET_MESSAGE);
    const group = await Promise.all(
      pages.slice(i, i + PAGE_CONCURRENCY).map(async (ids) => {
        const page = await fetchClaimsPageByIds({ oystehr, claimIds: ids, extraElements: EXTRA_CLAIM_ELEMENTS });

        const lookups = await buildClaimLookups({
          oystehr,
          claims: page.claims,
          includedResources: page.includedResources,
          payersByRef: await payers.resolve(page.claims.map((claim) => claim.insurer?.reference)),
        });

        if (flags.remits) {
          const remitPayers = await payers.resolve(
            [...lookups.claimResponsesByClaimId.values()]
              .flat()
              .map((claimResponse) => claimResponse.insurer?.reference)
          );
          remitPayers.forEach((payer, ref) => lookups.payersByRef.set(ref, payer));
        }

        return page.claims.map((claim) => mapClaimToAdHocRow(claim, lookups, flags));
      })
    );

    group.forEach((pageRows) => rows.push(...pageRows));

    const done = Math.min(i + PAGE_CONCURRENCY, pages.length);

    if (done === pages.length || Math.floor(done / 10) > Math.floor(i / 10)) {
      console.log(`[adhoc-billing] page ${done}/${pages.length} rows=${rows.length} ms=${Date.now() - startedAt}`);
    }
  }

  const unresolved = payers.unresolvedCount();
  if (unresolved > 0) {
    console.warn(`[adhoc-billing] ${unresolved} payer reference(s) could not be resolved; their payerName is ""`);
  }

  return rows;
}

async function scanAllClaims(oystehr: Oystehr): Promise<Awaited<ReturnType<typeof scanClaimIds>>> {
  const scanOnce = (): ReturnType<typeof scanClaimIds> =>
    scanClaimIds({
      oystehr,
      params: [{ name: '_sort', value: '_id' }],
      maxMatches: Number.MAX_SAFE_INTEGER,
      withServiceDate: true,
    });

  const first = await scanOnce();

  if (!first.incomplete) return first;

  console.warn(`[adhoc-billing] claim scan ended short after ${first.claims.length} claims; scanning again`);

  const second = await scanOnce();

  if (second.incomplete) {
    throw new Error(`Claim scan stopped after ${second.claims.length} claims, short of the total, twice`);
  }

  return second;
}

function createPayerResolver(oystehr: Oystehr): {
  resolve: (refs: (string | undefined)[]) => Promise<Map<string, Organization>>;
  unresolvedCount: () => number;
} {
  const cache = new Map<string, Promise<Organization | undefined>>();
  const failed = new Set<string>();

  return {
    async resolve(refs) {
      const unique = [...new Set(refs.filter((ref): ref is string => !!ref && isResolvablePayerRef(ref)))];

      for (const ref of unique) {
        if (cache.has(ref)) continue;

        cache.set(
          ref,
          resolvePayersByRef(oystehr, [ref]).then((byRef) => {
            const payer = byRef.get(ref);
            if (!payer) failed.add(ref);
            return payer;
          })
        );
      }

      const byRef = new Map<string, Organization>();

      await Promise.all(
        unique.map(async (ref) => {
          const payer = await cache.get(ref);
          if (payer) byRef.set(ref, payer);
        })
      );

      return byRef;
    },
    unresolvedCount: () => failed.size,
  };
}

const isResolvablePayerRef = (ref: string): boolean => isPayerUrl(ref) || ref.startsWith('Organization/');

const toYmd = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = DateTime.fromISO(value, { setZone: true });
  return date.isValid ? date.toISODate() : null;
};

export function mapClaimToAdHocRow(claim: Claim, lookups: ClaimLookups, flags: LayerFlags): AdHocBillingClaimsRow {
  const item = mapClaimToItem(claim, lookups);
  const { statuses } = item;

  const row: AdHocBillingClaimsRow = {
    claimId: item.id,
    encounterId: claim.identifier?.find((identifier) => identifier.system === CLAIM_ENCOUNTER_ID_SYSTEM)?.value ?? null,
    claimType: item.type,
    serviceDate: toYmd(getClaimServiceDate(claim)),
    service: item.service ?? '',
    facility: item.facility,
    renderingProvider: item.renderingProvider,
    tags: item.tags,
    patientId: claim.patient?.reference?.replace('Patient/', '') ?? '',
    patientName: item.patientName,
    patientDob: toYmd(item.patientDob),
    payerName: item.payerName,
    payerId: item.payerId,
    nonInsurancePayerName: item.nonInsurancePayerName,
    memberId: item.memberId,
    arStage: statuses.arStage,
    insuranceArStatus: statuses.insuranceArStatus,
    insurancePaidStatus: statuses.insurancePaidStatus,
    adjudicationStatus: statuses.adjudicationStatus,
    patientArStatus: statuses.patientArStatus,
    patientPaidStatus: statuses.patientPaidStatus,
    nonInsuranceArStatus: statuses.nonInsuranceArStatus,
    nonInsurancePaidStatus: statuses.nonInsurancePaidStatus,
    billed: item.billed,
    allowed: item.allowed,
    insurancePaid: item.insurancePaid,
    patientResp: item.patientResp,
    patientPaid: item.patientPaid,
    writeOffsTotal: item.writeOffsTotal,
    claimBalance: item.claimBalance,
    adjudicated: item.adjudicated,
  };

  if (flags.codes) Object.assign(row, codesLayer(claim));
  if (flags.writeOffs) Object.assign(row, writeOffsLayer(lookups.writeOffs.get(claim.id ?? '') ?? []));

  if (flags.remits) {
    Object.assign(row, remitsLayer(lookups.claimResponsesByClaimId.get(claim.id ?? '') ?? [], lookups.payersByRef));
  }

  if (flags.timeline) Object.assign(row, timelineLayer(claim));

  return row;
}

function codesLayer(claim: Claim): Pick<AdHocBillingClaimsRow, 'cptCodes' | 'cptLines' | 'icdCodes'> {
  const cptLines = (claim.item ?? [])
    .map((line) => ({
      code: line.productOrService?.coding?.[0]?.code ?? '',
      modifiers: (line.modifier ?? []).map((m) => m.coding?.[0]?.code ?? '').filter(Boolean),
      units: line.quantity?.value ?? 1,
      charge: line.net?.value ?? 0,
    }))
    .filter((line) => line.code);

  const icdCodes = [...(claim.diagnosis ?? [])]
    .sort((a, b) => a.sequence - b.sequence)
    .map((dx) => dx.diagnosisCodeableConcept?.coding?.[0]?.code ?? '')
    .filter(Boolean);

  return {
    cptCodes: [...new Set(cptLines.map((line) => line.code))],
    cptLines,
    icdCodes: [...new Set(icdCodes)],
  };
}

function writeOffsLayer(
  notices: PaymentNotice[]
): Pick<AdHocBillingClaimsRow, 'writeOffCount' | 'writeOffReasons' | 'writeOffs'> {
  const writeOffs = notices
    .map(writeOffFromPaymentNotice)
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((writeOff) => ({
      date: writeOff.date || null,
      amount: writeOff.amount,
      party: writeOff.party,
      payer: writeOff.payer ?? '',
      reason: writeOffReasonLabel(writeOff.party, writeOff.reason),
      // sumWriteOffs counts only active notices; anything else no longer counts in writeOffsTotal.
      voided: writeOff.status !== 'active',
    }));

  const active = writeOffs.filter((writeOff) => !writeOff.voided);

  return {
    writeOffCount: active.length,
    writeOffReasons: [...new Set(active.map((writeOff) => writeOff.reason).filter(Boolean))],
    writeOffs,
  };
}

function remitsLayer(
  claimResponses: ClaimResponse[],
  payersByRef: Map<string, Organization>
): Pick<
  AdHocBillingClaimsRow,
  'remitCount' | 'lastRemitDate' | 'adjustmentReasonCodes' | 'remits' | 'remitAdjustments'
> {
  const sorted = sortClaimResponsesByRecency(claimResponses);

  const remits = sorted.map((claimResponse) => {
    const amounts = extractClaimResponseAmounts(claimResponse);
    return {
      date: claimResponse.created || null,
      payerName: remitPayerName(claimResponse, payersByRef),
      allowed: amounts.allowed ?? null,
      paid: amounts.paid,
      patientResp: amounts.patientResp ?? null,
    };
  });

  const remitAdjustments = sorted.flatMap((claimResponse) =>
    extractRemitAdjustments(claimResponse).map((adjustment) => ({
      remitDate: claimResponse.created || null,
      payerName: remitPayerName(claimResponse, payersByRef),
      group: adjustment.groupCode,
      code: adjustment.reasonCode,
      amount: adjustment.amount,
    }))
  );

  return {
    remitCount: remits.length,
    lastRemitDate: remits[remits.length - 1]?.date ?? null,
    adjustmentReasonCodes: [...new Set(remitAdjustments.map((adjustment) => adjustment.code).filter(Boolean))],
    remits,
    remitAdjustments,
  };
}

const remitPayerName = (claimResponse: ClaimResponse, payersByRef: Map<string, Organization>): string => {
  const ref = claimResponse.insurer?.reference;
  return (ref && payersByRef.get(ref)?.name) || '';
};

function timelineLayer(claim: Claim): Pick<AdHocBillingClaimsRow, 'insuranceFinalizedDate' | 'enteredPatientArDate'> {
  const dateOf = (url: string): string | null => claim.extension?.find((ext) => ext.url === url)?.valueDateTime || null;

  return {
    insuranceFinalizedDate: dateOf(CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized),
    enteredPatientArDate: dateOf(CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr),
  };
}

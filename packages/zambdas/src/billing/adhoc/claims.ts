import Oystehr from '@oystehr/sdk';
import { Claim, ClaimResponse, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getEmCodes } from 'utils/lib/helpers/em-codes';
import { isPayerUrl } from 'utils/lib/helpers/helpers';
import {
  AdHocBillingClaimsInput,
  AdHocBillingClaimsRow,
  BILLING_CLAIMS_LAYERS,
  BillingClaimsBaseRowSchema,
} from 'utils/lib/types/adhoc/datasets/billing-claims';
import { datasetRowSchema } from 'utils/lib/types/adhoc/datasets/dataset';
import { CLAIM_STATUS_DATE_EXTENSION_URLS } from 'utils/lib/types/data/billing/claim-status';
import { writeOffReasonLabel } from 'utils/lib/types/data/billing/write-off-reasons';
import { FHIR_RESOURCE_NOT_FOUND } from 'utils/lib/types/errors';
import { STRIPE_PAYMENT_ID_SYSTEM } from '../../shared/stripeIntegration';
import {
  ClaimEraLinks,
  extractClaimResponseAmounts,
  extractRemitAdjustments,
  sortClaimResponsesByRecency,
  toClaimPatientPayment,
} from '../claim-amounts';
import {
  buildClaimLookups,
  ClaimLookups,
  claimMatchesServiceDateRange,
  fetchClaimsPageByIds,
  getClaimServiceDate,
  mapClaimToItem,
  scanClaimIds,
} from '../claim-search';
import {
  CLINICAL_PAYMENT_NOTICE_ID_SYSTEM,
  MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM,
  MANUAL_REFUND_ID_SYSTEM,
} from '../payments';
import { resolveActorNames } from '../reports/shared';
import {
  copySourceId,
  ERA_STATUS_CODE_EXTENSION,
  isWorkingCopy,
  MAX_COPY_CHAIN_HOPS,
  resolvePayersByRef,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../shared';
import { writeOffFromPaymentNotice } from '../write-offs';
import {
  actorRefs,
  BASE_EXTRA_ELEMENTS,
  CLAIM_DETAILS_EXTRA_ELEMENTS,
  claimDetailsLayer,
  ClaimExtras,
  claimLineExtras,
  CODES_EXTRA_ELEMENTS,
  compareInstants,
  coverageLayer,
  coveragePayorRefs,
  emptyClaimExtras,
  fetchClaimCoverages,
  fetchClaimHistories,
  fetchEraLinksForClaims,
  historyLayer,
  insurancePaymentsLayer,
  paymentIssuerRefs,
  TIMELINE_EXTRA_ELEMENTS,
} from './claim-extras';
import { dayFieldsOf, withReportDays } from './report-dates';

// Every yyyy-MM-dd field of the row, converted from the stored instants in one place (report-dates).
const DAY_FIELDS = dayFieldsOf(datasetRowSchema(BillingClaimsBaseRowSchema, BILLING_CLAIMS_LAYERS));

const PAGE_SIZE = 100;
const MAX_LOOKUP_ATTEMPTS = 3;
const PAGE_CONCURRENCY = 3;
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
export const ADHOC_CLAIMS_BUILD_BUDGET_MS = 12 * 60 * 1000;
export const ADHOC_CLAIMS_OVER_BUDGET_MESSAGE = 'Too many claims for one run — narrow the date range';

interface LayerFlags {
  codes: boolean;
  claimDetails: boolean;
  coverage: boolean;
  writeOffs: boolean;
  patientPayments: boolean;
  remits: boolean;
  timeline: boolean;
  insurancePayments: boolean;
  history: boolean;
}

const extraElementsFor = (flags: LayerFlags): string[] => [
  ...new Set([
    ...BASE_EXTRA_ELEMENTS,
    ...(flags.codes ? CODES_EXTRA_ELEMENTS : []),
    ...(flags.timeline ? TIMELINE_EXTRA_ELEMENTS : []),
    ...(flags.claimDetails ? CLAIM_DETAILS_EXTRA_ELEMENTS : []),
  ]),
];

/**
 * `oystehr` is the billing client. `eraReadClient` (untagged) is needed only for the insurancePayments
 * layer: the ERA PaymentReconciliations and their processing Provenances carry no billing tag.
 */
export async function fetchAdHocClaimRows(
  oystehr: Oystehr,
  input: AdHocBillingClaimsInput,
  { eraReadClient }: { eraReadClient?: Oystehr } = {}
): Promise<AdHocBillingClaimsRow[]> {
  const flags: LayerFlags = {
    codes: !!input.includeCodes,
    claimDetails: !!input.includeClaimDetails,
    coverage: !!input.includeCoverage,
    writeOffs: !!input.includeWriteOffs,
    remits: !!input.includeRemits,
    timeline: !!input.includeTimeline,
    patientPayments: !!input.includePatientPayments,
    insurancePayments: !!input.includeInsurancePayments,
    history: !!input.includeHistory,
  };

  if ((flags.insurancePayments || flags.remits) && !eraReadClient) {
    throw new Error('The remits and insurancePayments layers need the untagged ERA read client');
  }

  const extraElements = extraElementsFor(flags);
  const startedAt = Date.now();
  const deadline = startedAt + ADHOC_CLAIMS_BUILD_BUDGET_MS;

  const assertWithinBudget = (): void => {
    if (Date.now() > deadline) throw new Error(ADHOC_CLAIMS_OVER_BUDGET_MESSAGE);
  };

  // Bounds one awaited step by what is left of the budget, so a slow request cannot run the worker
  // into its timeout; work still in flight is abandoned and the Task is marked failed.
  const withinBudget = async <T>(work: Promise<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(ADHOC_CLAIMS_OVER_BUDGET_MESSAGE)), Math.max(0, deadline - Date.now()));
    });
    try {
      return await Promise.race([work, expired]);
    } finally {
      clearTimeout(timer);
    }
  };

  const emCodes = flags.codes && eraReadClient ? await withinBudget(loadEmCodes(eraReadClient)) : new Set<string>();

  const scanned = await withinBudget(scanAllClaims(oystehr, assertWithinBudget));

  const claimIds = scanned
    .filter((claim) => claimMatchesServiceDateRange(claim, input.dateRange.start, input.dateRange.end))
    .map((claim) => claim.id);

  console.log(
    `[adhoc-billing] claims scanned=${scanned.length} inRange=${claimIds.length} ms=${Date.now() - startedAt}`
  );

  const payers = createPayerResolver(oystehr);
  const patientKeyResolver = createPatientKeyResolver(oystehr);
  const actorNameResolver = createActorNameResolver();
  const pages: string[][] = [];

  for (let i = 0; i < claimIds.length; i += PAGE_SIZE) pages.push(claimIds.slice(i, i + PAGE_SIZE));

  const rows: AdHocBillingClaimsRow[] = [];

  for (let i = 0; i < pages.length; i += PAGE_CONCURRENCY) {
    assertWithinBudget();
    const group = await withinBudget(
      Promise.all(
        pages.slice(i, i + PAGE_CONCURRENCY).map(async (ids) => {
          const page = await fetchClaimsPageByIds({ oystehr, claimIds: ids, extraElements });

          const lookups = await buildClaimLookups({
            oystehr,
            claims: page.claims,
            includedResources: page.includedResources,
            payersByRef: await payers.resolve(page.claims.map((claim) => claim.insurer?.reference)),
          });

          const extras = emptyClaimExtras();
          const [coveragesById, eraLinks, historyByClaimId, patientKeys] = await Promise.all([
            flags.coverage ? fetchClaimCoverages(oystehr, page.claims) : extras.coveragesById,
            (flags.remits || flags.insurancePayments) && eraReadClient
              ? fetchEraLinksForClaims(eraReadClient, lookups)
              : extras.eraLinks,
            flags.history
              ? fetchClaimHistories(
                  oystehr,
                  page.claims.map((claim) => claim.id)
                )
              : extras.historyByClaimId,
            patientKeyResolver.keysFor(lookups.patients),
          ]);

          const actorNames =
            eraReadClient && (flags.history || flags.insurancePayments)
              ? await actorNameResolver.namesFor(eraReadClient, actorRefs({ eraLinks, historyByClaimId }))
              : new Map<string, string>();

          const morePayerRefs = [
            ...(flags.remits || flags.insurancePayments
              ? [...lookups.claimResponsesByClaimId.values()]
                  .flat()
                  .map((claimResponse) => claimResponse.insurer?.reference)
              : []),
            ...coveragePayorRefs(coveragesById),
            ...paymentIssuerRefs(eraLinks),
          ];
          if (morePayerRefs.length > 0) {
            (await payers.resolve(morePayerRefs)).forEach((payer, ref) => lookups.payersByRef.set(ref, payer));
          }

          return page.claims.map((claim) =>
            mapClaimToAdHocRow(claim, lookups, flags, patientKeys, {
              coveragesById,
              eraLinks,
              historyByClaimId,
              actorNames,
              emCodes,
            })
          );
        })
      )
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

async function loadEmCodes(eraReadClient: Oystehr): Promise<ReadonlySet<string>> {
  try {
    return new Set((await getEmCodes(eraReadClient)).map((option) => option.code));
  } catch (error) {
    if (error !== FHIR_RESOURCE_NOT_FOUND) throw error;
    console.warn('[adhoc-billing] the E&M code list is not configured; emCode is ""');
    return new Set();
  }
}

async function scanAllClaims(
  oystehr: Oystehr,
  beforePage: () => void
): Promise<Awaited<ReturnType<typeof scanClaimIds>>['claims']> {
  const existing =
    (await oystehr.fhir.search<Claim>({ resourceType: 'Claim', params: [{ name: '_summary', value: 'count' }] }))
      .total ?? 0;

  const { claims } = await scanClaimIds({
    oystehr,
    params: [{ name: '_sort', value: '_id' }],
    maxMatches: Number.MAX_SAFE_INTEGER,
    withServiceDate: true,
    beforePage,
  });

  if (claims.length < existing) {
    throw new Error(`Claim scan returned ${claims.length} of the ${existing} claims that existed when it began`);
  }

  return claims;
}

function createPayerResolver(oystehr: Oystehr): {
  resolve: (refs: (string | undefined)[]) => Promise<Map<string, Organization>>;
  unresolvedCount: () => number;
} {
  const cache = new Map<string, Promise<Organization | undefined>>();
  const unresolved = new Set<string>();

  const lookUp = async (ref: string): Promise<Organization | undefined> => {
    for (let attempt = 1; attempt <= MAX_LOOKUP_ATTEMPTS; attempt += 1) {
      const payer = (await resolvePayersByRef(oystehr, [ref])).get(ref);
      if (payer) return payer;
    }

    unresolved.add(ref);

    return undefined;
  };

  return {
    async resolve(refs) {
      const unique = [...new Set(refs.filter((ref): ref is string => !!ref && isResolvablePayerRef(ref)))];

      for (const ref of unique) {
        if (!cache.has(ref)) cache.set(ref, lookUp(ref));
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
    unresolvedCount: () => unresolved.size,
  };
}

const isResolvablePayerRef = (ref: string): boolean => isPayerUrl(ref) || ref.startsWith('Organization/');

const toYmd = (value: string | undefined): string | null => {
  if (!value) return null;
  const date = DateTime.fromISO(value, { setZone: true });
  return date.isValid ? date.toISODate() : null;
};

function createActorNameResolver(): {
  namesFor: (untaggedClient: Oystehr, refs: string[]) => Promise<Map<string, string>>;
} {
  const cache = new Map<string, Promise<string>>();

  return {
    async namesFor(untaggedClient, refs) {
      const missing = [...new Set(refs)].filter((ref) => !cache.has(ref));

      if (missing.length > 0) {
        const fetched = resolveActorNames(untaggedClient, missing, { throwOnError: true });
        missing.forEach((ref) =>
          cache.set(
            ref,
            fetched.then((names) => names.get(ref) ?? '')
          )
        );
      }

      return new Map(await Promise.all(refs.map(async (ref) => [ref, await cache.get(ref)!] as const)));
    },
  };
}

const PATIENT_FETCH_BATCH = 100;

function createPatientKeyResolver(oystehr: Oystehr): {
  keysFor: (patients: Patient[]) => Promise<Map<string, string>>;
} {
  const ancestors = new Map<string, Patient | null>();

  const ownKey = (patient: Patient): string | undefined => {
    if (!isWorkingCopy(patient)) return copySourceId(patient) ?? patient.id;
    return patient.identifier?.find((identifier) => identifier.system === SOURCE_IDENTIFIER_SYSTEM)?.value;
  };

  const fetchMissing = async (ids: string[]): Promise<void> => {
    const missing = [...new Set(ids)].filter((id) => !ancestors.has(id));
    for (let i = 0; i < missing.length; i += PATIENT_FETCH_BATCH) {
      const batch = missing.slice(i, i + PATIENT_FETCH_BATCH);
      const found = (
        await oystehr.fhir.search<Patient>({
          resourceType: 'Patient',
          params: [
            { name: '_id', value: batch.join(',') },
            { name: '_elements', value: 'id,meta,identifier,extension' },
            { name: '_count', value: String(batch.length) },
          ],
        })
      ).unbundle();
      batch.forEach((id) => ancestors.set(id, found.find((patient) => patient.id === id) ?? null));
    }
  };

  return {
    async keysFor(patients) {
      const keys = new Map<string, string>();
      let pending: { id: string; current: Patient; visited: Set<string> }[] = [];

      for (const patient of patients) {
        if (!patient.id) continue;
        const key = ownKey(patient);
        if (key) keys.set(patient.id, key);
        else pending.push({ id: patient.id, current: patient, visited: new Set([patient.id]) });
      }

      for (let hop = 0; hop < MAX_COPY_CHAIN_HOPS && pending.length > 0; hop++) {
        await fetchMissing(pending.map((walk) => copySourceId(walk.current)).filter((id): id is string => !!id));
        const next: typeof pending = [];
        for (const walk of pending) {
          const parentId = copySourceId(walk.current);
          const parent = parentId ? ancestors.get(parentId) : undefined;
          if (!parentId || !parent || walk.visited.has(parentId)) {
            keys.set(walk.id, parentId ?? walk.current.id ?? walk.id);
            continue;
          }
          const key = ownKey(parent);
          if (key) {
            keys.set(walk.id, key);
          } else {
            walk.visited.add(parentId);
            next.push({ ...walk, current: parent });
          }
        }
        pending = next;
      }

      pending.forEach((walk) => keys.set(walk.id, walk.current.id ?? walk.id));
      return keys;
    },
  };
}

export function mapClaimToAdHocRow(
  claim: Claim,
  lookups: ClaimLookups,
  flags: LayerFlags,
  patientKeys: Map<string, string>,
  extras: ClaimExtras = emptyClaimExtras()
): AdHocBillingClaimsRow {
  const item = mapClaimToItem(claim, lookups);
  const claimPatientId = claim.patient?.reference?.replace('Patient/', '') ?? '';
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
    patientId: patientKeys.get(claimPatientId) ?? claimPatientId,
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

  const claimResponses = lookups.claimResponsesByClaimId.get(claim.id ?? '') ?? [];

  if (flags.codes) Object.assign(row, codesLayer(claim, extras.emCodes));
  if (flags.claimDetails) Object.assign(row, claimDetailsLayer(claim, lookups));
  if (flags.coverage) Object.assign(row, coverageLayer(claim, extras.coveragesById, lookups.payersByRef));
  if (flags.writeOffs) Object.assign(row, writeOffsLayer(lookups.writeOffs.get(claim.id ?? '') ?? []));
  if (flags.patientPayments) {
    Object.assign(row, patientPaymentsLayer(lookups.patientPaymentsByClaimId?.get(claim.id ?? '') ?? []));
  }

  if (flags.remits) Object.assign(row, remitsLayer(claimResponses, lookups.payersByRef, extras.eraLinks));
  if (flags.timeline) Object.assign(row, timelineLayer(claim));
  if (flags.insurancePayments) {
    Object.assign(row, insurancePaymentsLayer(claimResponses, extras.eraLinks, lookups.payersByRef, extras.actorNames));
  }
  if (flags.history)
    Object.assign(row, historyLayer(extras.historyByClaimId.get(claim.id ?? '') ?? [], extras.actorNames));

  return withReportDays(row, DAY_FIELDS);
}

const lineExtras = (claim: Claim, line: NonNullable<Claim['item']>[number]): ReturnType<typeof claimLineExtras> => {
  const extras = claimLineExtras(claim, line);
  return { ...extras, serviceDate: toYmd(extras.serviceDate ?? undefined) };
};

function codesLayer(
  claim: Claim,
  emCodes: ReadonlySet<string>
): Pick<AdHocBillingClaimsRow, 'cptCodes' | 'cptLines' | 'icdCodes' | 'emCode'> {
  const cptLines = (claim.item ?? [])
    .map((line) => ({
      code: line.productOrService?.coding?.[0]?.code ?? '',
      modifiers: (line.modifier ?? []).map((m) => m.coding?.[0]?.code ?? '').filter(Boolean),
      units: line.quantity?.value ?? 1,
      charge: line.net?.value ?? 0,
      ...lineExtras(claim, line),
    }))
    .filter((line) => line.code);

  const icdCodes = [...(claim.diagnosis ?? [])]
    .sort((a, b) => a.sequence - b.sequence)
    .map((dx) => dx.diagnosisCodeableConcept?.coding?.[0]?.code ?? '')
    .filter(Boolean);

  return {
    cptCodes: [...new Set(cptLines.map((line) => line.code))],
    cptLines,
    emCode: cptLines.find((line) => emCodes.has(line.code))?.code ?? '',
    icdCodes: [...new Set(icdCodes)],
  };
}

function writeOffsLayer(
  notices: PaymentNotice[]
): Pick<AdHocBillingClaimsRow, 'writeOffCount' | 'writeOffReasons' | 'writeOffs'> {
  const writeOffs = notices
    .map(writeOffFromPaymentNotice)
    .sort((a, b) => compareInstants(a.date, b.date))
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

type PatientPaymentSource = 'ehr' | 'card' | 'manual' | 'other';

const paymentSource = (notice: PaymentNotice): PatientPaymentSource => {
  const systems = new Set((notice.identifier ?? []).map((identifier) => identifier.system));
  if (systems.has(CLINICAL_PAYMENT_NOTICE_ID_SYSTEM)) return 'ehr';
  if (systems.has(STRIPE_PAYMENT_ID_SYSTEM)) return 'card';
  if (systems.has(MANUAL_PAYMENT_IDEMPOTENCY_KEY_SYSTEM) || systems.has(MANUAL_REFUND_ID_SYSTEM)) return 'manual';
  return 'other';
};

function patientPaymentsLayer(
  notices: PaymentNotice[]
): Pick<
  AdHocBillingClaimsRow,
  'patientPaymentCount' | 'patientRefundedTotal' | 'lastPatientPaymentDate' | 'patientPayments'
> {
  const patientPayments = notices
    .map((notice) => {
      const payment = toClaimPatientPayment(notice);
      return {
        date: payment.paymentDate || null,
        amount: payment.amount,
        kind: payment.amount < 0 ? ('refund' as const) : ('payment' as const),
        method: payment.method,
        source: paymentSource(notice),
        voided: notice.status !== 'active',
      };
    })
    .sort((a, b) => compareInstants(a.date, b.date));
  const counted = patientPayments.filter((payment) => !payment.voided);
  const payments = counted.filter((payment) => payment.kind === 'payment');

  return {
    patientPaymentCount: payments.length,
    patientRefundedTotal: counted
      .filter((payment) => payment.kind === 'refund')
      .reduce((sum, payment) => sum - payment.amount, 0),
    lastPatientPaymentDate: payments[payments.length - 1]?.date ?? null,
    patientPayments,
  };
}

function remitsLayer(
  claimResponses: ClaimResponse[],
  payersByRef: Map<string, Organization>,
  eraLinks: ClaimEraLinks
): Pick<
  AdHocBillingClaimsRow,
  'remitCount' | 'lastRemitDate' | 'adjustmentReasonCodes' | 'remits' | 'remitAdjustments'
> {
  const sorted = sortClaimResponsesByRecency(claimResponses).sort((a, b) => compareInstants(a.created, b.created));

  const remits = sorted.map((claimResponse) => {
    const amounts = extractClaimResponseAmounts(claimResponse);
    return {
      date: claimResponse.created || null,
      payerName: remitPayerName(claimResponse, payersByRef, eraLinks),
      eraStatusCode:
        claimResponse.extension?.find((extension) => extension.url === ERA_STATUS_CODE_EXTENSION)?.valueString ?? '',
      allowed: amounts.allowed ?? null,
      paid: amounts.paid,
      patientResp: amounts.patientResp ?? null,
    };
  });

  const remitAdjustments = sorted.flatMap((claimResponse) =>
    extractRemitAdjustments(claimResponse).map((adjustment) => ({
      remitDate: claimResponse.created || null,
      payerName: remitPayerName(claimResponse, payersByRef, eraLinks),
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

const remitPayerName = (
  claimResponse: ClaimResponse,
  payersByRef: Map<string, Organization>,
  eraLinks: ClaimEraLinks
): string => {
  const eraId = eraLinks.paymentReconciliationIdByClaimResponseId.get(claimResponse.id ?? '');
  const issuerRef = eraLinks.paymentReconciliations.find((era) => era.id === eraId)?.paymentIssuer?.reference;
  const insurerRef = claimResponse.insurer?.reference;
  const payer =
    (issuerRef ? payersByRef.get(issuerRef) : undefined) ?? (insurerRef ? payersByRef.get(insurerRef) : undefined);
  return payer?.name || '';
};

function timelineLayer(claim: Claim): Pick<AdHocBillingClaimsRow, 'insuranceFinalizedDate' | 'enteredPatientArDate'> {
  const dateOf = (url: string): string | null => claim.extension?.find((ext) => ext.url === url)?.valueDateTime || null;

  return {
    insuranceFinalizedDate: dateOf(CLAIM_STATUS_DATE_EXTENSION_URLS.insuranceFinalized),
    enteredPatientArDate: dateOf(CLAIM_STATUS_DATE_EXTENSION_URLS.enteredPatientAr),
  };
}

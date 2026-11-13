import Oystehr, { SearchParam } from '@oystehr/sdk';
import {
  Claim,
  ClaimResponse,
  ClaimResponseItemAdjudication,
  FhirResource,
  Invoice,
  PaymentNotice,
  PaymentReconciliation,
  Provenance,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getPaymentNoticeInvoiceId } from 'utils/lib/fhir/billing-invoice';
import { CLAIM_STATUS_RESPONSE_EVENT_SYSTEM, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { getContainedReconciliation } from 'utils/lib/fhir/payments';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { extractPayerIdFromUrl } from 'utils/lib/helpers/helpers';
import {
  ERA_VOID_STATUS,
  X12_ADJUSTMENT_GROUP_CODE,
  X12AdjustmentGroupCode,
} from 'utils/lib/types/data/billing/billing.constants';
import { ClaimPatientPayment, ClaimRemitAdjustment } from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { fetchAllPages } from '../shared/fhir';
import { PATIENT_PAYMENT_IDENTIFIER_FILTER } from './payments';
import { ERA_STATUS_CODE_EXTENSION, isEraProcessingProvenance } from './shared';

export const OYSTEHR_ADJUDICATION_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/adjudication';
export const X12_ADJUSTMENT_GROUP_SYSTEM = 'https://x12.org/codes/claim-adjustment-group-codes';
export const ADJUDICATION_CODES = {
  PAID: 'paid',
  ALLOWED: 'allowed',
  ALLOWED_X12: 'B6',
  CHARGE: 'charge',
} as const;
export const ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY = X12_ADJUSTMENT_GROUP_CODE.patientResponsibility;

export interface ClaimResponseAmounts {
  payerId: string;
  paid: number;
  // undefined = the ClaimResponse carries no allowed data (distinct from an explicit 0)
  allowed: number | undefined;
  // undefined = the ClaimResponse carries no PR adjustments, so what the patient owes can't be read off it
  patientResp: number | undefined;
}

export interface ClaimPaymentSummary {
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  writeOffsTotal: number;
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
  // Allowed is only reported per service line (SVC-level AMT*B6). ClaimResponse.total is filled
  // from the CLP segment, which has no allowed amount, so it is never looked up there.
  const allowedAdjudications = adjudications.filter((adj) => allowedCodes.includes(adjudicationCode(adj) ?? ''));
  const allowed = allowedAdjudications.length > 0 ? sumAmounts(allowedAdjudications) : undefined;
  // Only PR adjustments say what the patient owes; a remit without any (even one with other
  // adjustments) leaves it undetermined rather than 0.
  const patientRespAdjudications = adjudications.filter(
    (adj) => adjudicationCode(adj) === ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY
  );
  const patientResp = patientRespAdjudications.length > 0 ? sumAmounts(patientRespAdjudications) : undefined;

  const payerId = extractPayerIdFromUrl(claimResponse.insurer.reference) ?? '';

  return {
    payerId,
    paid,
    allowed,
    patientResp,
  };
}

// CAS adjustments as written by both ERA converters: category = group code (system
// X12_ADJUSTMENT_GROUP_SYSTEM), reason = CARC reason code, amount = the adjusted amount.
function extractAdjustments(adjudications: ClaimResponseItemAdjudication[]): ClaimRemitAdjustment[] {
  return adjudications
    .filter((adj) => adj.category?.coding?.[0]?.system === X12_ADJUSTMENT_GROUP_SYSTEM && adjudicationCode(adj) != null)
    .map((adj) => ({
      groupCode: adjudicationCode(adj) as X12AdjustmentGroupCode,
      reasonCode: adj.reason?.coding?.[0]?.code ?? '',
      amount: adj.amount?.value ?? 0,
    }));
}

export function extractRemitAdjustments(claimResponse: ClaimResponse): ClaimRemitAdjustment[] {
  return extractAdjustments(allAdjudications(claimResponse));
}

// CLP03 total claim charge as the payer reported it: the ClaimResponse.total 'charge' entry, else
// the sum of the line-level 'charge' adjudications. Undefined when the remit reports no charge.
export function extractReportedCharge(claimResponse: ClaimResponse): number | undefined {
  const totalCharge = claimResponse.total?.find(
    (total) => total.category?.coding?.[0]?.code === ADJUDICATION_CODES.CHARGE
  )?.amount?.value;
  if (totalCharge !== undefined) return totalCharge;
  const chargeAdjudications = allAdjudications(claimResponse).filter(
    (adj) => adjudicationCode(adj) === ADJUDICATION_CODES.CHARGE
  );
  return chargeAdjudications.length > 0 ? sumAmounts(chargeAdjudications) : undefined;
}

export interface RemitLineAmounts {
  // undefined = not reported on this line (distinct from an explicit 0)
  billed: number | undefined;
  allowed: number | undefined;
  paid: number;
  adjustments: ClaimRemitAdjustment[];
}

// Per-line variant of extractClaimResponseAmounts: reads a single item/addItem adjudication array.
export function extractLineAmounts(adjudications: ClaimResponseItemAdjudication[] | undefined): RemitLineAmounts {
  const all = adjudications ?? [];
  const amountOf = (code: string): number | undefined => {
    const matches = all.filter((adj) => adjudicationCode(adj) === code);
    return matches.length > 0 ? sumAmounts(matches) : undefined;
  };
  const allowedCodes: string[] = [ADJUDICATION_CODES.ALLOWED, ADJUDICATION_CODES.ALLOWED_X12];
  const allowedMatches = all.filter((adj) => allowedCodes.includes(adjudicationCode(adj) ?? ''));
  return {
    billed: amountOf(ADJUDICATION_CODES.CHARGE),
    allowed: allowedMatches.length > 0 ? sumAmounts(allowedMatches) : undefined,
    paid: amountOf(ADJUDICATION_CODES.PAID) ?? 0,
    adjustments: extractAdjustments(all),
  };
}

export function sortClaimResponsesByRecency(claimResponses: ClaimResponse[]): ClaimResponse[] {
  return [...claimResponses].sort(
    (a, b) =>
      (a.created ?? '').localeCompare(b.created ?? '') ||
      (a.meta?.lastUpdated ?? '').localeCompare(b.meta?.lastUpdated ?? '')
  );
}

// A claim's balances are computed as a fold over its remits: readRemitAmounts reads what one remit
// says, applyRemit folds it into the running ClaimBalances, and each step's balances can be
// inspected on their own (see claimBalanceSteps).

// CARC 23: "payment adjusted because charges have been paid by another payer" — a secondary
// restating what prior payers paid or adjusted, not a write-off of its own.
const PRIOR_PAYER_IMPACT_REASON_CODE = '23';

// What one remit says, read once: everything applyRemit needs from it.
export interface RemitAmounts {
  paid: number;
  // undefined = not reported on this remit
  allowed: number | undefined;
  // the PR adjustments' sum; undefined = the remit carries none, so it doesn't say what the patient owes
  patientResp: number | undefined;
  // non-PR adjustments (CO/OA/PI/CR), excluding prior-payer impact
  writeOffs: number;
  // the part of writeOffs that is this remit's billed-to-allowed reduction; 0 without an allowed amount
  reductionToAllowed: number;
  // the rest of writeOffs, e.g. CO-253 sequestration taken after allowed; all of them without an
  // allowed amount
  writeOffsBeyondAllowed: number;
}

// `billed` stands in for a remit that reports no charge.
//
// The reduction to allowed (charge - allowed) is only taken to the extent the remit's adjustments
// actually carry it: an 835 balances (charge = paid + every adjustment), so whatever a manually
// keyed remit leaves unbalanced is taken to be the unreported part of that reduction. Clamped
// toward zero in the direction of the reduction, so a reversal (every amount negated) still
// cancels its original.
export function readRemitAmounts(claimResponse: ClaimResponse, billed?: number): RemitAmounts {
  const { paid, allowed, patientResp } = extractClaimResponseAmounts(claimResponse);
  const adjustments = extractRemitAdjustments(claimResponse);
  const writeOffs = adjustments
    .filter(
      (adjustment) =>
        adjustment.groupCode !== ADJUSTMENT_GROUP_PATIENT_RESPONSIBILITY &&
        adjustment.reasonCode !== PRIOR_PAYER_IMPACT_REASON_CODE
    )
    .reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const withReduction = (reductionToAllowed: number): RemitAmounts => ({
    paid,
    allowed,
    patientResp,
    writeOffs,
    reductionToAllowed,
    writeOffsBeyondAllowed: writeOffs - reductionToAllowed,
  });

  if (allowed === undefined) return withReduction(0);
  const charge = extractReportedCharge(claimResponse) ?? billed;
  // without a charge the reduction is unknowable; take the write-offs to be exactly it
  if (charge === undefined) return withReduction(writeOffs);

  const reduction = charge - allowed;
  // nothing for the write-offs to be absorbed into, whichever direction they run (a reversal's are
  // negative); the clamping below would otherwise floor those to 0
  if (reduction === 0) return withReduction(0);
  const sign = reduction < 0 ? -1 : 1;
  const allAdjustments = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
  const unreported = charge - paid - allAdjustments;
  const reportedReduction = Math.min(Math.max(sign * (reduction - unreported), 0), sign * reduction);
  return withReduction(sign * Math.min(reportedReduction, Math.max(sign * writeOffs, 0)));
}

// What a remit wrote off beyond the reduction already reflected in its own allowed amount. A remit
// without an allowed amount has no such reduction, so all its write-offs count.
export function remitWriteOffsBeyondAllowed(claimResponse: ClaimResponse, billed?: number): number {
  return readRemitAmounts(claimResponse, billed).writeOffsBeyondAllowed;
}

// A claim's insurance-side balances after applying its remits in order (see applyRemit).
export interface ClaimBalances {
  billed: number;
  // the latest allowed amount reported; undefined until a remit reports one
  allowed: number | undefined;
  // every remit's paid, summed: reversals net out with their negative amounts
  insurancePaid: number;
  // the latest remit's PR; undefined when that remit carries none
  reportedPatientResp: number | undefined;
  // summed over remits that report allowed
  writeOffsBeyondAllowed: number;
  // summed over remits that report allowed: how much of the claim's reduction to allowed they carried
  reductionCarried: number;
  // summed over remits that report no allowed amount
  writeOffsWithoutAllowed: number;
  // what the patient owes per the remits so far (see resolvePatientResp)
  patientResp: number;
}

export function initialClaimBalances(billed: number): ClaimBalances {
  return {
    billed,
    allowed: undefined,
    insurancePaid: 0,
    reportedPatientResp: undefined,
    writeOffsBeyondAllowed: 0,
    reductionCarried: 0,
    writeOffsWithoutAllowed: 0,
    patientResp: 0,
  };
}

// Remits must be applied oldest first (sortClaimResponsesByRecency).
export function applyRemit(balances: ClaimBalances, remit: RemitAmounts): ClaimBalances {
  const reportsAllowed = remit.allowed !== undefined;
  const next: ClaimBalances = {
    ...balances,
    allowed: remit.allowed ?? balances.allowed,
    insurancePaid: balances.insurancePaid + remit.paid,
    reportedPatientResp: remit.patientResp,
    writeOffsBeyondAllowed: balances.writeOffsBeyondAllowed + (reportsAllowed ? remit.writeOffsBeyondAllowed : 0),
    reductionCarried: balances.reductionCarried + remit.reductionToAllowed,
    writeOffsWithoutAllowed: balances.writeOffsWithoutAllowed + (reportsAllowed ? 0 : remit.writeOffs),
  };
  return { ...next, patientResp: resolvePatientResp(next) };
}

// Patient responsibility is what the latest remit's PR says the patient owes: after COB the last
// payer's PR already accounts for what prior payers paid, so summing PR across payers would
// double-count the share of the primary's PR the secondary covered. Without PR on the latest remit
// it's derived (see derivePatientResp). Ceilinged to 0 either way: a reversal reports what it took
// back as negative PR, and the patient owes nothing rather than less than nothing — otherwise a
// payment they made counts twice as credit.
function resolvePatientResp(balances: ClaimBalances): number {
  return Math.max(balances.reportedPatientResp ?? derivePatientResp(balances), 0);
}

// basis - insurancePaid - whatever payers wrote off on top of the basis. The basis is the latest
// allowed amount, or billed when no remit reports one (AMT*B6 is optional, and manual ERAs may
// leave it blank).
//
// Remits reporting allowed count only their write-offs beyond their own reduction to allowed, so a
// secondary repeating the primary's allowed doesn't drop the primary's post-allowed write-offs. The
// basis already excludes the claim's reduction (billed - allowed), so whatever part of it those
// remits didn't carry is taken out of the write-offs of remits without an allowed amount (a
// primary's CO-45 when only a later remit reports allowed) before the rest of those count, e.g. a
// secondary writing off what it didn't pay.
function derivePatientResp(balances: ClaimBalances): number {
  const basis = balances.allowed ?? balances.billed;
  const uncarriedReduction = Math.max(balances.billed - basis - balances.reductionCarried, 0);
  // floored only when there is a reduction to absorb, so net-negative (reversed) write-offs still
  // count otherwise
  const writeOffsWithoutAllowed =
    uncarriedReduction > 0
      ? Math.max(balances.writeOffsWithoutAllowed - uncarriedReduction, 0)
      : balances.writeOffsWithoutAllowed;
  return basis - balances.insurancePaid - balances.writeOffsBeyondAllowed - writeOffsWithoutAllowed;
}

export interface ClaimBalanceStep {
  claimResponseId: string | undefined;
  remit: RemitAmounts;
  // the balances after applying this remit
  balances: ClaimBalances;
}

// Every step of the fold, oldest remit first: what each remit said and the balances it left, for
// logging and investigating a claim's balance.
export function claimBalanceSteps(claimResponses: ClaimResponse[], billed: number): ClaimBalanceStep[] {
  const steps: ClaimBalanceStep[] = [];
  let balances = initialClaimBalances(billed);
  for (const claimResponse of sortClaimResponsesByRecency(claimResponses)) {
    const remit = readRemitAmounts(claimResponse, billed);
    balances = applyRemit(balances, remit);
    steps.push({ claimResponseId: claimResponse.id, remit, balances });
  }
  return steps;
}

// The claim's payment summary: the balances after its last remit, plus what the patient paid and
// the write-offs recorded on the claim.
export function summarizeClaimPayments(
  claimResponses: ClaimResponse[],
  billed: number,
  patientPaid = 0,
  writeOffsTotal = 0
): ClaimPaymentSummary {
  const steps = claimBalanceSteps(claimResponses, billed);
  const balances = steps.at(-1)?.balances;
  if (!balances) {
    return {
      allowed: 0,
      insurancePaid: 0,
      patientResp: 0,
      patientPaid,
      writeOffsTotal,
      balance: billed - patientPaid - writeOffsTotal,
      adjudicated: false,
    };
  }

  return {
    allowed: balances.allowed ?? 0,
    insurancePaid: balances.insurancePaid,
    patientResp: balances.patientResp,
    patientPaid,
    writeOffsTotal,
    balance: balances.patientResp - patientPaid - writeOffsTotal,
    adjudicated: true,
  };
}

// claims count toward the patient's balance when receiving a remit or reaching patient AR. an
// un-adjudicated claim's billed amount is pending insurance, not patient-owed
export function summarizePatientBalance(
  entries: {
    payments: ClaimPaymentSummary;
    reachedPatientAr: boolean;
  }[]
): {
  claimsWithPatientBalance: number;
  pendingPayments: number;
  currentBalance: number;
} {
  const claimBalances = entries.map(({ payments, reachedPatientAr }) =>
    roundNumberToDecimalPlaces(payments.adjudicated || reachedPatientAr ? payments.balance : -payments.patientPaid, 2)
  );
  return {
    claimsWithPatientBalance: claimBalances.filter((balance) => balance > 0).length,
    pendingPayments: 0,
    currentBalance: roundNumberToDecimalPlaces(
      claimBalances.reduce((sum, balance) => sum + balance, 0),
      2
    ),
  };
}

/**
 * Sums the amounts from patient payments. There are 4 possible resource layouts here:
 *  - normal patient payment -- positive value
 *  - voided patient payment -- positive value, status is 'cancelled'
 *  - refunded patient payment -- positive value
 *  - refund -- negative value
 * Voided are filtered out, normal and refunded payment notices add positive amounts,
 * "refund notice" adds negative amount.
 *
 * @param notices PaymentNotice resources that are expected to be for patient payments
 * @returns total
 */
export function sumPatientPayments(notices: PaymentNotice[]): number {
  return notices.filter((n) => n.status === 'active').reduce((sum, notice) => sum + (notice.amount?.value ?? 0), 0);
}

// Notices for other invoices are ignored, so callers can pass a claim's whole list.
export function getInvoiceBalanceInCents(invoice: Invoice, notices: PaymentNotice[]): number {
  if (!invoice.id) throw new Error('An invoice balance needs a saved invoice');
  const invoicePayments = notices.filter((notice) => getPaymentNoticeInvoiceId(notice) === invoice.id);
  return Math.round(((invoice.totalGross?.value ?? 0) - sumPatientPayments(invoicePayments)) * 100);
}

export function toClaimPatientPayment(notice: PaymentNotice): ClaimPatientPayment {
  const reconciliation = getContainedReconciliation(notice);
  return {
    paymentNoticeId: notice.id ?? '',
    paymentDate: notice.paymentDate ?? reconciliation?.paymentDate ?? notice.created ?? '',
    amount: notice.amount?.value ?? 0,
    method: notice.extension?.find((extension) => extension.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString ?? '',
    description: reconciliation?.disposition ?? '',
    checkNumber: reconciliation?.paymentIdentifier?.value,
    status: notice.status,
  };
}

// Oystehr leaves unmatched ERA ClaimResponses pointing at a contained '#request' claim instead of a
// real Claim/{id} reference.
export function isMatchedToClaim(claimResponse: ClaimResponse): boolean {
  return claimResponse.request?.reference?.startsWith('Claim/') ?? false;
}

export function matchedClaimId(claimResponse: ClaimResponse): string | undefined {
  return getIdFromReference(claimResponse.request?.reference, 'Claim');
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
const PATIENT_PAYMENT_ENCOUNTER_BATCH = 50;

export async function fetchResourcesGrouped<T extends FhirResource>({
  oystehr,
  resourceType,
  ids,
  buildParam,
  groupKeyOf,
  keep,
  batchSize = BATCH,
}: {
  oystehr: Oystehr;
  resourceType: T['resourceType'];
  ids: string[];
  buildParam: (batch: string[]) => SearchParam[];
  groupKeyOf: (resource: T) => string | undefined;
  keep?: (resource: T) => boolean;
  batchSize?: number;
}): Promise<Map<string, T[]>> {
  const grouped = new Map<string, T[]>();
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += batchSize) {
    const batch = uniqueIds.slice(i, i + batchSize);
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<T>({
        resourceType,
        params: [
          ...buildParam(batch),
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
      for (const resource of bundle.unbundle()) {
        if (keep && !keep(resource)) continue;
        const key = groupKeyOf(resource);
        if (!key) continue;
        const list = grouped.get(key) ?? [];
        list.push(resource);
        grouped.set(key, list);
      }
      return bundle;
    }, PAGE_SIZE);
  }
  return grouped;
}

// The CLP02 claim status Oystehr stamps on each ERA remit, which matching leaves in place
function hasEraStatusCode(claimResponse: ClaimResponse): boolean {
  return !!claimResponse.extension?.some((extension) => extension.url === ERA_STATUS_CODE_EXTENSION);
}

// Fetch every matched ClaimResponse for the given claims, grouped by claim id. Unmatched ERA
// ClaimResponses never carry a Claim/{id} request reference, so this returns matched ones only.
// Filters out non-ERA ClaimResponses created by claim submission, and the ones of voided ERAs.
export async function fetchClaimResponsesByClaimIds(
  oystehr: Oystehr,
  claimIds: string[]
): Promise<Map<string, ClaimResponse[]>> {
  return fetchResourcesGrouped<ClaimResponse>({
    oystehr,
    resourceType: 'ClaimResponse',
    ids: claimIds,
    buildParam: (batch) => [
      {
        name: 'request',
        value: batch.map((id) => `Claim/${id}`).join(','),
      },
      // Filter out error CRs, which come from claim submission
      {
        name: 'outcome:not',
        value: 'error',
      },
      {
        name: 'status:not',
        value: ERA_VOID_STATUS,
      },
    ],
    groupKeyOf: (claimResponse) => claimResponse.request?.reference?.replace('Claim/', ''),
    // Queued CRs come from claim submission too, but an ERA can also be queued
    keep: (claimResponse) => claimResponse.outcome !== 'queued' || hasEraStatusCode(claimResponse),
  });
}

export async function fetchPatientPaymentsByEncounterIds(
  oystehr: Oystehr,
  encounterIds: string[]
): Promise<Map<string, PaymentNotice[]>> {
  const system = ottehrIdentifierSystem('claim-encounter-id');
  return fetchResourcesGrouped<PaymentNotice>({
    oystehr,
    resourceType: 'PaymentNotice',
    ids: encounterIds,
    buildParam: (batch) => [
      {
        name: 'request:identifier',
        value: batch.map((id) => `${system}|${id}`).join(','),
      },
      {
        name: 'identifier',
        value: PATIENT_PAYMENT_IDENTIFIER_FILTER,
      },
    ],
    groupKeyOf: (notice) => notice.request?.identifier?.value,
    batchSize: PATIENT_PAYMENT_ENCOUNTER_BATCH,
  });
}

export async function fetchPatientPaymentsByClaimId({
  oystehr,
  claims,
}: {
  oystehr: Oystehr;
  claims: Claim[];
}): Promise<Map<string, PaymentNotice[]>> {
  const system = ottehrIdentifierSystem('claim-encounter-id');
  const encounterIdByClaimId = new Map<string, string>();
  for (const claim of claims) {
    const encounterId = claim.identifier?.find((identifier) => identifier.system === system)?.value;
    if (claim.id && encounterId) encounterIdByClaimId.set(claim.id, encounterId);
  }

  const paymentsByEncounter = await fetchPatientPaymentsByEncounterIds(oystehr, [...encounterIdByClaimId.values()]);

  const paymentsByClaimId = new Map<string, PaymentNotice[]>();
  for (const [claimId, encounterId] of encounterIdByClaimId) {
    paymentsByClaimId.set(claimId, paymentsByEncounter.get(encounterId) ?? []);
  }
  return paymentsByClaimId;
}

export const sumPatientPaymentsByClaimId = (paymentsByClaimId: Map<string, PaymentNotice[]>): Map<string, number> =>
  new Map([...paymentsByClaimId].map(([claimId, notices]) => [claimId, sumPatientPayments(notices)]));

export async function fetchPatientPaidByClaimId({
  oystehr,
  claims,
}: {
  oystehr: Oystehr;
  claims: Claim[];
}): Promise<Map<string, number>> {
  return sumPatientPaymentsByClaimId(await fetchPatientPaymentsByClaimId({ oystehr, claims }));
}

// Fetch the era-processing Provenances (one per ERA, targeting its PaymentReconciliation +
// ClaimResponses) that point at any of the given resource references, deduped by id.
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
  const paymentReconciliationIds = paymentReconciliations
    .map((paymentReconciliation) => paymentReconciliation.id)
    .filter((id): id is string => !!id);

  const provenances = await fetchEraProcessingProvenances(
    oystehr,
    paymentReconciliationIds.map((id) => `PaymentReconciliation/${id}`)
  );

  return fetchClaimResponsesFromEraProvenances(oystehr, provenances);
}

export async function fetchClaimResponsesFromEraProvenances(
  oystehr: Oystehr,
  provenances: Provenance[]
): Promise<Map<string, ClaimResponse[]>> {
  const claimResponseIdsByPaymentReconciliationId = new Map<string, string[]>();

  for (const provenance of provenances) {
    const claimResponseIds = eraProvenanceTargetIds(provenance, 'ClaimResponse');

    for (const paymentReconciliationId of eraProvenanceTargetIds(provenance, 'PaymentReconciliation')) {
      claimResponseIdsByPaymentReconciliationId.set(paymentReconciliationId, [
        ...(claimResponseIdsByPaymentReconciliationId.get(paymentReconciliationId) ?? []),
        ...claimResponseIds,
      ]);
    }
  }

  const claimResponsesById = await fetchResourcesGrouped<ClaimResponse>({
    oystehr,
    resourceType: 'ClaimResponse',
    ids: [...new Set([...claimResponseIdsByPaymentReconciliationId.values()].flat())],
    buildParam: (batch) => [
      {
        name: '_id',
        value: batch.join(','),
      },
    ],
    groupKeyOf: (claimResponse) => claimResponse.id,
  });

  const grouped = new Map<string, ClaimResponse[]>();

  for (const [paymentReconciliationId, claimResponseIds] of claimResponseIdsByPaymentReconciliationId) {
    grouped.set(
      paymentReconciliationId,
      claimResponseIds.flatMap((id) => claimResponsesById.get(id) ?? [])
    );
  }

  return grouped;
}

export interface ClaimEraLinks {
  paymentReconciliations: PaymentReconciliation[];
  // the ERA each of the given ClaimResponses arrived on; one ERA can carry several of them (e.g. a
  // reversal and its correction)
  paymentReconciliationIdByClaimResponseId: Map<string, string>;
  // Who the ERA's era-processing Provenance names (for a manual ERA, the biller who keyed it in); optional
  // so callers that build ClaimEraLinks themselves need not supply it.
  agentRefByPaymentReconciliationId?: Map<string, string>;
}

export async function fetchClaimEraLinks(oystehr: Oystehr, claimResponses: ClaimResponse[]): Promise<ClaimEraLinks> {
  const claimResponseIds = new Set(claimResponses.map((cr) => cr.id).filter((id): id is string => !!id));

  const provenances = await fetchEraProcessingProvenances(
    oystehr,
    [...claimResponseIds].map((id) => `ClaimResponse/${id}`)
  );

  const paymentReconciliationIds = new Set<string>();
  const paymentReconciliationIdByClaimResponseId = new Map<string, string>();
  const agentRefByPaymentReconciliationId = new Map<string, string>();

  for (const provenance of provenances) {
    const eraPaymentReconciliationIds = eraProvenanceTargetIds(provenance, 'PaymentReconciliation');
    eraPaymentReconciliationIds.forEach((id) => paymentReconciliationIds.add(id));
    const agentRef = provenance.agent?.[0]?.who?.reference;
    if (agentRef) eraPaymentReconciliationIds.forEach((id) => agentRefByPaymentReconciliationId.set(id, agentRef));

    if (eraPaymentReconciliationIds.length === 0) continue;

    for (const claimResponseId of eraProvenanceTargetIds(provenance, 'ClaimResponse')) {
      if (claimResponseIds.has(claimResponseId) && !paymentReconciliationIdByClaimResponseId.has(claimResponseId)) {
        paymentReconciliationIdByClaimResponseId.set(claimResponseId, eraPaymentReconciliationIds[0]);
      }
    }
  }

  const paymentReconciliations =
    paymentReconciliationIds.size > 0
      ? await fetchPaymentReconciliationsByIds(oystehr, [...paymentReconciliationIds])
      : [];

  return {
    paymentReconciliations,
    paymentReconciliationIdByClaimResponseId,
    agentRefByPaymentReconciliationId,
  };
}

// Oystehr records each submission of a claim to the payer as a ClaimResponse with outcome 'queued'.
// 277 claim-status responses (their event identifier) and ERA remits (the CLP02 stamp, adjudicated
// lines) are not submissions even when they share that outcome.
function isClaimSubmissionResponse(claimResponse: ClaimResponse): boolean {
  if (claimResponse.outcome !== 'queued') return false;

  if (claimResponse.identifier?.some((identifier) => identifier.system === CLAIM_STATUS_RESPONSE_EVENT_SYSTEM)) {
    return false;
  }

  if (hasEraStatusCode(claimResponse)) return false;

  return allAdjudications(claimResponse).length === 0;
}

// When the claim was first sent to the payer: the earliest submission response, '' when none.
export function firstSubmittedDate(claimResponses: ClaimResponse[]): string {
  const submissions = claimResponses
    .filter(isClaimSubmissionResponse)
    .map((claimResponse) => ({
      created: claimResponse.created,
      millis: DateTime.fromISO(claimResponse.created ?? '').toMillis(),
    }))
    .filter((submission) => Number.isFinite(submission.millis))
    .sort((a, b) => a.millis - b.millis);

  return submissions[0]?.created ?? '';
}

// Submission responses are untagged, so this needs the ERA read client.
export async function fetchClaimFirstSubmittedDate(oystehr: Oystehr, claimId: string): Promise<string> {
  const claimResponsesByClaimId = await fetchResourcesGrouped<ClaimResponse>({
    oystehr,
    resourceType: 'ClaimResponse',
    ids: [claimId],
    buildParam: (batch) => [
      {
        name: 'request',
        value: batch.map((id) => `Claim/${id}`).join(','),
      },
      {
        name: 'outcome',
        value: 'queued',
      },
    ],
    groupKeyOf: (claimResponse) => claimResponse.request?.reference?.replace('Claim/', ''),
  });

  return firstSubmittedDate(claimResponsesByClaimId.get(claimId) ?? []);
}

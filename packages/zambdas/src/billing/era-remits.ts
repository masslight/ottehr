import {
  Claim,
  ClaimItem,
  ClaimResponse,
  ClaimResponseItem,
  Coverage,
  FhirResource,
  Identifier,
  Organization,
} from 'fhir/r4b';
import { getNPI, getTaxID } from 'utils/lib/fhir/helpers';
import { asEraClaimStatusCode, X12_ADJUSTMENT_GROUP_CODE } from 'utils/lib/types/data/billing/billing.constants';
import {
  ClaimRemitAdjustment,
  EraClaimRemit,
  EraPayee,
  EraRemitServiceLine,
} from 'utils/lib/types/data/billing/billing.types';
import { patientRespBuckets } from 'utils/lib/types/data/billing/carc';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { extractClaimResponseAmounts, extractLineAmounts, extractRemitAdjustments } from './claim-amounts';
import {
  ERA_ICN_EXTENSION,
  ERA_ITEM_PROCEDURE_CODE_EXTENSION,
  ERA_ITEM_UNITS_EXTENSION,
  ERA_PCN_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
  getClaimPcn,
  getEraExtensionString,
} from './shared';

// CLP01 patient control number as the payer echoed it back. The converter stamps it on the
// ClaimResponse; our own claim's PCN is only a fallback, and matters only for matched rows (the
// contained claim of an unmatched row carries no identifier, and its id is synthetic by this point).
export function eraPatientAccountNumber(
  claimResponses: ClaimResponse[],
  claim: Claim | undefined,
  matched: boolean
): string {
  const echoed = claimResponses.map((cr) => getEraExtensionString(cr, ERA_PCN_EXTENSION)).find(Boolean);
  if (echoed) return echoed;
  return matched && claim ? getClaimPcn(claim) : '';
}

// The member id the payer reported the insured under. In the 835 it rides on NM1*IL NM109 when
// the patient is not the subscriber, and on the patient's own NM1*QC (qualifier MI) when they are
// — NM1*IL is situational. The converter writes it onto the unmatched remit's contained resources;
// matched remits lose their contained resources, so matched rows read the claim's own Coverage
// instead. Checked in order: the contained Coverage's subscriberId, a member-number identifier on
// the subscriber resource that Coverage points at, on the Coverage itself, then on the contained
// patient.
export function eraContainedMemberId(claimResponse: ClaimResponse): string {
  const contained = claimResponse.contained ?? [];
  const byLocalRef = (reference: string | undefined): FhirResource | undefined =>
    reference?.startsWith('#') ? contained.find((resource) => resource.id === reference.slice(1)) : undefined;

  const coverage = contained.find((resource): resource is Coverage => resource.resourceType === 'Coverage');
  if (coverage?.subscriberId) return coverage.subscriberId;

  // prefer a v2-0203 MB (member number) typed identifier; untyped identifiers count only on
  // resources whose sole job is to identify the insured
  const memberIdentifierOf = (resource: FhirResource | undefined, typedOnly = false): string | undefined => {
    const identifiers = (resource as { identifier?: Identifier[] } | undefined)?.identifier ?? [];
    const typed = identifiers.find((identifier) => identifier.type?.coding?.some((coding) => coding.code === 'MB'));
    if (typed?.value) return typed.value;
    return typedOnly ? undefined : identifiers[0]?.value;
  };

  return (
    memberIdentifierOf(byLocalRef(coverage?.subscriber?.reference)) ??
    memberIdentifierOf(coverage) ??
    // the patient can also carry a medical record number (REF*EA), so only a typed member-number
    // identifier counts here — an untyped MRN must not masquerade as the member id
    memberIdentifierOf(byLocalRef(claimResponse.patient?.reference), true) ??
    ''
  );
}

function itemProcedureCode(item: ClaimResponseItem): string {
  return getEraExtensionString(item, ERA_ITEM_PROCEDURE_CODE_EXTENSION) ?? '';
}

// SVC05 units. The converter stamps 0 on every line of some ERAs, including lines it paid in
// full, so 0 means "the payer didn't report units" rather than a service delivered zero times.
function itemUnits(item: ClaimResponseItem): number | null {
  const units = item.extension?.find((ext) => ext.url === ERA_ITEM_UNITS_EXTENSION)?.valueQuantity?.value;
  return units ? units : null;
}

// Assign each adjudicated line the submitted claim line it describes, used only to enrich what
// the remit omits (modifiers, date of service, submitted charge).
//
// Oystehr's RCM stamps REF*6R line item control numbers (from Claim.item.sequence) onto the
// outgoing 837 and aligns ClaimResponse.item.itemSequence back to them when the payer echoes
// them, so a sequence join is exact when that round-trip worked — including claims that repeat a
// procedure code. Payers that don't echo leave itemSequence positional (ERA line order; observed
// on real ERAs), so a sequence join only counts when the submitted line's procedure code
// corroborates it. Everything else falls back to one-to-one greedy assignment by procedure code,
// preferring the line whose submitted charge matches the payer's, never reusing a line; remit
// lines left without a counterpart stay unenriched for the billers to reconcile.
function assignSubmittedLines(lineItems: ClaimResponseItem[], claim: Claim | undefined): (ClaimItem | undefined)[] {
  const assigned: (ClaimItem | undefined)[] = lineItems.map(() => undefined);
  const items = [...(claim?.item ?? [])].sort((a, b) => a.sequence - b.sequence);
  if (items.length === 0) return assigned;
  const consumed = new Set<ClaimItem>();

  const hasCode = (item: ClaimItem, code: string): boolean =>
    item.productOrService?.coding?.some((coding) => coding.code === code) ?? false;

  // the REF*6R round-trip: sequence joins, corroborated by procedure code when the remit has one
  lineItems.forEach((lineItem, index) => {
    const bySequence = items.find((item) => item.sequence === lineItem.itemSequence);
    if (!bySequence || consumed.has(bySequence)) return;
    const code = itemProcedureCode(lineItem);
    if (code && !hasCode(bySequence, code)) return;
    assigned[index] = bySequence;
    consumed.add(bySequence);
  });

  lineItems.forEach((lineItem, index) => {
    if (assigned[index]) return;
    const code = itemProcedureCode(lineItem);
    if (!code) return;
    const candidates = items.filter((item) => !consumed.has(item) && hasCode(item, code));
    if (candidates.length === 0) return;
    const charge = extractLineAmounts(lineItem.adjudication).billed;
    const byCharge = charge == null ? undefined : candidates.find((item) => item.net?.value === charge);
    const chosen = byCharge ?? candidates[0];
    assigned[index] = chosen;
    consumed.add(chosen);
  });

  return assigned;
}

function buildServiceLine(
  item: ClaimResponseItem,
  submitted: ClaimItem | undefined,
  claimLevelDate: string,
  claimLevel: boolean
): EraRemitServiceLine {
  const cptCode = itemProcedureCode(item);
  const amounts = extractLineAmounts(item.adjudication);
  const buckets = patientRespBuckets(amounts.adjustments);
  return {
    itemSequence: item.itemSequence ?? null,
    claimItemSequence: submitted?.sequence ?? null,
    isClaimLevel: claimLevel,
    cptCode: cptCode || submitted?.productOrService?.coding?.[0]?.code || '',
    modifiers: (submitted?.modifier ?? []).map((modifier) => modifier.coding?.[0]?.code ?? '').filter(Boolean),
    units: itemUnits(item) ?? submitted?.quantity?.value ?? null,
    // Neither converter preserves the SVC loop's DTM 472 line service date, so this is the
    // submitted line's date where we can identify it, and the claim's date otherwise.
    serviceDate: submitted?.servicedPeriod?.start ?? submitted?.servicedDate ?? claimLevelDate,
    billed: amounts.billed ?? submitted?.net?.value ?? null,
    allowed: amounts.allowed ?? null,
    paid: amounts.paid,
    deductible: buckets.deductible,
    coinsurance: buckets.coinsurance,
    copay: buckets.copay,
    adjustments: amounts.adjustments,
  };
}

export function buildEraRemitServiceLines(
  claimResponse: ClaimResponse,
  claim: Claim | undefined
): EraRemitServiceLine[] {
  const contained = claimResponse.contained?.find((resource): resource is Claim => resource.resourceType === 'Claim');
  const claimLevelDate =
    claim?.item?.[0]?.servicedPeriod?.start ??
    claim?.item?.[0]?.servicedDate ??
    claim?.created ??
    contained?.created ??
    '';

  // The process-era converter parks claim-level CAS adjustments in an addItem bucket coded
  // 'unknown'; a real procedure code there means it is a genuine payer-added line.
  const addItems = (claimResponse.addItem ?? []).map((addItem) => {
    const code = addItem.productOrService?.coding?.[0]?.code;
    const asItem: ClaimResponseItem = {
      itemSequence: addItem.itemSequence?.[0] ?? 0,
      adjudication: addItem.adjudication,
      extension: addItem.extension,
    };
    return { addItem, asItem, code, claimLevel: !code || code === 'unknown' };
  });

  // claim-level buckets never describe a submitted line, so they sit out the assignment
  const items = claimResponse.item ?? [];
  const assignableAddItems = addItems.filter((entry) => !entry.claimLevel);
  const assigned = assignSubmittedLines([...items, ...assignableAddItems.map((entry) => entry.asItem)], claim);
  const addItemAssigned = new Map(assignableAddItems.map((entry, index) => [entry, assigned[items.length + index]]));

  return [
    ...items.map((item, index) => buildServiceLine(item, assigned[index], claimLevelDate, false)),
    ...addItems.map((entry) => {
      const { addItem, asItem, code, claimLevel } = entry;
      const line = buildServiceLine(asItem, addItemAssigned.get(entry), claimLevel ? '' : claimLevelDate, claimLevel);
      return {
        ...line,
        itemSequence: addItem.itemSequence?.[0] ?? null,
        cptCode: claimLevel ? '' : line.cptCode || code || '',
        serviceDate: addItem.servicedPeriod?.start ?? addItem.servicedDate ?? line.serviceDate,
      };
    }),
  ];
}

// PR-group adjustments aggregated across the whole remit, amounts summed per CARC reason code —
// the "patient responsibility reason codes" of the claim.
function aggregatePatientRespAdjustments(adjustments: ClaimRemitAdjustment[]): ClaimRemitAdjustment[] {
  const byReason = new Map<string, ClaimRemitAdjustment>();
  for (const adjustment of adjustments) {
    if (adjustment.groupCode !== X12_ADJUSTMENT_GROUP_CODE.patientResponsibility) continue;
    const existing = byReason.get(adjustment.reasonCode);
    if (existing) {
      existing.amount = roundNumberToDecimalPlaces(existing.amount + adjustment.amount, 2);
    } else {
      byReason.set(adjustment.reasonCode, { ...adjustment });
    }
  }
  return [...byReason.values()];
}

export function buildEraClaimRemit(claimResponse: ClaimResponse, claim: Claim | undefined): EraClaimRemit {
  const amounts = extractClaimResponseAmounts(claimResponse);
  const serviceLines = buildEraRemitServiceLines(claimResponse, claim);
  return {
    claimResponseId: claimResponse.id ?? '',
    created: claimResponse.created ?? '',
    outcome: claimResponse.outcome ?? '',
    disposition: claimResponse.disposition ?? '',
    eraStatusCode: asEraClaimStatusCode(getEraExtensionString(claimResponse, ERA_STATUS_CODE_EXTENSION)),
    payerClaimControlNumber:
      getEraExtensionString(claimResponse, ERA_ICN_EXTENSION) ?? claimResponse.identifier?.[0]?.value ?? '',
    allowed: amounts.allowed ?? null,
    paid: amounts.paid,
    patientResp: amounts.patientResp ?? null,
    patientRespAdjustments: aggregatePatientRespAdjustments(extractRemitAdjustments(claimResponse)),
    serviceLines,
    notes: (claimResponse.processNote ?? []).map((note) => note.text ?? '').filter(Boolean),
  };
}

function payeeFromOrganization(org: Organization): EraPayee | null {
  const name = org.name ?? '';
  const npi = getNPI(org) ?? '';
  const taxId = getTaxID(org) ?? '';
  if (!name && !npi && !taxId) return null;
  return { name, npi, taxId };
}

// N1*PE payee (the billing provider the check pays). The converter does not put it on the
// PaymentReconciliation; it replicates it onto each unmatched ClaimResponse as a contained
// Organization referenced by the contained Claim's provider. Matched responses lose their
// contained resources, so an ERA whose claims are all matched has no payee to show.
export function resolveEraPayee(claimResponses: ClaimResponse[]): EraPayee | null {
  for (const claimResponse of claimResponses) {
    const contained = claimResponse.contained ?? [];
    const claim = contained.find((resource): resource is Claim => resource.resourceType === 'Claim');
    const providerRef = claim?.provider?.reference;
    const organizations = contained.filter(
      (resource): resource is Organization => resource.resourceType === 'Organization'
    );
    const org = providerRef?.startsWith('#')
      ? organizations.find((candidate) => candidate.id === providerRef.slice(1))
      : organizations[0];
    const payee = org ? payeeFromOrganization(org) : null;
    if (payee) return payee;
  }
  return null;
}

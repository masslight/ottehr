import { Claim, ClaimItem, ClaimResponse, ClaimResponseItem, Organization } from 'fhir/r4b';
import {
  asEraClaimStatusCode,
  ClaimRemitAdjustment,
  EraClaimRemit,
  EraPayee,
  EraRemitServiceLine,
  getNPI,
  getTaxID,
  patientRespBuckets,
  roundNumberToDecimalPlaces,
  X12_ADJUSTMENT_GROUP_CODE,
} from 'utils';
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

function itemProcedureCode(item: ClaimResponseItem): string {
  return getEraExtensionString(item, ERA_ITEM_PROCEDURE_CODE_EXTENSION) ?? '';
}

// SVC05 units. The converter stamps 0 on every line of some ERAs, including lines it paid in
// full, so 0 means "the payer didn't report units" rather than a service delivered zero times.
function itemUnits(item: ClaimResponseItem): number | null {
  const units = item.extension?.find((ext) => ext.url === ERA_ITEM_UNITS_EXTENSION)?.valueQuantity?.value;
  return units ? units : null;
}

// The submitted line this adjudicated line describes, used only to enrich what the remit omits
// (modifiers, date of service, submitted charge). Matched on procedure code: the ERA's line order
// need not agree with ours, so a remit line whose code we can't find is left unenriched rather
// than borrowing another service's details by sequence. Sequence is the fallback only when the
// remit line carries no code at all. Matching on a real Claim only — a matched ClaimResponse has
// no contained resources (Oystehr drops them on match) and an unmatched one's contained Claim
// carries no items.
function findSubmittedLine(
  claim: Claim | undefined,
  procedureCode: string,
  sequence: number | undefined
): ClaimItem | undefined {
  const items = claim?.item ?? [];
  if (items.length === 0) return undefined;
  if (procedureCode) {
    return items.find((item) => item.productOrService?.coding?.some((coding) => coding.code === procedureCode));
  }
  return sequence == null ? undefined : items.find((item) => item.sequence === sequence);
}

function buildServiceLine(
  item: ClaimResponseItem,
  claim: Claim | undefined,
  claimLevelDate: string,
  claimLevel: boolean
): EraRemitServiceLine {
  const cptCode = itemProcedureCode(item);
  const submitted = findSubmittedLine(claim, cptCode, item.itemSequence);
  const amounts = extractLineAmounts(item.adjudication);
  const buckets = patientRespBuckets(amounts.adjustments);
  return {
    itemSequence: item.itemSequence ?? null,
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

  return [
    ...(claimResponse.item ?? []).map((item) => buildServiceLine(item, claim, claimLevelDate, false)),
    // The process-era converter parks claim-level CAS adjustments in an addItem bucket coded
    // 'unknown'; a real procedure code there means it is a genuine payer-added line.
    ...(claimResponse.addItem ?? []).map((addItem) => {
      const code = addItem.productOrService?.coding?.[0]?.code;
      const asItem: ClaimResponseItem = {
        itemSequence: addItem.itemSequence?.[0] ?? 0,
        adjudication: addItem.adjudication,
        extension: addItem.extension,
      };
      const claimLevel = !code || code === 'unknown';
      const line = buildServiceLine(asItem, claim, claimLevel ? '' : claimLevelDate, claimLevel);
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

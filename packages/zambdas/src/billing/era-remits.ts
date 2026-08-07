import Oystehr from '@oystehr/sdk';
import {
  Claim,
  ClaimItem,
  ClaimResponse,
  Organization,
  PaymentReconciliation,
  Practitioner,
  Reference,
} from 'fhir/r4b';
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
import { CLAIM_PCN_IDENTIFIER_SYSTEM, ERA_STATUS_CODE_EXTENSION, fhirName, getClaimPcn } from './shared';

// CLP01 patient control number. Matched claims round-trip getClaimPcn (its dash-stripped-id
// fallback is the value Oystehr matched on); unmatched rows get a synthetic 'unmatched-*' id
// before mapping, so only an identifier echoed on the contained claim counts there.
export function eraPatientAccountNumber(claim: Claim | undefined, matched: boolean): string {
  if (!claim) return '';
  if (matched) return getClaimPcn(claim);
  return (
    claim.identifier?.find((id) => id.system === CLAIM_PCN_IDENTIFIER_SYSTEM)?.value ??
    claim.identifier?.[0]?.value ??
    ''
  );
}

function findClaimItem(claim: Claim | undefined, sequence: number | undefined): ClaimItem | undefined {
  if (sequence == null) return undefined;
  return claim?.item?.find((item) => item.sequence === sequence);
}

// The submitted line to join an adjudicated line back to: the matched claim first, then the
// converter's contained claim — a manual match can attach a remit to a claim whose line sequences
// don't correspond, and the contained original still has the ERA's own SVC data.
function joinableClaims(claimResponse: ClaimResponse, claim: Claim | undefined): (Claim | undefined)[] {
  const contained = claimResponse.contained?.find((resource): resource is Claim => resource.resourceType === 'Claim');
  return claim === contained ? [claim] : [claim, contained];
}

export function buildEraRemitServiceLines(
  claimResponse: ClaimResponse,
  claim: Claim | undefined
): EraRemitServiceLine[] {
  const claims = joinableClaims(claimResponse, claim);
  const lines: EraRemitServiceLine[] = [];

  for (const item of claimResponse.item ?? []) {
    const claimItem = claims.map((c) => findClaimItem(c, item.itemSequence)).find(Boolean);
    const amounts = extractLineAmounts(item.adjudication);
    const buckets = patientRespBuckets(amounts.adjustments);
    lines.push({
      itemSequence: item.itemSequence ?? null,
      isClaimLevel: false,
      cptCode: claimItem?.productOrService?.coding?.[0]?.code ?? '',
      modifiers: (claimItem?.modifier ?? []).map((m) => m.coding?.[0]?.code ?? '').filter(Boolean),
      units: claimItem?.quantity?.value ?? null,
      serviceDate: claimItem?.servicedPeriod?.start ?? claimItem?.servicedDate ?? '',
      billed: amounts.billed ?? claimItem?.net?.value ?? null,
      allowed: amounts.allowed ?? null,
      paid: amounts.paid,
      deductible: buckets.deductible,
      coinsurance: buckets.coinsurance,
      copay: buckets.copay,
      adjustments: amounts.adjustments,
    });
  }

  for (const addItem of claimResponse.addItem ?? []) {
    const sequence = addItem.itemSequence?.[0];
    const claimItem = claims.map((c) => findClaimItem(c, sequence)).find(Boolean);
    const addItemCode = addItem.productOrService?.coding?.[0]?.code;
    // both converters stamp 'unknown' on the addItem bucket that carries claim-level CAS
    const cptCode =
      (addItemCode && addItemCode !== 'unknown' ? addItemCode : undefined) ??
      claimItem?.productOrService?.coding?.[0]?.code ??
      '';
    const amounts = extractLineAmounts(addItem.adjudication);
    const buckets = patientRespBuckets(amounts.adjustments);
    lines.push({
      itemSequence: sequence ?? null,
      isClaimLevel: !cptCode,
      cptCode,
      modifiers: (addItem.modifier ?? []).map((m) => m.coding?.[0]?.code ?? '').filter(Boolean),
      units: addItem.quantity?.value ?? claimItem?.quantity?.value ?? null,
      serviceDate:
        addItem.servicedPeriod?.start ??
        addItem.servicedDate ??
        claimItem?.servicedPeriod?.start ??
        claimItem?.servicedDate ??
        '',
      billed: amounts.billed ?? claimItem?.net?.value ?? null,
      allowed: amounts.allowed ?? null,
      paid: amounts.paid,
      deductible: buckets.deductible,
      coinsurance: buckets.coinsurance,
      copay: buckets.copay,
      adjustments: amounts.adjustments,
    });
  }

  return lines;
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
  return {
    claimResponseId: claimResponse.id ?? '',
    created: claimResponse.created ?? '',
    outcome: claimResponse.outcome ?? '',
    disposition: claimResponse.disposition ?? '',
    eraStatusCode: asEraClaimStatusCode(
      claimResponse.extension?.find((ext) => ext.url === ERA_STATUS_CODE_EXTENSION)?.valueString
    ),
    payerClaimControlNumber: claimResponse.identifier?.[0]?.value ?? '',
    allowed: amounts.allowed ?? null,
    paid: amounts.paid,
    patientResp: amounts.patientResp ?? null,
    patientRespAdjustments: aggregatePatientRespAdjustments(extractRemitAdjustments(claimResponse)),
    serviceLines: buildEraRemitServiceLines(claimResponse, claim),
    notes: (claimResponse.processNote ?? []).map((note) => note.text ?? '').filter(Boolean),
  };
}

function payeeFromResource(resource: Organization | Practitioner): EraPayee | null {
  const name = resource.resourceType === 'Organization' ? resource.name ?? '' : fhirName(resource);
  const npi = getNPI(resource) ?? '';
  const taxId = getTaxID(resource) ?? '';
  if (!name && !npi && !taxId) return null;
  return { name, npi, taxId };
}

async function resolvePayeeRef(
  eraReadClient: Oystehr,
  pr: PaymentReconciliation,
  ref: Reference
): Promise<EraPayee | null> {
  if (ref.reference?.startsWith('#')) {
    const containedId = ref.reference.slice(1);
    const contained = pr.contained?.find((resource) => resource.id === containedId);
    if (contained && (contained.resourceType === 'Organization' || contained.resourceType === 'Practitioner')) {
      const payee = payeeFromResource(contained);
      if (payee) return payee;
    }
  } else if (ref.reference) {
    const [resourceType, id] = ref.reference.split('/');
    if ((resourceType === 'Organization' || resourceType === 'Practitioner') && id) {
      try {
        const resource = await eraReadClient.fhir.get<Organization | Practitioner>({ resourceType, id });
        const payee = payeeFromResource(resource);
        if (payee) return payee;
      } catch (error) {
        console.error(`Failed to resolve ERA payee ${ref.reference}:`, error);
      }
    }
  }
  if (ref.display) return { name: ref.display, npi: '', taxId: '' };
  return null;
}

// N1*PE payee (the billing provider the check pays). Neither converter has been observed writing
// it, so every candidate is optional: PaymentReconciliation.requestor, then detail[].payee —
// contained '#refs' resolved locally, real references fetched on the untagged ERA client, a bare
// Reference.display as last resort. Null when the ERA carries nothing.
export async function resolveEraPayee(eraReadClient: Oystehr, pr: PaymentReconciliation): Promise<EraPayee | null> {
  const candidates = [pr.requestor, ...(pr.detail ?? []).map((detail) => detail.payee)].filter(
    (ref): ref is Reference => ref != null
  );
  for (const ref of candidates) {
    const payee = await resolvePayeeRef(eraReadClient, pr, ref);
    if (payee) return payee;
  }
  return null;
}

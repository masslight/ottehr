import {
  Claim,
  ClaimResponse,
  ClaimResponseItem,
  ClaimResponseItemAdjudication,
  Coverage,
  Extension,
  HumanName,
  Organization,
  Patient,
  PaymentReconciliation,
  Provenance,
  Reference,
} from 'fhir/r4b';
import { codeableConcept, setNpi } from 'utils/lib/fhir/helpers';
import { extractPayerIdFromUrl } from 'utils/lib/helpers/helpers';
import {
  CODE_SYSTEM_CLAIM_TYPE,
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HL7_HCPCS,
  CODE_SYSTEM_PROCESS_PRIORITY,
} from 'utils/lib/helpers/rcm/constants';
import {
  asEraClaimStatusCode,
  ERA_CLAIM_STATUS_CODE,
  ERA_PAYMENT_METHODS,
  ERA_SOURCE,
  EraPaymentMethodCode,
} from 'utils/lib/types/data/billing/billing.constants';
import {
  ManualEraAdjustment,
  ManualEraClaim,
  ManualEraHeader,
  ManualEraServiceLine,
} from 'utils/lib/types/data/billing/billing.schemas';
import { ManualEraEntry, ManualEraEntryClaim } from 'utils/lib/types/data/billing/billing.types';
import {
  ADJUDICATION_CODES,
  extractLineAmounts,
  isMatchedToClaim,
  OYSTEHR_ADJUDICATION_SYSTEM,
  X12_ADJUSTMENT_GROUP_SYSTEM,
} from './claim-amounts';
import {
  ERA_CHECK_SYSTEM,
  ERA_DEPOSIT_DATE_EXTENSION,
  ERA_ICN_EXTENSION,
  ERA_ITEM_PROCEDURE_CODE_EXTENSION,
  ERA_ITEM_REMARK_CODE_EXTENSION,
  ERA_LAST_EDITED_EXTENSION,
  ERA_PCN_EXTENSION,
  ERA_PROCESSING_ACTIVITY_CODE,
  ERA_REMIT_DATE_EXTENSION,
  ERA_SOURCE_EXTENSION,
  ERA_STATUS_CODE_EXTENSION,
  getEraCheckNumber,
  getEraExtensionString,
  MANUAL_ERA_IDEMPOTENCY_SYSTEM,
  PROVENANCE_ACTIVITY_TYPE_SYSTEM,
  setTaxId,
  X12_PAYMENT_METHOD_SYSTEM,
} from './shared';

// A manually keyed remit is written in the shape Oystehr's ERA converters produce — one
// PaymentReconciliation, one ClaimResponse per claim, and one era-processing Provenance linking them —
// so the ERA list and detail, matching, posting (claim-amounts.ts), statements and reports read it
// like any other ERA. Unmatched ClaimResponses carry the contained resources the converter writes for
// unmatched remits (and unmatch-claim-response restores from), matched ones keep them too.

export const CARC_REASON_SYSTEM = 'https://x12.org/codes/claim-adjustment-reason-codes';

// contained resource ids; unmatch-claim-response and the ERA readers look these up
const CONTAINED = {
  claim: 'request',
  patient: 'patient',
  billingProvider: 'billing-provider',
  coverage: 'coverage',
} as const;

const UNKNOWN_CLAIM_TYPE = (): Claim['type'] => codeableConcept('unknown', CODE_SYSTEM_CLAIM_TYPE, 'Unknown');

export interface ManualEraPayer {
  // payer list URL (getPayerUrl) and its "Name (Payer ID)" display
  reference: string;
  display: string;
}

export interface ManualEraBillingProvider {
  // Organization/<id> or Practitioner/<id>
  reference: string;
  name: string;
  npi?: string;
  taxId?: string;
}

export interface ManualEraContext {
  payer: ManualEraPayer;
  billingProvider: ManualEraBillingProvider;
}

export const toDollars = (cents: number): number => cents / 100;
export const toCents = (dollars: number): number => Math.round(dollars * 100);

const money = (cents: number): { value: number; currency: string } => ({ value: toDollars(cents), currency: 'USD' });

const amountAdjudication = (code: string, cents: number): ClaimResponseItemAdjudication => ({
  category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code }] },
  amount: money(cents),
});

const adjustmentAdjudication = (adjustment: ManualEraAdjustment): ClaimResponseItemAdjudication => ({
  category: { coding: [{ system: X12_ADJUSTMENT_GROUP_SYSTEM, code: adjustment.groupCode }] },
  reason: { coding: [{ system: CARC_REASON_SYSTEM, code: adjustment.reasonCode }] },
  amount: money(adjustment.amountCents),
});

const extensionValueDate = (resource: { extension?: Extension[] }, url: string): string =>
  resource.extension?.find((ext) => ext.url === url)?.valueDate ?? '';

// "Last, First Middle" or "First Middle Last"; a single word is taken as the last name (NM103 is the
// one name an 835 always carries).
export function parsePatientName(text: string): HumanName {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  const [lastPart, firstPart] = trimmed.includes(',')
    ? trimmed.split(',', 2).map((part) => part.trim())
    : [trimmed.split(' ').at(-1) ?? '', trimmed.split(' ').slice(0, -1).join(' ')];
  const given = (firstPart ?? '').split(' ').filter(Boolean);
  return { text: trimmed, family: lastPart || trimmed, ...(given.length ? { given } : {}) };
}

function patientNameText(patient: Patient | undefined): string {
  const name = patient?.name?.[0];
  if (!name) return '';
  return name.text ?? [...(name.given ?? []), name.family].filter(Boolean).join(' ');
}

const procedureCoding = (code: string): { system: string; code: string } => ({
  // CPT codes are numeric (Category II/III end in F/T); HCPCS Level II codes start with a letter
  system: /^[A-Z]/.test(code) ? CODE_SYSTEM_HL7_HCPCS : CODE_SYSTEM_CPT,
  code,
});

// Line sequences: kept when the line already has one (a line of an associated claim carries that
// claim line's sequence), otherwise the next free number, so every item has a unique itemSequence.
export function assignItemSequences(lines: ManualEraServiceLine[]): number[] {
  const used = new Set<number>();
  const sequences = lines.map((line) => {
    if (line.itemSequence && !used.has(line.itemSequence)) {
      used.add(line.itemSequence);
      return line.itemSequence;
    }
    return undefined;
  });
  let next = 1;
  return sequences.map((sequence) => {
    if (sequence !== undefined) return sequence;
    while (used.has(next)) next += 1;
    used.add(next);
    return next;
  });
}

const claimServiceDate = (claim: ManualEraClaim): string =>
  claim.serviceDate ?? [...claim.serviceLines.map((line) => line.serviceDate)].sort()[0] ?? '';

export function buildManualPaymentReconciliation(args: {
  header: ManualEraHeader;
  context: ManualEraContext;
  // first save; kept on every later save
  created: string;
  editedAt: string;
  idempotencyKey?: string;
  existing?: PaymentReconciliation;
}): PaymentReconciliation {
  const { header, context, existing } = args;
  const method = ERA_PAYMENT_METHODS.find((candidate) => candidate.code === header.paymentMethod);
  const idempotencyIdentifier =
    existing?.identifier?.find((id) => id.system === MANUAL_ERA_IDEMPOTENCY_SYSTEM) ??
    (args.idempotencyKey ? { system: MANUAL_ERA_IDEMPOTENCY_SYSTEM, value: args.idempotencyKey } : undefined);
  return {
    resourceType: 'PaymentReconciliation',
    ...(existing?.id ? { id: existing.id } : {}),
    extension: [
      { url: ERA_SOURCE_EXTENSION, valueCode: ERA_SOURCE.manual },
      { url: ERA_REMIT_DATE_EXTENSION, valueDate: header.remitDate },
      { url: ERA_DEPOSIT_DATE_EXTENSION, valueDate: header.depositDate },
      { url: ERA_LAST_EDITED_EXTENSION, valueDateTime: args.editedAt },
    ],
    identifier: [
      { system: ERA_CHECK_SYSTEM, value: header.checkNumber },
      ...(idempotencyIdentifier ? [idempotencyIdentifier] : []),
    ],
    status: 'active',
    outcome: 'complete',
    created: args.created,
    paymentIssuer: { reference: context.payer.reference, display: context.payer.display },
    requestor: { reference: context.billingProvider.reference, display: context.billingProvider.name },
    paymentDate: header.checkDate,
    paymentAmount: money(header.checkAmountCents),
    paymentIdentifier: {
      system: ERA_CHECK_SYSTEM,
      value: header.checkNumber,
      ...(method
        ? { type: { coding: [{ system: X12_PAYMENT_METHOD_SYSTEM, code: method.code, display: method.label }] } }
        : {}),
    },
    ...(header.notes ? { processNote: [{ type: 'display' as const, text: header.notes }] } : {}),
  };
}

// The Claim fields a remit claim associated with it at entry takes over, as match-claim-response
// sets them.
export type MatchedClaimFields = Pick<Claim, 'id' | 'patient' | 'type'>;

export function buildManualClaimResponse(args: {
  claim: ManualEraClaim;
  header: ManualEraHeader;
  context: ManualEraContext;
  // the Claim a new remit claim is associated with
  matchedClaim?: MatchedClaimFields;
  // the stored response when updating; its match state (request / patient / type) is kept
  existing?: ClaimResponse;
}): ClaimResponse {
  const { claim, header, context, matchedClaim, existing } = args;
  const sequences = assignItemSequences(claim.serviceLines);
  const serviceDate = claimServiceDate(claim);
  const lineDates = claim.serviceLines.map((line) => line.serviceDate).sort();
  const billedCents = claim.serviceLines.reduce((sum, line) => sum + line.billedCents, 0);
  const paidCents = claim.serviceLines.reduce((sum, line) => sum + line.paidCents, 0);

  const billingProvider: Organization = { resourceType: 'Organization', id: CONTAINED.billingProvider };
  if (context.billingProvider.name) billingProvider.name = context.billingProvider.name;
  if (context.billingProvider.npi) setNpi(billingProvider, context.billingProvider.npi);
  if (context.billingProvider.taxId) setTaxId(billingProvider, context.billingProvider.taxId);

  const patient: Patient = {
    resourceType: 'Patient',
    id: CONTAINED.patient,
    name: [parsePatientName(claim.patientName)],
  };

  const coverage: Coverage = {
    resourceType: 'Coverage',
    id: CONTAINED.coverage,
    status: 'active',
    beneficiary: { reference: `#${CONTAINED.patient}` },
    payor: [{ reference: context.payer.reference, display: context.payer.display }],
    ...(claim.memberId ? { subscriberId: claim.memberId } : {}),
  };

  const containedClaim: Claim = {
    resourceType: 'Claim',
    id: CONTAINED.claim,
    status: 'active',
    type: UNKNOWN_CLAIM_TYPE(),
    use: 'claim',
    patient: { reference: `#${CONTAINED.patient}` },
    billablePeriod: { start: lineDates[0], end: lineDates.at(-1) },
    created: serviceDate,
    insurer: { reference: context.payer.reference, display: context.payer.display },
    provider: { reference: `#${CONTAINED.billingProvider}` },
    priority: codeableConcept('normal', CODE_SYSTEM_PROCESS_PRIORITY, 'Normal'),
    insurance: [{ sequence: 1, focal: true, coverage: { reference: `#${CONTAINED.coverage}` } }],
    item: claim.serviceLines.map((line, index) => ({
      sequence: sequences[index],
      productOrService: { coding: [procedureCoding(line.procedureCode)] },
      servicedPeriod: { start: line.serviceDate, end: line.serviceDate },
      net: money(line.billedCents),
    })),
    total: money(billedCents),
  };

  const matchFields = ((): Pick<ClaimResponse, 'request' | 'patient' | 'type'> => {
    if (existing) return { request: existing.request, patient: existing.patient, type: existing.type };
    if (matchedClaim) {
      return {
        request: { reference: `Claim/${matchedClaim.id}` },
        patient: matchedClaim.patient,
        type: matchedClaim.type,
      };
    }
    return {
      request: { reference: `#${CONTAINED.claim}` },
      patient: { reference: `#${CONTAINED.patient}` },
      type: UNKNOWN_CLAIM_TYPE(),
    };
  })();

  const item: ClaimResponseItem[] = claim.serviceLines.map((line, index) => ({
    itemSequence: sequences[index],
    extension: [
      { url: ERA_ITEM_PROCEDURE_CODE_EXTENSION, valueString: line.procedureCode },
      ...line.remarkCodes.map((code) => ({ url: ERA_ITEM_REMARK_CODE_EXTENSION, valueString: code })),
    ],
    adjudication: [
      amountAdjudication(ADJUDICATION_CODES.CHARGE, line.billedCents),
      ...(line.allowedCents === null ? [] : [amountAdjudication(ADJUDICATION_CODES.ALLOWED, line.allowedCents)]),
      amountAdjudication(ADJUDICATION_CODES.PAID, line.paidCents),
      ...line.adjustments.map(adjustmentAdjudication),
    ],
  }));

  return {
    resourceType: 'ClaimResponse',
    ...(existing?.id ? { id: existing.id } : {}),
    contained: [containedClaim, patient, billingProvider, coverage],
    extension: [
      { url: ERA_STATUS_CODE_EXTENSION, valueString: claim.statusCode },
      ...(claim.patientAccountNumber ? [{ url: ERA_PCN_EXTENSION, valueString: claim.patientAccountNumber }] : []),
      ...(claim.payerClaimControlNumber
        ? [{ url: ERA_ICN_EXTENSION, valueString: claim.payerClaimControlNumber }]
        : []),
    ],
    status: 'active',
    use: 'claim',
    created: header.remitDate,
    insurer: { reference: context.payer.reference, display: context.payer.display },
    outcome: 'complete',
    ...matchFields,
    item,
    total: [
      {
        category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.CHARGE }] },
        amount: money(billedCents),
      },
      {
        category: { coding: [{ system: OYSTEHR_ADJUDICATION_SYSTEM, code: ADJUDICATION_CODES.PAID }] },
        amount: money(paidCents),
      },
    ],
  };
}

export function buildManualEraProvenance(args: {
  // PaymentReconciliation first, then the ClaimResponses in display order (urn:uuid fullUrls allowed)
  targets: string[];
  agent: Reference;
  recorded: string;
  // an update keeps who keyed the remit in, and when
  existing?: Provenance;
}): Provenance {
  const { existing } = args;
  return {
    resourceType: 'Provenance',
    ...(existing?.id ? { id: existing.id } : {}),
    target: args.targets.map((reference) => ({ reference })),
    recorded: existing?.recorded ?? args.recorded,
    activity: { coding: [{ system: PROVENANCE_ACTIVITY_TYPE_SYSTEM, code: ERA_PROCESSING_ACTIVITY_CODE }] },
    agent: existing?.agent ?? [{ who: args.agent }],
  };
}

// --- reading a manual remit back into the editor's shape ---

const isPaymentMethod = (code: string | undefined): code is EraPaymentMethodCode =>
  ERA_PAYMENT_METHODS.some((method) => method.code === code);

export function manualEraHeaderFromFhir(pr: PaymentReconciliation): ManualEraHeader {
  const method = pr.paymentIdentifier?.type?.coding?.[0]?.code;
  const notes = pr.processNote?.[0]?.text;
  return {
    payerId: extractPayerIdFromUrl(pr.paymentIssuer?.reference) ?? '',
    billingProviderRef: pr.requestor?.reference ?? '',
    checkNumber: getEraCheckNumber(pr) ?? '',
    checkAmountCents: toCents(pr.paymentAmount?.value ?? 0),
    ...(isPaymentMethod(method) ? { paymentMethod: method } : {}),
    remitDate: extensionValueDate(pr, ERA_REMIT_DATE_EXTENSION),
    checkDate: pr.paymentDate ?? '',
    depositDate: extensionValueDate(pr, ERA_DEPOSIT_DATE_EXTENSION),
    ...(notes ? { notes } : {}),
  };
}

export function manualEraClaimFromFhir(claimResponse: ClaimResponse): ManualEraEntryClaim {
  const contained = claimResponse.contained ?? [];
  const containedClaim = contained.find((resource): resource is Claim => resource.resourceType === 'Claim');
  const patient = contained.find((resource): resource is Patient => resource.resourceType === 'Patient');
  const coverage = contained.find((resource): resource is Coverage => resource.resourceType === 'Coverage');
  const pcn = getEraExtensionString(claimResponse, ERA_PCN_EXTENSION);
  const icn = getEraExtensionString(claimResponse, ERA_ICN_EXTENSION);

  const serviceLines: ManualEraServiceLine[] = (claimResponse.item ?? []).map((item) => {
    const amounts = extractLineAmounts(item.adjudication);
    const submitted = containedClaim?.item?.find((claimItem) => claimItem.sequence === item.itemSequence);
    return {
      itemSequence: item.itemSequence,
      serviceDate: submitted?.servicedPeriod?.start ?? submitted?.servicedDate ?? containedClaim?.created ?? '',
      procedureCode: getEraExtensionString(item, ERA_ITEM_PROCEDURE_CODE_EXTENSION) ?? '',
      billedCents: toCents(amounts.billed ?? 0),
      allowedCents: amounts.allowed === undefined ? null : toCents(amounts.allowed),
      paidCents: toCents(amounts.paid),
      adjustments: amounts.adjustments.map((adjustment) => ({
        groupCode: adjustment.groupCode,
        reasonCode: adjustment.reasonCode,
        amountCents: toCents(adjustment.amount),
      })),
      remarkCodes: (item.extension ?? [])
        .filter((ext) => ext.url === ERA_ITEM_REMARK_CODE_EXTENSION && ext.valueString)
        .map((ext) => ext.valueString as string),
    };
  });

  return {
    claimResponseId: claimResponse.id ?? '',
    matchedClaimId: isMatchedToClaim(claimResponse)
      ? claimResponse.request?.reference?.replace('Claim/', '') ?? null
      : null,
    statusCode:
      asEraClaimStatusCode(getEraExtensionString(claimResponse, ERA_STATUS_CODE_EXTENSION)) ||
      ERA_CLAIM_STATUS_CODE.primary,
    patientName: patientNameText(patient),
    ...(coverage?.subscriberId ? { memberId: coverage.subscriberId } : {}),
    ...(pcn ? { patientAccountNumber: pcn } : {}),
    ...(icn ? { payerClaimControlNumber: icn } : {}),
    ...(containedClaim?.created ? { serviceDate: containedClaim.created } : {}),
    serviceLines,
  };
}

export function manualEraEntryFromFhir(pr: PaymentReconciliation, claimResponses: ClaimResponse[]): ManualEraEntry {
  return { header: manualEraHeaderFromFhir(pr), claims: claimResponses.map(manualEraClaimFromFhir) };
}

// The editable form of a stored claim, as the save input carries it.
export const entryClaimToInput = (claim: ManualEraEntryClaim): ManualEraClaim => {
  const { claimResponseId, matchedClaimId: _matchedClaimId, ...rest } = claim;
  return { ...rest, claimResponseId };
};

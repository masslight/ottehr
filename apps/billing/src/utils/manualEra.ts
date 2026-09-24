import {
  ERA_CLAIM_STATUS_CODE,
  EraClaimStatusCode,
  EraPaymentMethodCode,
  X12_ADJUSTMENT_GROUP_CODE,
  X12AdjustmentGroupCode,
} from 'utils/lib/types/data/billing/billing.constants';
import { ManualEraClaim, ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { ClaimDetailResponse, ManualEraEntryClaim } from 'utils/lib/types/data/billing/billing.types';
import { PATIENT_RESP_CARC } from 'utils/lib/types/data/billing/carc';

// Form state for keying a remit in by hand. Amounts stay as the text the biller typed ("12.", "")
// and become integer cents only when saving; codes and dates are what the save input carries.

export interface AdjustmentRow {
  key: string;
  groupCode: X12AdjustmentGroupCode | '';
  reasonCode: string;
  amount: string;
}

export interface RemarkRow {
  key: string;
  code: string;
}

export interface ServiceLineForm {
  key: string;
  itemSequence?: number;
  serviceDate: string;
  // the line's DOS follows the claim's Service Date until the biller sets it
  serviceDateFollowsClaim: boolean;
  procedureCode: string;
  billed: string;
  allowed: string;
  paid: string;
  adjustments: AdjustmentRow[];
  remarkCodes: RemarkRow[];
  // the CO-45 row kept at billed − allowed while the biller hasn't touched it
  contractualKey: string | null;
  // the biller edited or removed that row, so the line's contractual adjustment is theirs: no new
  // derived row on this line
  contractualDismissed: boolean;
}

export interface ClaimForm {
  key: string;
  claimResponseId?: string;
  // the Claim this remit claim adjudicates: set when associated at entry, or matched later
  matchedClaimId: string | null;
  statusCode: EraClaimStatusCode;
  patientName: string;
  memberId: string;
  patientAccountNumber: string;
  payerClaimControlNumber: string;
  serviceDate: string;
  serviceLines: ServiceLineForm[];
}

export interface HeaderForm {
  payerId: string;
  billingProviderRef: string;
  checkNumber: string;
  checkAmount: string;
  paymentMethod: EraPaymentMethodCode | '';
  remitDate: string;
  checkDate: string;
  depositDate: string;
  notes: string;
}

let keySeed = 0;
export const newKey = (): string => `k${Date.now().toString(36)}-${(keySeed++).toString(36)}`;

// --- money ---

// "$1,234.5" -> 123450; '' and anything that isn't a dollar amount -> null
export function parseMoneyToCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!/^-?(\d+\.?\d{0,2}|\.\d{1,2})$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

export const isMoneyText = (text: string): boolean => text.trim() === '' || parseMoneyToCents(text) !== null;

// 15000 -> "150", 5025 -> "50.25"
export function formatCentsForInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

const centsOr0 = (text: string): number => parseMoneyToCents(text) ?? 0;

// --- patient responsibility buckets (views over the PR-1/2/3 rows) ---

export type PatientRespBucket = keyof typeof PATIENT_RESP_CARC;

const bucketRows = (line: ServiceLineForm, bucket: PatientRespBucket): AdjustmentRow[] =>
  line.adjustments.filter(
    (row) =>
      row.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility && row.reasonCode === PATIENT_RESP_CARC[bucket]
  );

// Deductible / Co-Ins / Co-Pay are what the PR-1 / PR-2 / PR-3 rows say, so they can never disagree
// with the adjustments that are saved.
export function bucketValue(line: ServiceLineForm, bucket: PatientRespBucket): string {
  const rows = bucketRows(line, bucket);
  if (rows.length === 0) return '';
  if (rows.length === 1) return rows[0].amount;
  return formatCentsForInput(rows.reduce((sum, row) => sum + centsOr0(row.amount), 0));
}

// Two rows with the same code can't be edited through one field; the biller edits the rows instead.
export const bucketIsLocked = (line: ServiceLineForm, bucket: PatientRespBucket): boolean =>
  bucketRows(line, bucket).length > 1;

export function setBucketValue(line: ServiceLineForm, bucket: PatientRespBucket, text: string): ServiceLineForm {
  const rows = bucketRows(line, bucket);
  if (rows.length > 1) return line;
  if (text.trim() === '') {
    return { ...line, adjustments: line.adjustments.filter((row) => row !== rows[0]) };
  }
  if (rows.length === 1) {
    return { ...line, adjustments: line.adjustments.map((row) => (row === rows[0] ? { ...row, amount: text } : row)) };
  }
  const row: AdjustmentRow = {
    key: newKey(),
    groupCode: X12_ADJUSTMENT_GROUP_CODE.patientResponsibility,
    reasonCode: PATIENT_RESP_CARC[bucket],
    amount: text,
  };
  return { ...line, adjustments: [...line.adjustments, row] };
}

// --- CO-45 (billed − allowed), derived until the biller touches it ---

// What the contractual row should be, if anything: CO-45 for the amount above the allowed. When
// nothing is allowed the payer denied the line, and CO-45 may not cover the full charge, so the row
// comes up without a reason code for the biller to choose. A reversal (negative billed) works the
// same way with negative amounts.
function contractualTarget(line: ServiceLineForm): Pick<AdjustmentRow, 'groupCode' | 'reasonCode' | 'amount'> | null {
  const billed = parseMoneyToCents(line.billed);
  const allowed = parseMoneyToCents(line.allowed);
  if (billed === null || allowed === null || billed === 0) return null;
  const group = X12_ADJUSTMENT_GROUP_CODE.contractualObligation;
  if (allowed === 0) return { groupCode: group, reasonCode: '', amount: formatCentsForInput(billed) };
  const difference = billed - allowed;
  if (difference === 0 || Math.sign(difference) !== Math.sign(billed)) return null;
  return { groupCode: group, reasonCode: '45', amount: formatCentsForInput(difference) };
}

// Run after billed or allowed change.
export function syncContractual(line: ServiceLineForm): ServiceLineForm {
  const linked = line.adjustments.find((row) => row.key === line.contractualKey);
  if (!linked && (line.contractualKey || line.contractualDismissed)) {
    return line.contractualKey ? { ...line, contractualKey: null } : line;
  }
  const target = contractualTarget(line);
  if (!target) {
    return linked
      ? { ...line, contractualKey: null, adjustments: line.adjustments.filter((row) => row !== linked) }
      : line;
  }
  if (linked) {
    return { ...line, adjustments: line.adjustments.map((row) => (row === linked ? { ...row, ...target } : row)) };
  }
  const row: AdjustmentRow = { key: newKey(), ...target };
  return { ...line, contractualKey: row.key, adjustments: [row, ...line.adjustments] };
}

// Editing the derived CO-45 by hand makes it the biller's, as does removing it.
const takeOverContractual = (line: ServiceLineForm, key: string): Partial<ServiceLineForm> =>
  line.contractualKey === key ? { contractualKey: null, contractualDismissed: true } : {};

export function updateAdjustment(line: ServiceLineForm, key: string, patch: Partial<AdjustmentRow>): ServiceLineForm {
  return {
    ...line,
    ...takeOverContractual(line, key),
    adjustments: line.adjustments.map((row) => (row.key === key ? { ...row, ...patch } : row)),
  };
}

export function removeAdjustment(line: ServiceLineForm, key: string): ServiceLineForm {
  return {
    ...line,
    ...takeOverContractual(line, key),
    adjustments: line.adjustments.filter((row) => row.key !== key),
  };
}

export function addAdjustment(line: ServiceLineForm): ServiceLineForm {
  return { ...line, adjustments: [...line.adjustments, { key: newKey(), groupCode: '', reasonCode: '', amount: '' }] };
}

// --- service dates ---

// The claim's Service Date flows into the lines that still follow it, and the first date set on a
// line fills a claim date that is still empty.
export function setClaimServiceDate(claim: ClaimForm, serviceDate: string): ClaimForm {
  return {
    ...claim,
    serviceDate,
    serviceLines: claim.serviceLines.map((line) => (line.serviceDateFollowsClaim ? { ...line, serviceDate } : line)),
  };
}

export function setLineServiceDate(claim: ClaimForm, lineKey: string, serviceDate: string): ClaimForm {
  const serviceLines = claim.serviceLines.map((line) =>
    line.key === lineKey ? { ...line, serviceDate, serviceDateFollowsClaim: false } : line
  );
  if (claim.serviceDate || !serviceDate) return { ...claim, serviceLines };
  return setClaimServiceDate({ ...claim, serviceLines }, serviceDate);
}

// --- construction ---

export function emptyServiceLine(claim: Pick<ClaimForm, 'serviceDate' | 'serviceLines'>): ServiceLineForm {
  return {
    key: newKey(),
    serviceDate: claim.serviceDate || claim.serviceLines.at(-1)?.serviceDate || '',
    serviceDateFollowsClaim: true,
    procedureCode: '',
    billed: '',
    allowed: '',
    paid: '',
    adjustments: [],
    remarkCodes: [],
    contractualKey: null,
    contractualDismissed: false,
  };
}

export function emptyClaimForm(overrides: Partial<ClaimForm> = {}): ClaimForm {
  const claim: ClaimForm = {
    key: newKey(),
    matchedClaimId: null,
    statusCode: ERA_CLAIM_STATUS_CODE.primary,
    patientName: '',
    memberId: '',
    patientAccountNumber: '',
    payerClaimControlNumber: '',
    serviceDate: '',
    serviceLines: [],
    ...overrides,
  };
  return claim.serviceLines.length ? claim : { ...claim, serviceLines: [emptyServiceLine(claim)] };
}

export const emptyHeaderForm = (): HeaderForm => ({
  payerId: '',
  billingProviderRef: '',
  checkNumber: '',
  checkAmount: '',
  paymentMethod: '',
  remitDate: '',
  checkDate: '',
  depositDate: '',
  notes: '',
});

// A remit claim for an existing claim, pre-filled from it; the biller keys the adjudication in.
export function claimFormFromClaimDetail(detail: ClaimDetailResponse): ClaimForm {
  const lines = [...detail.serviceLines].sort((a, b) => a.sequence - b.sequence);
  const serviceDate =
    lines
      .map((line) => line.serviceDate)
      .filter(Boolean)
      .sort()[0] ?? '';
  const claim = emptyClaimForm({
    matchedClaimId: detail.id,
    patientName: detail.patientName,
    memberId: detail.memberId || detail.subscriberId || '',
    patientAccountNumber: detail.pcn ?? '',
    serviceDate,
  });
  return {
    ...claim,
    serviceLines: lines.map((line) => ({
      ...emptyServiceLine(claim),
      itemSequence: line.sequence,
      serviceDate: line.serviceDate || serviceDate,
      serviceDateFollowsClaim: !line.serviceDate || line.serviceDate === serviceDate,
      procedureCode: line.cptCode,
      billed: formatCentsForInput(Math.round(line.charges * 100)),
    })),
  };
}

// The editor's form of a stored claim. A CO-45 equal to billed − allowed goes back to being derived.
export function claimFormFromEntry(entry: ManualEraEntryClaim): ClaimForm {
  return {
    key: newKey(),
    claimResponseId: entry.claimResponseId,
    matchedClaimId: entry.matchedClaimId,
    statusCode: entry.statusCode,
    patientName: entry.patientName,
    memberId: entry.memberId ?? '',
    patientAccountNumber: entry.patientAccountNumber ?? '',
    payerClaimControlNumber: entry.payerClaimControlNumber ?? '',
    serviceDate: entry.serviceDate ?? '',
    serviceLines: entry.serviceLines.map((line) => {
      const adjustments: AdjustmentRow[] = line.adjustments.map((adjustment) => ({
        key: newKey(),
        groupCode: adjustment.groupCode,
        reasonCode: adjustment.reasonCode,
        amount: formatCentsForInput(adjustment.amountCents),
      }));
      const contractualRows = adjustments.filter(
        (row) => row.groupCode === X12_ADJUSTMENT_GROUP_CODE.contractualObligation && row.reasonCode === '45'
      );
      const derived =
        contractualRows.length === 1 &&
        line.allowedCents !== null &&
        centsOr0(contractualRows[0].amount) === line.billedCents - line.allowedCents
          ? contractualRows[0]
          : undefined;
      return {
        key: newKey(),
        itemSequence: line.itemSequence,
        serviceDate: line.serviceDate,
        serviceDateFollowsClaim: !!entry.serviceDate && line.serviceDate === entry.serviceDate,
        procedureCode: line.procedureCode,
        billed: formatCentsForInput(line.billedCents),
        allowed: line.allowedCents === null ? '' : formatCentsForInput(line.allowedCents),
        paid: formatCentsForInput(line.paidCents),
        adjustments,
        remarkCodes: line.remarkCodes.map((code) => ({ key: newKey(), code })),
        contractualKey: derived?.key ?? null,
        // a saved line without a derived CO-45 is the biller's to manage
        contractualDismissed: !derived,
      };
    }),
  };
}

export function headerFormFromEntry(header: ManualEraHeader): HeaderForm {
  return {
    payerId: header.payerId,
    billingProviderRef: header.billingProviderRef,
    checkNumber: header.checkNumber,
    checkAmount: formatCentsForInput(header.checkAmountCents),
    paymentMethod: header.paymentMethod ?? '',
    remitDate: header.remitDate,
    checkDate: header.checkDate,
    depositDate: header.depositDate,
    notes: header.notes ?? '',
  };
}

// --- to the save input (call only once the form validates) ---

export function headerFormToInput(header: HeaderForm): ManualEraHeader {
  return {
    payerId: header.payerId,
    billingProviderRef: header.billingProviderRef,
    checkNumber: header.checkNumber.trim(),
    checkAmountCents: centsOr0(header.checkAmount),
    ...(header.paymentMethod ? { paymentMethod: header.paymentMethod } : {}),
    remitDate: header.remitDate,
    checkDate: header.checkDate,
    depositDate: header.depositDate,
    ...(header.notes.trim() ? { notes: header.notes.trim() } : {}),
  };
}

const trimmedOrUndefined = (text: string): string | undefined => text.trim() || undefined;

export function claimFormToInput(claim: ClaimForm): ManualEraClaim {
  return {
    clientKey: claim.key,
    ...(claim.claimResponseId
      ? { claimResponseId: claim.claimResponseId }
      : claim.matchedClaimId
      ? { matchedClaimId: claim.matchedClaimId }
      : {}),
    statusCode: claim.statusCode,
    patientName: claim.patientName.trim(),
    memberId: trimmedOrUndefined(claim.memberId),
    patientAccountNumber: trimmedOrUndefined(claim.patientAccountNumber),
    payerClaimControlNumber: trimmedOrUndefined(claim.payerClaimControlNumber),
    serviceDate: claim.serviceDate || undefined,
    serviceLines: claim.serviceLines.map((line) => ({
      ...(line.itemSequence ? { itemSequence: line.itemSequence } : {}),
      serviceDate: line.serviceDate,
      procedureCode: line.procedureCode.trim().toUpperCase(),
      billedCents: centsOr0(line.billed),
      allowedCents: line.allowed.trim() === '' ? null : centsOr0(line.allowed),
      paidCents: centsOr0(line.paid),
      adjustments: line.adjustments.map((row) => ({
        groupCode: row.groupCode as X12AdjustmentGroupCode,
        reasonCode: row.reasonCode,
        amountCents: centsOr0(row.amount),
      })),
      remarkCodes: line.remarkCodes.map((row) => row.code),
    })),
  };
}

// --- totals, balance and reconciliation ---

export interface ClaimTotals {
  allowedCents: number;
  paidCents: number;
  patientRespCents: number;
}

export function claimTotals(claim: ClaimForm): ClaimTotals {
  return claim.serviceLines.reduce<ClaimTotals>(
    (totals, line) => ({
      allowedCents: totals.allowedCents + centsOr0(line.allowed),
      paidCents: totals.paidCents + centsOr0(line.paid),
      patientRespCents:
        totals.patientRespCents +
        line.adjustments
          .filter((row) => row.groupCode === X12_ADJUSTMENT_GROUP_CODE.patientResponsibility)
          .reduce((sum, row) => sum + centsOr0(row.amount), 0),
    }),
    { allowedCents: 0, paidCents: 0, patientRespCents: 0 }
  );
}

// The 835 balancing rule for a line: what was billed, less every adjustment, is what was paid.
// Returns the gap (in cents) when the line is filled in enough to check, else null.
export function lineImbalanceCents(line: ServiceLineForm): number | null {
  const billed = parseMoneyToCents(line.billed);
  const paid = parseMoneyToCents(line.paid);
  if (billed === null || paid === null) return null;
  const adjusted = line.adjustments.reduce((sum, row) => sum + centsOr0(row.amount), 0);
  const gap = billed - adjusted - paid;
  return gap === 0 ? null : gap;
}

export interface RemitReconciliation {
  checkAmountCents: number;
  claimsPaidCents: number;
  // check amount − what the claims say was paid; 0 when the remit balances
  differenceCents: number;
}

export function reconcileRemit(checkAmount: string, claims: ClaimForm[]): RemitReconciliation {
  const checkAmountCents = centsOr0(checkAmount);
  const claimsPaidCents = claims.reduce((sum, claim) => sum + claimTotals(claim).paidCents, 0);
  return { checkAmountCents, claimsPaidCents, differenceCents: checkAmountCents - claimsPaidCents };
}

// --- validation ---

const PROCEDURE_CODE = /^[A-Z0-9]{5}$/;

// What still keeps a claim from being added (empty when it can be saved).
export function claimProblems(claim: ClaimForm): string[] {
  const problems: string[] = [];
  if (!claim.patientName.trim()) problems.push('Enter the patient name');
  if (claim.serviceLines.length === 0) problems.push('Add at least one service line');
  claim.serviceLines.forEach((line, index) => {
    const label = `Line ${index + 1}`;
    if (!line.serviceDate) problems.push(`${label}: enter the date of service`);
    if (!PROCEDURE_CODE.test(line.procedureCode.trim().toUpperCase()))
      problems.push(`${label}: enter a 5-character CPT/HCPCS code`);
    if (parseMoneyToCents(line.billed) === null) problems.push(`${label}: enter the billed amount`);
    if (parseMoneyToCents(line.paid) === null) problems.push(`${label}: enter the insurance paid amount`);
    if (!isMoneyText(line.allowed)) problems.push(`${label}: the allowed amount isn't a dollar amount`);
    if (line.adjustments.some((row) => !row.groupCode || !row.reasonCode || parseMoneyToCents(row.amount) === null))
      problems.push(`${label}: complete or remove each CARC (group, code and amount)`);
    if (line.remarkCodes.some((row) => !row.code)) problems.push(`${label}: choose or remove each RARC`);
  });
  return problems;
}

export type HeaderField = keyof HeaderForm;

export function headerProblems(header: HeaderForm): Partial<Record<HeaderField, string>> {
  const problems: Partial<Record<HeaderField, string>> = {};
  const required: HeaderField[] = [
    'payerId',
    'billingProviderRef',
    'checkNumber',
    'remitDate',
    'checkDate',
    'depositDate',
  ];
  for (const field of required) {
    if (!header[field].trim()) problems[field] = 'Required';
  }
  const checkAmount = parseMoneyToCents(header.checkAmount);
  if (header.checkAmount.trim() === '') problems.checkAmount = 'Required';
  else if (checkAmount === null || checkAmount < 0) problems.checkAmount = 'Enter a dollar amount';
  return problems;
}

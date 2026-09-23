import {
  ERA_CLAIM_STATUS_CODE,
  EraClaimStatusCode,
  X12_ADJUSTMENT_GROUP_CODE,
} from 'utils/lib/types/data/billing/billing.constants';
import { ClaimRemit, ClaimRemitAdjustment, EraRemitServiceLine } from 'utils/lib/types/data/billing/billing.types';
import { PATIENT_RESP_CARC } from 'utils/lib/types/data/billing/carc';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { ERA_STATUS_LABELS } from '../constants/era';

// The claim ledger's money columns a CAS adjustment can land in: whatever the payer adjusted off
// goes to Ins adj; patient responsibility splits into the PR-1/2/3 buckets and Other PR.
export type LedgerColumn = 'insuranceAdjustment' | 'deductible' | 'coinsurance' | 'copay' | 'otherPatientResp';

export type LedgerAmounts = Record<LedgerColumn, number>;

export function adjustmentColumn(adjustment: ClaimRemitAdjustment): LedgerColumn {
  if (adjustment.groupCode !== X12_ADJUSTMENT_GROUP_CODE.patientResponsibility) return 'insuranceAdjustment';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.deductible) return 'deductible';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.coinsurance) return 'coinsurance';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.copay) return 'copay';
  return 'otherPatientResp';
}

// Per-column sums of a remit line's adjustments, so its response row always adds up to its CARC rows.
export function ledgerAmounts(adjustments: ClaimRemitAdjustment[]): LedgerAmounts {
  const sums: LedgerAmounts = {
    insuranceAdjustment: 0,
    deductible: 0,
    coinsurance: 0,
    copay: 0,
    otherPatientResp: 0,
  };
  for (const adjustment of adjustments) {
    sums[adjustmentColumn(adjustment)] += adjustment.amount;
  }
  for (const column of Object.keys(sums) as LedgerColumn[]) {
    sums[column] = roundNumberToDecimalPlaces(sums[column], 2);
  }
  return sums;
}

export interface RemitLineEntry {
  // unique per remit line: one remit can cover several service lines, and each gets its own card
  key: string;
  remit: ClaimRemit;
  line: EraRemitServiceLine;
}

export interface GroupedRemitLines {
  byClaimLine: Map<number, RemitLineEntry[]>;
  // claim-level adjustments, and lines the payer adjudicated under a code we couldn't pin to a
  // submitted line
  other: RemitLineEntry[];
}

// Every remit line under the claim line it describes, oldest remit first so a reversal follows what
// it reverses. claim.remits comes newest first, in the same order the claim's totals are summed.
export function groupRemitLines(remits: ClaimRemit[], claimLineSequences: number[]): GroupedRemitLines {
  const sequences = new Set(claimLineSequences);
  const byClaimLine = new Map<number, RemitLineEntry[]>();
  const other: RemitLineEntry[] = [];
  const oldestFirst = remits.map((remit, remitIndex) => ({ remit, remitIndex })).reverse();
  for (const { remit, remitIndex } of oldestFirst) {
    remit.serviceLines.forEach((line, lineIndex) => {
      const entry = { key: `${remit.claimResponseId || `remit-${remitIndex}`}:${lineIndex}`, remit, line };
      const sequence = line.isClaimLevel ? null : line.claimItemSequence;
      if (sequence !== null && sequences.has(sequence)) {
        byClaimLine.set(sequence, [...(byClaimLine.get(sequence) ?? []), entry]);
      } else {
        other.push(entry);
      }
    });
  }
  return { byClaimLine, other };
}

// A remit's adjustments summed per group and reason code, in first-seen order.
export function aggregateAdjustments(adjustments: ClaimRemitAdjustment[]): ClaimRemitAdjustment[] {
  const byCode = new Map<string, ClaimRemitAdjustment>();
  for (const adjustment of adjustments) {
    const code = `${adjustment.groupCode}-${adjustment.reasonCode}`;
    const existing = byCode.get(code);
    byCode.set(
      code,
      existing
        ? { ...existing, amount: roundNumberToDecimalPlaces(existing.amount + adjustment.amount, 2) }
        : { ...adjustment }
    );
  }
  return [...byCode.values()];
}

const PAYER_RANKS = ['Primary', 'Secondary', 'Tertiary'];

const RANK_BY_STATUS: Partial<Record<EraClaimStatusCode, string>> = {
  [ERA_CLAIM_STATUS_CODE.primary]: 'Primary',
  [ERA_CLAIM_STATUS_CODE.primaryForwarded]: 'Primary',
  [ERA_CLAIM_STATUS_CODE.secondary]: 'Secondary',
  [ERA_CLAIM_STATUS_CODE.secondaryForwarded]: 'Secondary',
  [ERA_CLAIM_STATUS_CODE.tertiary]: 'Tertiary',
  [ERA_CLAIM_STATUS_CODE.tertiaryForwarded]: 'Tertiary',
};

const rankOf = (remit: ClaimRemit): string | undefined =>
  remit.eraStatusCode ? RANK_BY_STATUS[remit.eraStatusCode] : undefined;

// The payer rank a remit's money counts toward. CLP02 says so for most remits; a reversal or denial
// doesn't, so it takes the rank of another remit on the same ERA (a reversal travels with its
// correction), then of one from the same payer. ClaimResponse.insurer can't settle this: a manual
// match overwrites it with the claim's primary payer.
export function remitDesignation(remit: ClaimRemit, remits: ClaimRemit[]): string {
  const peerRank = (isPeer: (other: ClaimRemit) => boolean): string | undefined =>
    remits
      .filter((other) => other !== remit && isPeer(other))
      .map(rankOf)
      .find(Boolean);
  return (
    rankOf(remit) ??
    (remit.paymentReconciliationId
      ? peerRank((other) => other.paymentReconciliationId === remit.paymentReconciliationId)
      : undefined) ??
    (remit.payerName ? peerRank((other) => other.payerName === remit.payerName) : undefined) ??
    (remit.eraStatusCode ? ERA_STATUS_LABELS[remit.eraStatusCode] : 'Other')
  );
}

export interface InsurancePaidByDesignation {
  designation: string;
  amount: number;
}

// Insurance paid split by payer rank: Primary, Secondary, Tertiary, then anything unranked.
export function insurancePaidByDesignation(remits: ClaimRemit[]): InsurancePaidByDesignation[] {
  const totals = new Map<string, number>();
  for (const remit of remits) {
    const designation = remitDesignation(remit, remits);
    totals.set(designation, (totals.get(designation) ?? 0) + remit.paid);
  }
  const order = (designation: string): number => {
    const rank = PAYER_RANKS.indexOf(designation);
    return rank === -1 ? PAYER_RANKS.length : rank;
  };
  return [...totals.entries()]
    .map(([designation, amount]) => ({ designation, amount: roundNumberToDecimalPlaces(amount, 2) }))
    .sort((a, b) => order(a.designation) - order(b.designation));
}

export const eraHref = (paymentReconciliationId: string): string => `/eras/${paymentReconciliationId}`;

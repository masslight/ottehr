import {
  ERA_CLAIM_STATUS_CODE,
  EraClaimStatusCode,
  X12_ADJUSTMENT_GROUP_CODE,
} from 'utils/lib/types/data/billing/billing.constants';
import { ClaimRemit, ClaimRemitAdjustment, EraRemitServiceLine } from 'utils/lib/types/data/billing/billing.types';
import { PATIENT_RESP_CARC } from 'utils/lib/types/data/billing/carc';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { ERA_STATUS_LABELS } from '../constants/era';

// The claim ledger's money columns: what the payer adjusted off (Ins adj), the deductible /
// coinsurance / copay patient-responsibility buckets, and Patient, the line's whole patient
// responsibility (not what the patient has paid).
export type LedgerColumn = 'insuranceAdjustment' | 'deductible' | 'coinsurance' | 'copay' | 'patientResp';

export type LedgerAmounts = Record<LedgerColumn, number>;

// The one column a CAS adjustment's own row shows its amount in. Patient responsibility goes to its
// PR-1/2/3 bucket, or straight to Patient when it's none of those (e.g. PR-96 non-covered).
export function adjustmentColumn(adjustment: ClaimRemitAdjustment): LedgerColumn {
  if (adjustment.groupCode !== X12_ADJUSTMENT_GROUP_CODE.patientResponsibility) return 'insuranceAdjustment';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.deductible) return 'deductible';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.coinsurance) return 'coinsurance';
  if (adjustment.reasonCode === PATIENT_RESP_CARC.copay) return 'copay';
  return 'patientResp';
}

// A remit line's amounts per ledger column. Patient totals every patient-responsibility adjustment,
// the buckets included, so it's the line's patient responsibility rather than a sum of the rows below.
export function ledgerAmounts(adjustments: ClaimRemitAdjustment[]): LedgerAmounts {
  const sums: LedgerAmounts = {
    insuranceAdjustment: 0,
    deductible: 0,
    coinsurance: 0,
    copay: 0,
    patientResp: 0,
  };
  for (const adjustment of adjustments) {
    const column = adjustmentColumn(adjustment);
    if (column === 'insuranceAdjustment') {
      sums.insuranceAdjustment += adjustment.amount;
      continue;
    }
    if (column !== 'patientResp') sums[column] += adjustment.amount;
    sums.patientResp += adjustment.amount;
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

// Remit lines that aren't on the claim, shown as a service line built from what the ERA reports.
export interface UnmatchedRemitLine {
  key: string;
  // the claim-level CAS adjustments, which belong to no service line
  isClaimLevel: boolean;
  // the procedure code the payer adjudicated ('' when it reported none)
  cptCode: string;
  serviceDate: string;
  units: number | null;
  // the charge the payer reported for the line
  billed: number | null;
  entries: RemitLineEntry[];
}

// The `other` remit lines as the service lines the ledger shows them under: one per procedure code
// the payer adjudicated, merged across remits (so a reversal sits with the line it reverses) in the
// order they first appear, then one for the claim-level adjustments.
export function groupUnmatchedRemitLines(entries: RemitLineEntry[]): UnmatchedRemitLine[] {
  const byKey = new Map<string, RemitLineEntry[]>();
  for (const entry of entries) {
    const key = entry.line.isClaimLevel ? 'claim-level' : `code:${entry.line.cptCode}`;
    byKey.set(key, [...(byKey.get(key) ?? []), entry]);
  }
  const lines = [...byKey.entries()].map(([key, grouped]): UnmatchedRemitLine => {
    const reported = grouped.map((entry) => entry.line);
    return {
      key,
      isClaimLevel: key === 'claim-level',
      cptCode: reported[0].cptCode,
      serviceDate: reported.find((line) => line.serviceDate)?.serviceDate ?? '',
      units: reported.find((line) => line.units !== null)?.units ?? null,
      // a reversal reports the charge negated, so prefer the charge as billed
      billed:
        reported.find((line) => line.billed !== null && line.billed > 0)?.billed ??
        reported.find((line) => line.billed !== null)?.billed ??
        null,
      entries: grouped,
    };
  });
  return [...lines.filter((line) => !line.isClaimLevel), ...lines.filter((line) => line.isClaimLevel)];
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

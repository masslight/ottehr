import Oystehr from '@oystehr/sdk';
import { Claim, ClaimItem, ClaimResponse } from 'fhir/r4b';
import { StatementDetails } from 'utils/lib/statements/generate-statement';
import { EraRemitServiceLine } from 'utils/lib/types/data/billing/billing.types';
import { patientRespBuckets } from 'utils/lib/types/data/billing/carc';
import { STATEMENT_BILLING_CLAIM_NOT_FOUND_ERROR } from 'utils/lib/types/errors';
import { formatCurrencyFromCents } from 'utils/lib/utils/convert';
import {
  fetchClaimResponsesByClaimIds,
  fetchPatientPaymentsByEncounterIds,
  sortClaimResponsesByRecency,
  summarizeClaimPayments,
  sumPatientPayments,
} from '../../billing/claim-amounts';
import { buildEraRemitServiceLines } from '../../billing/era-remits';
import { findBillingClaimForEncounter } from '../../billing/payments';
import { getProcedureCodeTitle } from './get-procedure-code-title';
import { applyPaymentToLines, shareByCharge } from './statement-line-amounts';

export interface StatementLineDetails {
  serviceLines: StatementDetails['service'];
  totals: StatementDetails['totals'];
}

export interface BillingStatementAmounts {
  lines: {
    chargedCents: number;
    insurancePaidCents: number;
    patientPaidCents: number;
    patientOwesCents: number;
  }[];
  totals: {
    chargedCents: number;
    insurancePaidCents: number;
    patientPaidCents: number;
    balanceDueCents: number;
    deductibleCents: number;
  };
}

export interface BillingStatementLinesInput {
  encounterId: string;
  billingOystehr: Oystehr;
  eraReadOystehr: Oystehr;
  clinicalOystehr: Oystehr;
}

const toCents = (dollars: number | undefined): number => Math.round((dollars ?? 0) * 100);

const claimItems = (claim: Claim): ClaimItem[] => [...(claim.item ?? [])].sort((a, b) => a.sequence - b.sequence);

const patientRespOf = (line: EraRemitServiceLine): number => {
  const buckets = patientRespBuckets(line.adjustments);
  return buckets.deductible + buckets.coinsurance + buckets.copay + buckets.other;
};

function sumByClaimLine(
  lines: EraRemitServiceLine[],
  amountOf: (line: EraRemitServiceLine) => number
): Map<number, number> {
  const byLine = new Map<number, number>();
  for (const line of lines) {
    if (line.claimItemSequence == null) continue;
    byLine.set(line.claimItemSequence, (byLine.get(line.claimItemSequence) ?? 0) + toCents(amountOf(line)));
  }
  return byLine;
}

function fitToTotal(totalCents: number, attributed: number[], chargeCents: number[]): number[] {
  const perLine = attributed.map((cents) => Math.max(cents, 0));
  const attributedTotal = perLine.reduce((total, cents) => total + cents, 0);
  const unattributed = totalCents - attributedTotal;
  if (attributedTotal === 0 || unattributed < 0) return shareByCharge(totalCents, chargeCents);

  const shares = shareByCharge(unattributed, chargeCents);
  return perLine.map((cents, index) => cents + shares[index]);
}

export function computeBillingStatementAmounts(params: {
  claim: Claim;
  claimResponses: ClaimResponse[];
  patientPaid: number;
}): BillingStatementAmounts {
  const { claim, claimResponses, patientPaid } = params;
  const items = claimItems(claim);
  const remitLines = sortClaimResponsesByRecency(claimResponses).map((remit) =>
    buildEraRemitServiceLines(remit, claim)
  );
  const latestRemitLines = remitLines[remitLines.length - 1] ?? [];

  const payments = summarizeClaimPayments(claimResponses, claim.total?.value ?? 0, patientPaid);

  const insurancePaidCents = Math.max(toCents(payments.insurancePaid), 0);
  const patientRespCents = Math.max(
    payments.adjudicated ? toCents(payments.patientResp) : toCents(claim.total?.value),
    0
  );
  const chargedCents = insurancePaidCents + patientRespCents;
  const patientPaidCents = toCents(payments.patientPaid);
  const deductibleSumCents = latestRemitLines.reduce(
    (total, line) => total + toCents(patientRespBuckets(line.adjustments).deductible),
    0
  );
  const deductibleCents = Math.min(Math.max(deductibleSumCents, 0), patientRespCents);

  const totals = {
    chargedCents,
    insurancePaidCents,
    patientPaidCents,
    balanceDueCents: patientRespCents - patientPaidCents,
    deductibleCents,
  };

  if (items.length === 0) {
    return {
      lines: [],
      totals,
    };
  }

  const paidByLine = sumByClaimLine(remitLines.flat(), (line) => line.paid);
  const respByLine = sumByClaimLine(latestRemitLines, patientRespOf);

  const grossCents = items.map((item) => toCents(item.net?.value));
  const insurancePaidByLine = fitToTotal(
    insurancePaidCents,
    items.map((item) => paidByLine.get(item.sequence) ?? 0),
    grossCents
  );
  const owedByLine = fitToTotal(
    patientRespCents,
    items.map((item) => respByLine.get(item.sequence) ?? 0),
    grossCents
  );
  const patientPaidByLine = applyPaymentToLines(patientPaidCents, owedByLine);

  return {
    lines: items.map((_, index) => ({
      chargedCents: insurancePaidByLine[index] + owedByLine[index],
      insurancePaidCents: insurancePaidByLine[index],
      patientPaidCents: patientPaidByLine[index],
      patientOwesCents: owedByLine[index] - patientPaidByLine[index],
    })),
    totals,
  };
}

export async function getBillingStatementLines(input: BillingStatementLinesInput): Promise<StatementLineDetails> {
  const { encounterId, billingOystehr, eraReadOystehr, clinicalOystehr } = input;

  const claim = await findBillingClaimForEncounter(billingOystehr, encounterId);
  if (!claim?.id) throw STATEMENT_BILLING_CLAIM_NOT_FOUND_ERROR(encounterId);

  const [claimResponsesByClaimId, paymentsByEncounterId] = await Promise.all([
    fetchClaimResponsesByClaimIds(eraReadOystehr, [claim.id]),
    fetchPatientPaymentsByEncounterIds(billingOystehr, [encounterId]),
  ]);

  const amounts = computeBillingStatementAmounts({
    claim,
    claimResponses: claimResponsesByClaimId.get(claim.id) ?? [],
    patientPaid: sumPatientPayments(paymentsByEncounterId.get(encounterId) ?? []),
  });

  const serviceLines = await Promise.all(
    claimItems(claim).map(async (item, index) => {
      const coding = item.productOrService?.coding?.[0];
      const cpt = coding?.code ?? '';
      const line = amounts.lines[index];
      return {
        cpt,
        description: await getProcedureCodeTitle({
          code: cpt,
          display: coding?.display,
          oystehr: clinicalOystehr,
        }),
        charged: formatCurrencyFromCents(line.chargedCents),
        insurancePaid: formatCurrencyFromCents(line.insurancePaidCents),
        patientPaid: formatCurrencyFromCents(line.patientPaidCents),
        patientOwes: formatCurrencyFromCents(line.patientOwesCents),
      };
    })
  );

  return {
    serviceLines,
    totals: {
      charged: formatCurrencyFromCents(amounts.totals.chargedCents),
      insurancePaid: formatCurrencyFromCents(amounts.totals.insurancePaidCents),
      patientPaid: formatCurrencyFromCents(amounts.totals.patientPaidCents),
      deductible: formatCurrencyFromCents(amounts.totals.deductibleCents),
      balanceDue: formatCurrencyFromCents(amounts.totals.balanceDueCents),
    },
  };
}

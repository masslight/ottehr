import Oystehr from '@oystehr/sdk';
import { Claim } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { EmptyReportParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  AgingReceivablesPayerRow,
  GetBillingAgingReceivablesReportResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { getRateLimitedStripeClient } from '../../../shared/stripeIntegration';
import { fetchClaimResponsesByClaimIds } from '../../claim-amounts';
import { resolvedPayerId, resolvePayersByRef } from '../../shared';
import { ProgressFn, ReportComputeContext, ReportDefinition } from '../framework/types';
import { listStripeAccounts, searchAllViaBulk, UNKNOWN_PAYER_NAME } from '../shared';

type AgingReceivablesReportPayload = Omit<GetBillingAgingReceivablesReportResponse, 'fromCache' | 'status'>;

export const agingReceivablesReport: ReportDefinition<Record<string, never>, AgingReceivablesReportPayload> = {
  kind: 'aging-receivables',
  cacheVersion: 'v1',
  paramsSchema: EmptyReportParamsSchema,
  cacheKeyOf: () => '',
  emptyPayload: () => ({
    insurance: { claimCount: 0, totalBilled: 0 },
    payerRows: [],
    patient: { invoiceCount: 0, amountDue: 0 },
    generatedAt: '',
  }),
  compute: async (ctx, _params, onProgress) => ({
    payload: await computeAgingReceivablesReport(ctx, onProgress),
  }),
  summarize: (payload) =>
    `aging receivables cached (${payload.insurance.claimCount} claims, ${payload.patient.invoiceCount} open invoices)`,
};

async function computeAgingReceivablesReport(
  ctx: ReportComputeContext<AgingReceivablesReportPayload>,
  onProgress?: ProgressFn
): Promise<AgingReceivablesReportPayload> {
  const { oystehr, untaggedClient, secrets } = ctx;

  await onProgress?.('scanning submitted claims…');
  const { insurance, payerRows } = await computeInsuranceSide(oystehr);

  await onProgress?.('listing open patient invoices…');
  const stripe = getRateLimitedStripeClient(secrets);
  const accounts = await listStripeAccounts(oystehr, untaggedClient, stripe);
  const patient = await sumOpenInvoices(stripe, accounts, async (count) => {
    await onProgress?.(`listing open patient invoices… ${count.toLocaleString('en-US')}`);
  });

  return { insurance, payerRows, patient, generatedAt: DateTime.now().toUTC().toISO() };
}

// Claims sitting in Insurance Payer AR at 'submitted' with ZERO posted ERAs. The status tag alone
// is not enough: a crossover forwarding (or a manual secondary submission) resets it to 'submitted'
// after a primary ERA already posted, so matched ClaimResponses are cross-checked and any claim
// with one is excluded from both counts.
async function computeInsuranceSide(oystehr: Oystehr): Promise<{
  insurance: AgingReceivablesReportPayload['insurance'];
  payerRows: AgingReceivablesPayerRow[];
}> {
  const submitted = await searchAllViaBulk<Claim>(oystehr, {
    resourceType: 'Claim',
    params: [
      { name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${AR_STAGE.insurancePayer}` },
      { name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus}|submitted` },
      { name: '_elements', value: 'id,total,insurer' },
    ],
  });

  const responsesByClaimId = await fetchClaimResponsesByClaimIds(
    oystehr,
    submitted.map((claim) => claim.id ?? '').filter(Boolean)
  );
  const claims = submitted.filter((claim) => (responsesByClaimId.get(claim.id ?? '') ?? []).length === 0);

  const payersByRef = await resolvePayersByRef(oystehr, [...new Set(claims.map((claim) => claim.insurer?.reference))]);

  const rowByRef = new Map<string, AgingReceivablesPayerRow>();
  let claimCount = 0;
  let totalBilled = 0;
  for (const claim of claims) {
    const payerRef = claim.insurer?.reference ?? '';
    const payer = payersByRef.get(payerRef);
    const row = rowByRef.get(payerRef) ?? {
      payerRef,
      payerId: resolvedPayerId(payer) ?? '',
      payerName: payer?.name ?? claim.insurer?.display ?? UNKNOWN_PAYER_NAME,
      claimCount: 0,
      totalBilled: 0,
    };
    const billed = claim.total?.value ?? 0;
    row.claimCount += 1;
    row.totalBilled += billed;
    rowByRef.set(payerRef, row);
    claimCount += 1;
    totalBilled += billed;
  }

  const payerRows = [...rowByRef.values()].sort(
    (a, b) => b.totalBilled - a.totalBilled || a.payerName.localeCompare(b.payerName)
  );
  return { insurance: { claimCount, totalBilled }, payerRows };
}

// Open Stripe invoices = sent (finalized) and not yet paid; amount is the outstanding balance.
// listStripeAccounts returns each account once, and invoice ids are account-scoped — no dedupe.
async function sumOpenInvoices(
  stripe: Stripe,
  accounts: (string | undefined)[],
  onCount?: (count: number) => Promise<void>
): Promise<AgingReceivablesReportPayload['patient']> {
  let invoiceCount = 0;
  let amountDue = 0;
  // account failures propagate: a partial result must not be cached as the complete report
  for (const stripeAccount of accounts) {
    const listing = stripe.invoices.list({ status: 'open', limit: 100 }, { stripeAccount });
    for await (const invoice of listing) {
      invoiceCount += 1;
      amountDue += (invoice.amount_remaining ?? invoice.amount_due ?? 0) / 100;
      if (invoiceCount % 250 === 0) await onCount?.(invoiceCount);
    }
  }
  return { invoiceCount, amountDue };
}

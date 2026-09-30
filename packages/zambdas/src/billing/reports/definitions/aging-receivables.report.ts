import Oystehr from '@oystehr/sdk';
import { Claim, Coverage } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { EmptyReportParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  AgingReceivablesPayerRow,
  GetBillingAgingReceivablesReportResponse,
} from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { getRateLimitedStripeClient } from '../../../shared/stripeIntegration';
import { fetchClaimResponsesByClaimIds } from '../../claim-amounts';
import { hasTag, resolvedPayerId, resolvePayersByRef } from '../../shared';
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

// Claims sitting in Insurance Payer AR at 'submitted' — an ERA posting advances the status tag to
// 'adjudicated' (sub-claim-status-response), so 'submitted' = no ERA received yet.
async function computeInsuranceSide(oystehr: Oystehr): Promise<{
  insurance: AgingReceivablesReportPayload['insurance'];
  payerRows: AgingReceivablesPayerRow[];
}> {
  const claims = await searchAllViaBulk<Claim>(oystehr, {
    resourceType: 'Claim',
    params: [
      { name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.arStage}|${AR_STAGE.insurancePayer}` },
      { name: '_tag', value: `${CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus}|submitted` },
      { name: '_elements', value: 'id,meta,total,insurer,insurance' },
    ],
  });

  const awaitingPayerByClaimId = await resolveCrossoverPayers(oystehr, claims);
  // Claim.insurer stays on the primary payer; crossover claims group under the coverage they await
  const targetOf = (claim: Claim): { payerRef: string; display?: string } =>
    awaitingPayerByClaimId.get(claim.id ?? '') ?? {
      payerRef: claim.insurer?.reference ?? '',
      display: claim.insurer?.display,
    };

  const payersByRef = await resolvePayersByRef(oystehr, [...new Set(claims.map((claim) => targetOf(claim).payerRef))]);

  const rowByRef = new Map<string, AgingReceivablesPayerRow>();
  let claimCount = 0;
  let totalBilled = 0;
  for (const claim of claims) {
    const target = targetOf(claim);
    const payer = payersByRef.get(target.payerRef);
    const row = rowByRef.get(target.payerRef) ?? {
      payerRef: target.payerRef,
      payerId: resolvedPayerId(payer) ?? '',
      payerName: payer?.name ?? target.display ?? UNKNOWN_PAYER_NAME,
      claimCount: 0,
      totalBilled: 0,
    };
    const billed = claim.total?.value ?? 0;
    row.claimCount += 1;
    row.totalBilled += billed;
    rowByRef.set(target.payerRef, row);
    claimCount += 1;
    totalBilled += billed;
  }

  const payerRows = [...rowByRef.values()].sort(
    (a, b) => b.totalBilled - a.totalBilled || a.payerName.localeCompare(b.payerName)
  );
  return { insurance: { claimCount, totalBilled }, payerRows };
}

const COVERAGE_BATCH_SIZE = 100;

// A crossover forwarding resets insuranceArStatus to 'submitted' without touching Claim.insurer,
// so tagged claims are awaiting a NON-primary ERA: the coverage after the ones already adjudicated
// (posted ERA count), whose payor is the payer actually owing. Unresolvable claims fall back to insurer.
async function resolveCrossoverPayers(
  oystehr: Oystehr,
  claims: Claim[]
): Promise<Map<string, { payerRef: string; display?: string }>> {
  const crossover = claims.filter(
    (claim) => claim.id && hasTag(claim, CLAIM_TAG_SYSTEM, SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME)
  );
  if (crossover.length === 0) return new Map();

  const responsesByClaimId = await fetchClaimResponsesByClaimIds(
    oystehr,
    crossover.map((claim) => claim.id ?? '')
  );

  const coverageRefByClaimId = new Map<string, string>();
  for (const claim of crossover) {
    const entries = (claim.insurance ?? [])
      .filter((entry) => entry.coverage?.reference)
      .sort((a, b) => a.sequence - b.sequence);
    if (entries.length < 2) continue;
    const eraCount = responsesByClaimId.get(claim.id ?? '')?.length ?? 0;
    // at least one ERA triggered the crossover tag; cap at the last coverage
    const awaiting = entries[Math.min(Math.max(eraCount, 1), entries.length - 1)];
    const ref = awaiting.coverage.reference;
    if (ref) coverageRefByClaimId.set(claim.id ?? '', ref);
  }

  const coveragesByRef = await fetchCoveragesByRef(oystehr, [...new Set(coverageRefByClaimId.values())]);

  const result = new Map<string, { payerRef: string; display?: string }>();
  for (const [claimId, coverageRef] of coverageRefByClaimId) {
    const payor = coveragesByRef.get(coverageRef)?.payor?.[0];
    if (!payor?.reference && !payor?.display) continue;
    result.set(claimId, { payerRef: payor.reference ?? '', display: payor.display });
  }
  return result;
}

async function fetchCoveragesByRef(oystehr: Oystehr, refs: string[]): Promise<Map<string, Coverage>> {
  const ids = refs.map((ref) => ref.replace('Coverage/', '')).filter(Boolean);
  const byRef = new Map<string, Coverage>();
  for (let i = 0; i < ids.length; i += COVERAGE_BATCH_SIZE) {
    const batch = ids.slice(i, i + COVERAGE_BATCH_SIZE);
    const bundle = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_elements', value: 'id,payor' },
        { name: '_count', value: String(batch.length) },
      ],
    });
    for (const coverage of bundle.unbundle()) {
      if (coverage.id) byRef.set(`Coverage/${coverage.id}`, coverage);
    }
  }
  return byRef;
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

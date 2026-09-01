import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { Secrets } from 'utils/lib/secrets';
import { EmptyReportParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingInvoiceReportResponse,
  InvoiceAgingTrendPoint,
  InvoiceReportCategory,
  InvoiceReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import {
  encounterIdFromStripeMetadata,
  getRateLimitedStripeClient,
  patientIdFromStripeMetadata,
} from '../../../shared/stripeIntegration';
import { fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { CardSummary, lookupCardsWithDirectory } from '../card-directory';
import { ProgressFn, ReportComputeContext, ReportDefinition } from '../framework/types';

const PATIENT_BATCH_SIZE = 100;

type InvoiceReportPayload = Omit<GetBillingInvoiceReportResponse, 'fromCache' | 'status'>;

interface InvoiceWithAccount {
  invoice: Stripe.Invoice;
  stripeAccount: string | undefined;
}

const emptyTotals = (): InvoiceReportPayload['totals'] => ({
  upcoming: { count: 0, amountDue: 0 },
  'past-due-no-card': { count: 0, amountDue: 0 },
  'past-due-not-attempted': { count: 0, amountDue: 0 },
  'past-due-failed': { count: 0, amountDue: 0 },
});

export const invoiceReport: ReportDefinition<Record<string, never>, InvoiceReportPayload> = {
  kind: 'invoice',
  cacheVersion: 'v1',
  paramsSchema: EmptyReportParamsSchema,
  cacheKeyOf: () => '',
  emptyPayload: () => ({ rows: [], totals: emptyTotals(), agingTrend: [], generatedAt: '' }),
  usesPrevious: true,
  compute: async (ctx, _params, onProgress) => ({
    payload: await computeInvoiceReport(ctx, onProgress),
  }),
  summarize: (payload) => `invoice report cached (${payload.rows.length} invoices)`,
};

// full recomputation (worker-side)
async function computeInvoiceReport(
  ctx: ReportComputeContext<InvoiceReportPayload>,
  onProgress?: ProgressFn
): Promise<InvoiceReportPayload> {
  const { oystehr, untaggedClient, secrets, previous } = ctx;
  const stripe = getRateLimitedStripeClient(secrets);
  const generatedAt = DateTime.now().toUTC().toISO();
  const nowSeconds = Math.floor(Date.now() / 1000);

  await onProgress?.('listing Stripe accounts…');
  const accounts = await listStripeAccounts(oystehr, stripe);

  // month-end snapshots are immutable once past: reuse cached points and full-scan the invoice
  // history only when one is missing (cold cache or a month rolled over)
  const now = DateTime.now();
  const monthEnds = trendMonthEnds(now);
  const cachedPoints = new Map((previous?.agingTrend ?? []).map((point) => [point.snapshotDate, point]));
  const needScan = monthEnds.some((snapshot) => !cachedPoints.has(snapshotISO(snapshot)));

  await onProgress?.('listing invoices…');
  // one shared progress line for both parallel listings
  const listCounts = { open: 0, scanned: 0 };
  const reportListing = async (): Promise<void> => {
    await onProgress?.(
      `listing invoices… ${listCounts.open.toLocaleString('en-US')} open` +
        (needScan ? `, ${listCounts.scanned.toLocaleString('en-US')} scanned for aging` : '')
    );
  };
  const [invoices, allInvoices] = await Promise.all([
    listOpenInvoices(stripe, accounts, async (count) => {
      listCounts.open = count;
      await reportListing();
    }),
    needScan
      ? listAllInvoices(stripe, accounts, async (count) => {
          listCounts.scanned = count;
          await reportListing();
        })
      : Promise.resolve<InvoiceWithAccount[]>([]),
  ]);
  // the "now" point only needs currently open invoices, which the rows listing already has
  const agingTrend = [
    ...monthEnds.map((snapshot) => cachedPoints.get(snapshotISO(snapshot)) ?? computeTrendPoint(allInvoices, snapshot)),
    computeTrendPoint(invoices, now),
  ];

  // card-on-file only matters for past-due invoices, so the lookup is scoped to those customers
  const pastDueCustomers = new Map<string, { customerId: string; stripeAccount: string | undefined }>();
  for (const { invoice, stripeAccount } of invoices) {
    if (!isPastDue(invoice, nowSeconds)) continue;
    const customerId = customerIdOf(invoice);
    if (customerId) pastDueCustomers.set(customerId, { customerId, stripeAccount });
  }
  await onProgress?.(`resolving cards for ${pastDueCustomers.size.toLocaleString('en-US')} past-due customers…`);
  const cardByCustomerId = await resolveCards(
    oystehr,
    secrets,
    stripe,
    [...pastDueCustomers.values()],
    invoices,
    async (done, total) => {
      await onProgress?.(
        `checking cards for ${done.toLocaleString('en-US')}/${total.toLocaleString('en-US')} past-due customers…`
      );
    }
  );

  const patientIds = [
    ...new Set(
      invoices.map(({ invoice }) => patientIdOf(invoice)).filter((id): id is string => !!id && isValidUUID(id))
    ),
  ];
  const encounterIds = [
    ...new Set(
      invoices
        .map(({ invoice }) => encounterIdFromStripeMetadata(invoice.metadata))
        .filter((id): id is string => !!id && isValidUUID(id))
    ),
  ];
  const [patientsById, visitByEncounterId] = await Promise.all([
    fetchPatientsById(untaggedClient, patientIds),
    fetchVisitsByEncounterId(untaggedClient, encounterIds),
  ]);
  await onProgress?.(`building report (${invoices.length.toLocaleString('en-US')} open invoices)…`);

  const rows: InvoiceReportRow[] = invoices.map(({ invoice, stripeAccount }) => {
    const customerId = customerIdOf(invoice) ?? '';
    const card = cardByCustomerId.get(customerId);
    const pastDue = isPastDue(invoice, nowSeconds);
    const charge = typeof invoice.charge === 'string' ? undefined : invoice.charge;
    // 'failed' requires evidence of an attempt — send_invoice invoices may never be auto-charged
    const attempted = (invoice.attempt_count ?? 0) > 0 || !!charge?.failure_message;
    const category: InvoiceReportCategory = !pastDue
      ? 'upcoming'
      : !card
      ? 'past-due-no-card'
      : attempted
      ? 'past-due-failed'
      : 'past-due-not-attempted';
    const patientId = patientIdOf(invoice) ?? '';
    const patient = isValidUUID(patientId) ? patientsById.get(patientId) : undefined;
    const encounterId = encounterIdFromStripeMetadata(invoice.metadata) ?? '';
    const visit = isValidUUID(encounterId) ? visitByEncounterId.get(encounterId) : undefined;
    return {
      stripeInvoiceId: invoice.id,
      invoiceNumber: invoice.number ?? '',
      stripeAccountId: stripeAccount ?? '',
      livemode: invoice.livemode,
      stripeCustomerId: customerId,
      customerName: customerNameOf(invoice),
      patientId: patient?.id ?? '',
      patientName: fhirName(patient),
      amountDue: (invoice.amount_due ?? 0) / 100,
      createdDate: DateTime.fromSeconds(invoice.created).toUTC().toISO() ?? '',
      dueDate: invoice.due_date ? DateTime.fromSeconds(invoice.due_date).toUTC().toISO() ?? '' : '',
      visitDate: visit?.visitDate ?? '',
      appointmentId: visit?.appointmentId ?? '',
      category,
      attemptCount: invoice.attempt_count ?? 0,
      lastPaymentError: charge?.failure_message ?? '',
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? '',
      cardBrand: card?.brand ?? '',
      cardLast4: card?.last4 ?? '',
    };
  });

  rows.sort((a, b) => (a.dueDate || a.createdDate).localeCompare(b.dueDate || b.createdDate));

  const totals: InvoiceReportPayload['totals'] = emptyTotals();
  for (const row of rows) {
    totals[row.category].count += 1;
    totals[row.category].amountDue += row.amountDue;
  }

  return { rows, totals, agingTrend, generatedAt };
}

const TREND_MONTHS = 6;
const TREND_BUCKETS = [
  { key: '0-30', minDays: 0, maxDays: 30 },
  { key: '30-60', minDays: 30, maxDays: 60 },
  { key: '60-90', minDays: 60, maxDays: 90 },
  { key: '90-120', minDays: 90, maxDays: 120 },
  { key: '120-150', minDays: 120, maxDays: 150 },
  { key: '150+', minDays: 150, maxDays: Infinity },
];
const NOT_YET_DUE = 'not-yet-due';

export const snapshotISO = (snapshot: DateTime): string => snapshot.toUTC().toISO() ?? '';

// month-ends of the previous TREND_MONTHS months, oldest first
export const trendMonthEnds = (now: DateTime): DateTime[] =>
  Array.from({ length: TREND_MONTHS }, (_v, i) => now.minus({ months: TREND_MONTHS - i }).endOf('month'));

// snapshot at T: an invoice counts if finalized by T and not yet paid/voided/uncollectible at T
export function computeTrendPoint(invoices: InvoiceWithAccount[], snapshot: DateTime): InvoiceAgingTrendPoint {
  const t = Math.floor(snapshot.toSeconds());
  const buckets: InvoiceAgingTrendPoint['buckets'] = Object.fromEntries(
    [NOT_YET_DUE, ...TREND_BUCKETS.map((bucket) => bucket.key)].map((key) => [key, { count: 0, amountDue: 0 }])
  );
  for (const { invoice } of invoices) {
    const transitions = invoice.status_transitions;
    const issuedAt = transitions?.finalized_at ?? (invoice.status !== 'draft' ? invoice.created : undefined);
    if (!issuedAt || issuedAt > t) continue;
    const closedAt = Math.min(
      ...[transitions?.paid_at, transitions?.voided_at, transitions?.marked_uncollectible_at].filter(
        (value): value is number => value != null
      )
    );
    if (Number.isFinite(closedAt) && closedAt <= t) continue;
    const amount = (invoice.amount_due ?? 0) / 100;
    let key = NOT_YET_DUE;
    // automatic-collection invoices (no due_date) with a failed charge age from finalization
    const agingAnchor = invoice.due_date ?? ((invoice.attempt_count ?? 0) > 0 ? issuedAt : undefined);
    if (agingAnchor && agingAnchor <= t) {
      const days = Math.floor((t - agingAnchor) / 86400);
      key = (TREND_BUCKETS.find((bucket) => days >= bucket.minDays && days < bucket.maxDays) ?? TREND_BUCKETS[0]).key;
    }
    buckets[key].count += 1;
    buckets[key].amountDue += amount;
  }
  return {
    snapshotDate: snapshotISO(snapshot),
    label: snapshot.toFormat('MMM yyyy'),
    buckets,
  };
}

// all invoices regardless of status; lean listing (no expansions) used only for the aging trend
async function listAllInvoices(
  stripe: Stripe,
  accounts: (string | undefined)[],
  onCount?: (count: number) => Promise<void>
): Promise<InvoiceWithAccount[]> {
  const invoices: InvoiceWithAccount[] = [];
  const seenInvoiceIds = new Set<string>();
  // account failures propagate: a partial aging trend must not be cached as the complete report
  for (const stripeAccount of accounts) {
    const listing = stripe.invoices.list({ limit: 100 }, { stripeAccount });
    for await (const invoice of listing) {
      if (seenInvoiceIds.has(invoice.id)) continue;
      seenInvoiceIds.add(invoice.id);
      invoices.push({ invoice, stripeAccount });
      if (invoices.length % 250 === 0) await onCount?.(invoices.length);
    }
  }
  return invoices;
}

// no due_date = automatic collection; an open invoice with attempts means the charge failed
const isPastDue = (invoice: Stripe.Invoice, nowSeconds: number): boolean =>
  invoice.due_date ? invoice.due_date < nowSeconds : (invoice.attempt_count ?? 0) > 0;

const customerIdOf = (invoice: Stripe.Invoice): string | undefined =>
  typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

const patientIdOf = (invoice: Stripe.Invoice): string | undefined => {
  const customer = invoice.customer;
  if (!customer || typeof customer === 'string' || customer.deleted) return undefined;
  return patientIdFromStripeMetadata(customer.metadata);
};

const customerNameOf = (invoice: Stripe.Invoice): string => {
  const customer = invoice.customer;
  if (customer && typeof customer !== 'string' && !customer.deleted) {
    return customer.name ?? customer.email ?? '';
  }
  return invoice.customer_name ?? invoice.customer_email ?? '';
};

// platform account plus connected accounts stamped on billing provider organizations; the
// platform's own id can be stamped on an org too and must not be listed a second time
async function listStripeAccounts(oystehr: Oystehr, stripe: Stripe): Promise<(string | undefined)[]> {
  // paged: connected accounts must not fall off a single-page result
  const [orgs, platformAccount] = await Promise.all([
    getAllFhirSearchPages<Organization>(
      { resourceType: 'Organization', params: [{ name: '_elements', value: 'id,identifier' }] },
      oystehr
    ),
    stripe.accounts.retrieve(),
  ]);
  const connectedAccounts = [
    ...new Set(
      orgs
        .flatMap((org) => org.identifier ?? [])
        .filter((identifier) => identifier.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)
        .map((identifier) => identifier.value)
        .filter((value): value is string => !!value && value !== platformAccount.id)
    ),
  ];
  return [undefined, ...connectedAccounts];
}

// open Stripe invoices = due or past due; customer + latest charge expanded for card/failure context
async function listOpenInvoices(
  stripe: Stripe,
  accounts: (string | undefined)[],
  onCount?: (count: number) => Promise<void>
): Promise<InvoiceWithAccount[]> {
  const invoices: InvoiceWithAccount[] = [];
  const seenInvoiceIds = new Set<string>();
  // account failures propagate: a partial result must not be cached as the complete report
  for (const stripeAccount of accounts) {
    const listing = stripe.invoices.list(
      {
        status: 'open',
        limit: 100,
        expand: [
          'data.customer.invoice_settings.default_payment_method',
          'data.customer.default_source',
          'data.charge',
        ],
      },
      { stripeAccount }
    );
    for await (const invoice of listing) {
      if (seenInvoiceIds.has(invoice.id)) continue;
      seenInvoiceIds.add(invoice.id);
      invoices.push({ invoice, stripeAccount });
      if (invoices.length % 250 === 0) await onCount?.(invoices.length);
    }
  }
  return invoices;
}

interface CardSummaryLike {
  brand: string;
  last4: string;
}

// default payment method, else legacy default card source, else the shared card directory
async function resolveCards(
  oystehr: Oystehr,
  secrets: Secrets | null,
  stripe: Stripe,
  customers: { customerId: string; stripeAccount: string | undefined }[],
  invoices: InvoiceWithAccount[],
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<Map<string, CardSummaryLike>> {
  const cardByCustomerId = new Map<string, CardSummaryLike>();
  const needLookup: { customerId: string; stripeAccount: string | undefined }[] = [];

  const expandedCustomers = new Map<string, Stripe.Customer>();
  for (const { invoice } of invoices) {
    const customer = invoice.customer;
    if (customer && typeof customer !== 'string' && !customer.deleted) expandedCustomers.set(customer.id, customer);
  }

  for (const entry of customers) {
    const customer = expandedCustomers.get(entry.customerId);
    const defaultPm = customer?.invoice_settings?.default_payment_method;
    if (defaultPm && typeof defaultPm !== 'string' && defaultPm.type === 'card') {
      cardByCustomerId.set(entry.customerId, {
        brand: defaultPm.card?.brand ?? '',
        last4: defaultPm.card?.last4 ?? '',
      });
      continue;
    }
    const defaultSource = customer?.default_source;
    if (defaultSource && typeof defaultSource !== 'string' && defaultSource.object === 'card') {
      const source = defaultSource as Stripe.Card;
      cardByCustomerId.set(entry.customerId, {
        brand: source.brand?.toLowerCase() ?? '',
        last4: source.last4 ?? '',
      });
      continue;
    }
    needLookup.push(entry);
  }

  const looked: Map<string, CardSummary> = await lookupCardsWithDirectory(
    oystehr,
    secrets,
    stripe,
    needLookup,
    async (done) => {
      if (done % 100 < 8 || done === needLookup.length) await onProgress?.(done, needLookup.length);
    }
  );
  for (const [customerId, card] of looked) {
    cardByCustomerId.set(customerId, { brand: card.brand, last4: card.last4 });
  }
  return cardByCustomerId;
}

async function fetchPatientsById(oystehr: Oystehr, patientIds: string[]): Promise<Map<string, Patient>> {
  const byId = new Map<string, Patient>();
  for (let i = 0; i < patientIds.length; i += PATIENT_BATCH_SIZE) {
    const batch = patientIds.slice(i, i + PATIENT_BATCH_SIZE);
    const bundle = await oystehr.fhir.search<Patient>({
      resourceType: 'Patient',
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_elements', value: 'id,name' },
        { name: '_count', value: String(batch.length) },
      ],
    });
    for (const patient of bundle.unbundle()) {
      if (patient.id) byId.set(patient.id, patient);
    }
  }
  return byId;
}

interface VisitSummary {
  visitDate: string;
  appointmentId: string;
}

async function fetchVisitsByEncounterId(oystehr: Oystehr, encounterIds: string[]): Promise<Map<string, VisitSummary>> {
  const byEncounterId = new Map<string, VisitSummary>();
  for (let i = 0; i < encounterIds.length; i += PATIENT_BATCH_SIZE) {
    const batch = encounterIds.slice(i, i + PATIENT_BATCH_SIZE);
    const resources = (
      await oystehr.fhir.search<Encounter | Appointment>({
        resourceType: 'Encounter',
        params: [
          { name: '_id', value: batch.join(',') },
          { name: '_include', value: 'Encounter:appointment' },
          { name: '_count', value: String(batch.length) },
        ],
      })
    ).unbundle();
    const appointmentsById = new Map(
      resources.filter((r): r is Appointment => r.resourceType === 'Appointment').map((a) => [a.id ?? '', a])
    );
    for (const resource of resources) {
      if (resource.resourceType !== 'Encounter' || !resource.id) continue;
      const appointmentId =
        resource.appointment
          ?.map((ref) => ref.reference?.replace('Appointment/', ''))
          .find((id): id is string => !!id) ?? '';
      const appointment = appointmentsById.get(appointmentId);
      byEncounterId.set(resource.id, {
        visitDate: resource.period?.start ?? appointment?.start ?? '',
        appointmentId,
      });
    }
  }
  return byEncounterId;
}

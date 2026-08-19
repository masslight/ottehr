import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Encounter, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  GetBillingInvoiceReportResponse,
  InvoiceAgingTrendPoint,
  InvoiceReportCategory,
  InvoiceReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { gunzipSync, gzipSync } from 'zlib';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { wrapHandler } from '../../../shared/sentry';
import {
  encounterIdFromStripeMetadata,
  getStripeClient,
  patientIdFromStripeMetadata,
} from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { createBillingClient, createEraReadClient, fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { GetBillingInvoiceReportParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-invoice-report';

const PATIENT_BATCH_SIZE = 100;
const PM_LOOKUP_CONCURRENCY = 8;

const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
const CACHE_KEY = 'invoice-report:v2';
// stay well under FHIR resource size limits
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // patients are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, untaggedClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

interface InvoiceWithAccount {
  invoice: Stripe.Invoice;
  stripeAccount: string | undefined;
}

export async function performEffect(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: GetBillingInvoiceReportParams
): Promise<GetBillingInvoiceReportResponse> {
  // latest saved report is served as-is; a new computation only happens on explicit refresh
  if (!params.refresh) {
    const cached = await loadCachedReport(oystehr);
    if (cached) return { ...cached, fromCache: true };
  }

  const stripe = getStripeClient(params.secrets);
  const generatedAt = DateTime.now().toUTC().toISO();
  const nowSeconds = Math.floor(Date.now() / 1000);

  const accounts = await listStripeAccounts(oystehr);
  const [invoices, allInvoices] = await Promise.all([
    listOpenInvoices(stripe, accounts),
    listAllInvoices(stripe, accounts),
  ]);
  const agingTrend = computeAgingTrend(allInvoices);

  // card-on-file only matters for past-due invoices, so the lookup is scoped to those customers
  const pastDueCustomers = new Map<string, { customerId: string; stripeAccount: string | undefined }>();
  for (const { invoice, stripeAccount } of invoices) {
    if (!isPastDue(invoice, nowSeconds)) continue;
    const customerId = customerIdOf(invoice);
    if (customerId) pastDueCustomers.set(customerId, { customerId, stripeAccount });
  }
  const cardByCustomerId = await resolveCards(stripe, [...pastDueCustomers.values()], invoices);

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

  const rows: InvoiceReportRow[] = invoices.map(({ invoice, stripeAccount }) => {
    const customerId = customerIdOf(invoice) ?? '';
    const card = cardByCustomerId.get(customerId);
    const pastDue = isPastDue(invoice, nowSeconds);
    const category: InvoiceReportCategory = !pastDue ? 'upcoming' : card ? 'past-due-failed' : 'past-due-no-card';
    const patientId = patientIdOf(invoice) ?? '';
    const patient = isValidUUID(patientId) ? patientsById.get(patientId) : undefined;
    const charge = typeof invoice.charge === 'string' ? undefined : invoice.charge;
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

  const totals: GetBillingInvoiceReportResponse['totals'] = {
    upcoming: { count: 0, amountDue: 0 },
    'past-due-no-card': { count: 0, amountDue: 0 },
    'past-due-failed': { count: 0, amountDue: 0 },
  };
  for (const row of rows) {
    totals[row.category].count += 1;
    totals[row.category].amountDue += row.amountDue;
  }

  const response: GetBillingInvoiceReportResponse = { rows, totals, agingTrend, generatedAt, fromCache: false };
  await saveCachedReport(oystehr, response);
  return response;
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

// month-end snapshots: an invoice counts at T if finalized by T and not yet paid/voided/uncollectible at T
function computeAgingTrend(invoices: InvoiceWithAccount[]): InvoiceAgingTrendPoint[] {
  const now = DateTime.now();
  const snapshots = [
    ...Array.from({ length: TREND_MONTHS }, (_v, i) => now.minus({ months: TREND_MONTHS - i }).endOf('month')),
    now,
  ];
  return snapshots.map((snapshot) => {
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
      if (invoice.due_date && invoice.due_date <= t) {
        const days = Math.floor((t - invoice.due_date) / 86400);
        key = (TREND_BUCKETS.find((bucket) => days >= bucket.minDays && days < bucket.maxDays) ?? TREND_BUCKETS[0]).key;
      }
      buckets[key].count += 1;
      buckets[key].amountDue += amount;
    }
    return {
      snapshotDate: snapshot.toUTC().toISO() ?? '',
      label: snapshot.toFormat('MMM yyyy'),
      buckets,
    };
  });
}

// all invoices regardless of status; lean listing (no expansions) used only for the aging trend
async function listAllInvoices(stripe: Stripe, accounts: (string | undefined)[]): Promise<InvoiceWithAccount[]> {
  const invoices: InvoiceWithAccount[] = [];
  const seenInvoiceIds = new Set<string>();
  for (const stripeAccount of accounts) {
    try {
      const listing = stripe.invoices.list({ limit: 100 }, { stripeAccount });
      for await (const invoice of listing) {
        if (seenInvoiceIds.has(invoice.id)) continue;
        seenInvoiceIds.add(invoice.id);
        invoices.push({ invoice, stripeAccount });
      }
    } catch (err) {
      console.warn(`Failed to list invoices for account ${stripeAccount ?? 'platform'}:`, (err as Error)?.message);
    }
  }
  return invoices;
}

async function findCacheDocument(oystehr: Oystehr): Promise<DocumentReference | undefined> {
  const bundle = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      { name: 'identifier', value: `${REPORT_IDENTIFIER_SYSTEM}|${CACHE_KEY}` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle()[0];
}

async function loadCachedReport(oystehr: Oystehr): Promise<GetBillingInvoiceReportResponse | undefined> {
  try {
    const document = await findCacheDocument(oystehr);
    const data = document?.content?.[0]?.attachment?.data;
    if (!data) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    return JSON.parse(gunzipSync(new Uint8Array(Buffer.from(data, 'base64'))).toString('utf8'));
  } catch (err) {
    console.warn('Failed to load saved invoice report:', (err as Error)?.message);
    return undefined;
  }
}

// gzipped JSON in a DocumentReference attachment, same pattern as the cards-on-file report
async function saveCachedReport(oystehr: Oystehr, response: GetBillingInvoiceReportResponse): Promise<void> {
  try {
    const data = gzipSync(new Uint8Array(Buffer.from(JSON.stringify(response), 'utf8'))).toString('base64');
    if (data.length > MAX_CACHE_BYTES) {
      console.warn(`Invoice report too large to cache (${data.length} bytes); skipping save`);
      return;
    }
    const document: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: CACHE_KEY }],
      date: response.generatedAt,
      content: [
        {
          attachment: {
            contentType: 'application/gzip',
            title: 'invoice-report.json.gz',
            data,
          },
        },
      ],
    };
    const existing = await findCacheDocument(oystehr);
    if (existing?.id) {
      await oystehr.fhir.update<DocumentReference>({ ...document, id: existing.id });
    } else {
      await oystehr.fhir.create<DocumentReference>(document);
    }
  } catch (err) {
    // the cache is an optimization; a failed write must not fail the report
    console.error('Failed to save invoice report:', err);
  }
}

const isPastDue = (invoice: Stripe.Invoice, nowSeconds: number): boolean =>
  !!invoice.due_date && invoice.due_date < nowSeconds;

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

// platform account plus connected accounts stamped on billing provider organizations
async function listStripeAccounts(oystehr: Oystehr): Promise<(string | undefined)[]> {
  const orgs = (
    await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        { name: '_elements', value: 'id,identifier' },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();
  const connectedAccounts = [
    ...new Set(
      orgs
        .flatMap((org) => org.identifier ?? [])
        .filter((identifier) => identifier.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)
        .map((identifier) => identifier.value)
        .filter((value): value is string => !!value)
    ),
  ];
  return [undefined, ...connectedAccounts];
}

// open Stripe invoices = due or past due; customer + latest charge expanded for card/failure context
async function listOpenInvoices(stripe: Stripe, accounts: (string | undefined)[]): Promise<InvoiceWithAccount[]> {
  const invoices: InvoiceWithAccount[] = [];
  const seenInvoiceIds = new Set<string>();
  for (const stripeAccount of accounts) {
    try {
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
      }
    } catch (err) {
      console.warn(`Failed to list open invoices for account ${stripeAccount ?? 'platform'}:`, (err as Error)?.message);
    }
  }
  return invoices;
}

interface CardSummary {
  brand: string;
  last4: string;
}

// default payment method, else legacy default card source, else the first attached card
async function resolveCards(
  stripe: Stripe,
  customers: { customerId: string; stripeAccount: string | undefined }[],
  invoices: InvoiceWithAccount[]
): Promise<Map<string, CardSummary>> {
  const cardByCustomerId = new Map<string, CardSummary>();
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

  for (let i = 0; i < needLookup.length; i += PM_LOOKUP_CONCURRENCY) {
    await Promise.all(
      needLookup.slice(i, i + PM_LOOKUP_CONCURRENCY).map(async ({ customerId, stripeAccount }) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const methods = await stripe.paymentMethods.list(
              { customer: customerId, type: 'card', limit: 1 },
              { stripeAccount }
            );
            const method = methods.data[0];
            if (method) {
              cardByCustomerId.set(customerId, {
                brand: method.card?.brand ?? '',
                last4: method.card?.last4 ?? '',
              });
            }
            return;
          } catch (err) {
            const rateLimited = (err as Stripe.errors.StripeError)?.type === 'StripeRateLimitError';
            if (rateLimited && attempt < 2) {
              await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
              continue;
            }
            console.warn(`Failed to list payment methods for ${customerId}:`, (err as Error)?.message);
            return;
          }
        }
      })
    );
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

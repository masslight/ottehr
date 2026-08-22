import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { CardOnFileReportRow, GetBillingCardsOnFileReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { gunzipSync, gzipSync } from 'zlib';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { fetchAllPages } from '../../../shared/fhir';
import { wrapHandler } from '../../../shared/sentry';
import { getRateLimitedStripeClient, patientIdFromStripeMetadata } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { createBillingClient, createEraReadClient, fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { findActiveRefreshTask, kickOffRefreshTask } from '../refresh-task';
import { GetBillingCardsOnFileReportParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-cards-on-file-report';

const CUSTOMER_PAGE_SIZE = 100;
// hard guard against runaway accounts; the response flags truncation when hit
const MAX_CUSTOMERS = 50000;
const PATIENT_BATCH_SIZE = 100;
const APPOINTMENT_BATCH_SIZE = 50;
// conservative: Stripe rate limits kicked in at higher parallelism
const PM_LOOKUP_CONCURRENCY = 8;
// fallback paymentMethods.list calls per invocation; the rest queue up for continueLookups calls
const PM_LOOKUPS_PER_RUN = 500;
// beyond this the drain can't finish inside the worker timeout; excess customers report no card
const MAX_PENDING_LOOKUPS = 5000;

const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
const CACHE_KEY = 'cards-on-file:v4';
// stay well under FHIR resource size limits
const MAX_CACHE_BYTES = 4 * 1024 * 1024;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // patients/appointments are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, untaggedClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

interface CustomerWithAccount {
  customer: Stripe.Customer;
  stripeAccount: string | undefined;
}

interface PendingLookup {
  customerId: string;
  stripeAccount: string | undefined;
}

// the saved report plus the queue of customers still awaiting a fallback card lookup
type CachedReportState = GetBillingCardsOnFileReportResponse & { pendingLookups?: PendingLookup[] };

const stripState = (state: CachedReportState, fromCache: boolean): GetBillingCardsOnFileReportResponse => {
  const { pendingLookups: _pendingLookups, ...response } = state;
  return { ...response, fromCache };
};

const emptyReport = (): GetBillingCardsOnFileReportResponse => ({
  rows: [],
  totals: { customers: 0, withCard: 0, withoutCard: 0, withOpenInvoices: 0 },
  pendingCardLookups: 0,
  truncated: false,
  generatedAt: '',
  fromCache: false,
});

// HTTP path: serves the cache and queues async refreshes; the subscription worker computes.
export async function performEffect(
  oystehr: Oystehr,
  _untaggedClient: Oystehr,
  params: GetBillingCardsOnFileReportParams
): Promise<GetBillingCardsOnFileReportResponse> {
  if (params.continueLookups) {
    const resumed = await continueCardLookups(oystehr, params.secrets);
    if (resumed) return resumed;
  }

  if (params.refresh) {
    const task = await kickOffRefreshTask(oystehr, 'cards-on-file');
    const cached = await loadCachedState(oystehr);
    return {
      ...(cached ? stripState(cached, true) : emptyReport()),
      refreshing: true,
      refreshProgress: task.businessStatus?.text ?? 'queued',
    };
  }

  const cached = await loadCachedState(oystehr);
  if (cached) {
    const active = await findActiveRefreshTask(oystehr, 'cards-on-file');
    return {
      ...stripState(cached, true),
      refreshing: !!active,
      ...(active?.businessStatus?.text ? { refreshProgress: active.businessStatus.text } : {}),
    };
  }

  // never computed: queue the first build instead of risking the request timeout
  const task = await kickOffRefreshTask(oystehr, 'cards-on-file');
  return { ...emptyReport(), refreshing: true, refreshProgress: task.businessStatus?.text ?? 'queued' };
}

// Full recomputation + cache save + queued-lookup drain; runs inside the subscription worker.
export async function computeAndCacheCardsOnFileReport(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  secrets: ZambdaInput['secrets'],
  onProgress?: (message: string) => Promise<void>
): Promise<GetBillingCardsOnFileReportResponse> {
  let response = await computeCardsReport(oystehr, untaggedClient, secrets, onProgress);
  const totalLookups = response.pendingCardLookups;
  let guard = 0;
  while (response.pendingCardLookups > 0 && guard < 200) {
    const previousPending = response.pendingCardLookups;
    await onProgress?.(`resolving cards ${totalLookups - previousPending}/${totalLookups}…`);
    response = (await continueCardLookups(oystehr, secrets)) ?? response;
    if (response.pendingCardLookups >= previousPending) break;
    guard += 1;
  }
  return response;
}

async function computeCardsReport(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  secrets: ZambdaInput['secrets'],
  onProgress?: (message: string) => Promise<void>
): Promise<GetBillingCardsOnFileReportResponse> {
  const stripe = getRateLimitedStripeClient(secrets);
  const generatedAt = DateTime.now().toUTC().toISO();

  await onProgress?.('listing Stripe accounts…');
  const accounts = await listStripeAccounts(oystehr, stripe);
  await onProgress?.('listing customers and invoices…');
  const [customers, openInvoicesByCustomerId] = await Promise.all([
    listAllCustomers(stripe, accounts),
    fetchOpenInvoices(stripe, accounts),
  ]);
  const truncated = customers.length >= MAX_CUSTOMERS;
  if (customers.length === 0) {
    return {
      rows: [],
      totals: { customers: 0, withCard: 0, withoutCard: 0, withOpenInvoices: 0 },
      pendingCardLookups: 0,
      truncated,
      generatedAt,
      fromCache: false,
    };
  }

  // customers with open invoices get their fallback lookups in the first batch
  const { cardByCustomerId, pending } = await resolveCards(stripe, customers, new Set(openInvoicesByCustomerId.keys()));
  await onProgress?.('matching patients…');

  const patientIds = [
    ...new Set(
      customers
        .map(({ customer }) => patientIdFromStripeMetadata(customer.metadata))
        .filter((id): id is string => !!id && isValidUUID(id))
    ),
  ];
  const [patientsById, lastVisitByPatientId] = await Promise.all([
    fetchPatientsById(untaggedClient, patientIds),
    fetchLastVisits(untaggedClient, patientIds),
  ]);

  const rows: CardOnFileReportRow[] = customers.map(({ customer, stripeAccount }) => {
    const patientId = patientIdFromStripeMetadata(customer.metadata) ?? '';
    const patient = isValidUUID(patientId) ? patientsById.get(patientId) : undefined;
    const lastVisit = isValidUUID(patientId) ? lastVisitByPatientId.get(patientId) : undefined;
    const card = cardByCustomerId.get(customer.id);
    const openInvoices = openInvoicesByCustomerId.get(customer.id);
    return {
      stripeCustomerId: customer.id,
      customerName: customer.name ?? customer.email ?? '',
      stripeAccountId: stripeAccount ?? '',
      livemode: customer.livemode,
      patientId: patient?.id ?? '',
      patientName: fhirName(patient),
      cardId: card?.id ?? '',
      cardBrand: card?.brand ?? '',
      cardLast4: card?.last4 ?? '',
      lastVisitDate: lastVisit?.start ?? '',
      lastVisitAppointmentId: lastVisit?.id ?? '',
      openInvoiceCount: openInvoices?.count ?? 0,
      openInvoiceAmount: openInvoices?.amountDue ?? 0,
      hasPastDueInvoice: openInvoices?.pastDue ?? false,
    };
  });

  rows.sort((a, b) => (a.patientName || a.customerName).localeCompare(b.patientName || b.customerName));

  const withCard = rows.filter((row) => row.cardId).length;
  const withOpenInvoices = rows.filter((row) => row.openInvoiceCount > 0).length;
  const boundedPending = pending.slice(0, MAX_PENDING_LOOKUPS);
  if (boundedPending.length < pending.length) {
    console.warn(`Capping fallback card lookups at ${MAX_PENDING_LOOKUPS} of ${pending.length}`);
  }
  const state: CachedReportState = {
    rows,
    totals: { customers: rows.length, withCard, withoutCard: rows.length - withCard, withOpenInvoices },
    pendingCardLookups: boundedPending.length,
    truncated: truncated || boundedPending.length < pending.length,
    generatedAt,
    fromCache: false,
    ...(boundedPending.length > 0 ? { pendingLookups: boundedPending } : {}),
  };
  await saveCachedReport(oystehr, state);
  return stripState(state, false);
}

// One batch of queued fallback lookups against the saved report; undefined when there is no saved report.
async function continueCardLookups(
  oystehr: Oystehr,
  secrets: ZambdaInput['secrets']
): Promise<GetBillingCardsOnFileReportResponse | undefined> {
  const state = await loadCachedState(oystehr);
  if (!state) return undefined;
  const pending = state.pendingLookups ?? [];
  if (pending.length === 0) return stripState(state, true);

  const stripe = getRateLimitedStripeClient(secrets);
  const batch = pending.slice(0, PM_LOOKUPS_PER_RUN);
  const rest = pending.slice(PM_LOOKUPS_PER_RUN);
  const cards = await lookupCards(stripe, batch);

  const rowByCustomerId = new Map(state.rows.map((row) => [row.stripeCustomerId, row]));
  for (const [customerId, card] of cards) {
    const row = rowByCustomerId.get(customerId);
    if (row) {
      row.cardId = card.id;
      row.cardBrand = card.brand;
      row.cardLast4 = card.last4;
    }
  }

  const withCard = state.rows.filter((row) => row.cardId).length;
  state.totals = { ...state.totals, withCard, withoutCard: state.rows.length - withCard };
  state.pendingCardLookups = rest.length;
  state.pendingLookups = rest;
  await saveCachedReport(oystehr, state);
  return stripState(state, false);
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

async function loadCachedState(oystehr: Oystehr): Promise<CachedReportState | undefined> {
  try {
    const document = await findCacheDocument(oystehr);
    const data = document?.content?.[0]?.attachment?.data;
    if (!data) return undefined;
    // plain Uint8Array keeps zlib typings happy across @types/node versions
    return JSON.parse(gunzipSync(new Uint8Array(Buffer.from(data, 'base64'))).toString('utf8'));
  } catch (err) {
    console.warn('Failed to load saved cards-on-file report:', (err as Error)?.message);
    return undefined;
  }
}

// gzipped JSON in a DocumentReference attachment: the full row set is too large for a readable
// FHIR structure, and this project's M2M has FHIR write access where z3 is forbidden
async function saveCachedReport(oystehr: Oystehr, state: CachedReportState): Promise<void> {
  try {
    const encode = (s: CachedReportState): string =>
      gzipSync(new Uint8Array(Buffer.from(JSON.stringify(s), 'utf8'))).toString('base64');
    // an unsaved cache would strand the async refresh loop, so shed data until it fits:
    // the resumable lookup queue first, then tail rows (alphabetical order keeps the head stable)
    let toSave = state;
    let data = encode(toSave);
    if (data.length > MAX_CACHE_BYTES && (toSave.pendingLookups?.length ?? 0) > 0) {
      console.warn(`Cards-on-file cache over ${MAX_CACHE_BYTES} bytes; dropping pending lookup queue`);
      toSave = { ...toSave, pendingLookups: undefined, pendingCardLookups: 0, truncated: true };
      data = encode(toSave);
    }
    while (data.length > MAX_CACHE_BYTES && toSave.rows.length > 1) {
      toSave = { ...toSave, rows: toSave.rows.slice(0, Math.floor(toSave.rows.length / 2)), truncated: true };
      data = encode(toSave);
    }
    if (toSave !== state) {
      console.warn(`Cards-on-file cache truncated to ${toSave.rows.length}/${state.rows.length} rows to fit`);
    }
    const document: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: CACHE_KEY }],
      date: state.generatedAt,
      content: [
        {
          attachment: {
            contentType: 'application/gzip',
            title: 'cards-on-file.json.gz',
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
    console.error('Failed to save cards-on-file report:', err);
  }
}

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

interface OpenInvoiceSummary {
  count: number;
  amountDue: number;
  pastDue: boolean;
}

// open Stripe invoices = due; past due when the due date has passed
async function fetchOpenInvoices(
  stripe: Stripe,
  accounts: (string | undefined)[]
): Promise<Map<string, OpenInvoiceSummary>> {
  const byCustomerId = new Map<string, OpenInvoiceSummary>();
  const nowSeconds = Math.floor(Date.now() / 1000);
  // account failures propagate: a partial result must not be cached as the complete report
  for (const stripeAccount of accounts) {
    const listing = stripe.invoices.list({ status: 'open', limit: 100 }, { stripeAccount });
    for await (const invoice of listing) {
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) continue;
      const summary = byCustomerId.get(customerId) ?? { count: 0, amountDue: 0, pastDue: false };
      summary.count += 1;
      summary.amountDue += (invoice.amount_due ?? 0) / 100;
      // no due_date = automatic collection; an open invoice with attempts means the charge failed
      if (invoice.due_date ? invoice.due_date < nowSeconds : (invoice.attempt_count ?? 0) > 0) {
        summary.pastDue = true;
      }
      byCustomerId.set(customerId, summary);
    }
  }
  return byCustomerId;
}

async function listAllCustomers(stripe: Stripe, accounts: (string | undefined)[]): Promise<CustomerWithAccount[]> {
  const customers: CustomerWithAccount[] = [];
  // the platform key and a connected-account listing can return the same customer objects
  const seenCustomerIds = new Set<string>();
  // account failures propagate: a partial result must not be cached as the complete report
  for (const stripeAccount of accounts) {
    // auto-pagination walks every page; default_source expanded so legacy card customers skip the PM lookup
    const listing = stripe.customers.list(
      {
        limit: CUSTOMER_PAGE_SIZE,
        expand: ['data.invoice_settings.default_payment_method', 'data.default_source'],
      },
      { stripeAccount }
    );
    for await (const customer of listing) {
      if (seenCustomerIds.has(customer.id)) continue;
      seenCustomerIds.add(customer.id);
      customers.push({ customer, stripeAccount });
      if (customers.length >= MAX_CUSTOMERS) break;
    }
    if (customers.length >= MAX_CUSTOMERS) break;
  }
  return customers;
}

interface CardSummary {
  id: string;
  brand: string;
  last4: string;
}

// default payment method, else legacy default card source, else the first attached card (first
// batch now, the rest queued for continueLookups calls)
async function resolveCards(
  stripe: Stripe,
  customers: CustomerWithAccount[],
  priorityCustomerIds: Set<string>
): Promise<{ cardByCustomerId: Map<string, CardSummary>; pending: PendingLookup[] }> {
  const cardByCustomerId = new Map<string, CardSummary>();
  const needLookup: CustomerWithAccount[] = [];

  for (const entry of customers) {
    const defaultPm = entry.customer.invoice_settings?.default_payment_method;
    if (defaultPm && typeof defaultPm !== 'string' && defaultPm.type === 'card') {
      cardByCustomerId.set(entry.customer.id, {
        id: defaultPm.id,
        brand: defaultPm.card?.brand ?? '',
        last4: defaultPm.card?.last4 ?? '',
      });
      continue;
    }
    const defaultSource = entry.customer.default_source;
    if (defaultSource && typeof defaultSource !== 'string' && defaultSource.object === 'card') {
      const source = defaultSource as Stripe.Card;
      cardByCustomerId.set(entry.customer.id, {
        id: source.id,
        brand: source.brand?.toLowerCase() ?? '',
        last4: source.last4 ?? '',
      });
      continue;
    }
    needLookup.push(entry);
  }

  // open-invoice customers go in the first batch; the rest queue up in order
  const prioritized: PendingLookup[] = [
    ...needLookup.filter((entry) => priorityCustomerIds.has(entry.customer.id)),
    ...needLookup.filter((entry) => !priorityCustomerIds.has(entry.customer.id)),
  ].map(({ customer, stripeAccount }) => ({ customerId: customer.id, stripeAccount }));
  const batch = prioritized.slice(0, PM_LOOKUPS_PER_RUN);
  const pending = prioritized.slice(PM_LOOKUPS_PER_RUN);

  const looked = await lookupCards(stripe, batch);
  for (const [customerId, card] of looked) cardByCustomerId.set(customerId, card);
  return { cardByCustomerId, pending };
}

// batched paymentMethods.list per customer, with rate-limit retries. A lookup that still fails
// throws: "no card" is a billing fact, so an error must not be cached as one. The thrown
// invocation leaves the previous cache and pending queue intact, making the batch retryable.
async function lookupCards(stripe: Stripe, entries: PendingLookup[]): Promise<Map<string, CardSummary>> {
  const cardByCustomerId = new Map<string, CardSummary>();
  for (let i = 0; i < entries.length; i += PM_LOOKUP_CONCURRENCY) {
    await Promise.all(
      entries.slice(i, i + PM_LOOKUP_CONCURRENCY).map(async ({ customerId, stripeAccount }) => {
        for (let attempt = 0; ; attempt++) {
          try {
            const methods = await stripe.paymentMethods.list(
              { customer: customerId, type: 'card', limit: 1 },
              { stripeAccount }
            );
            const method = methods.data[0];
            if (method) {
              cardByCustomerId.set(customerId, {
                id: method.id,
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
            throw new Error(`Failed to list payment methods for ${customerId}: ${(err as Error)?.message}`);
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

// most recent non-cancelled appointment per patient
async function fetchLastVisits(
  oystehr: Oystehr,
  patientIds: string[]
): Promise<Map<string, { id: string; start: string }>> {
  const lastByPatientId = new Map<string, { id: string; start: string }>();
  for (let i = 0; i < patientIds.length; i += APPOINTMENT_BATCH_SIZE) {
    const batch = patientIds.slice(i, i + APPOINTMENT_BATCH_SIZE);
    const appointments: Appointment[] = [];
    // upper-bounded so a future booked appointment can't show as the last visit
    const nowISO = DateTime.now().toUTC().toISO() ?? '';
    await fetchAllPages(async (offset, count) => {
      const bundle = await oystehr.fhir.search<Appointment>({
        resourceType: 'Appointment',
        params: [
          { name: 'patient', value: batch.map((id) => `Patient/${id}`).join(',') },
          { name: 'status:not', value: 'cancelled' },
          { name: 'date', value: `le${nowISO}` },
          { name: '_elements', value: 'id,start,participant,status' },
          { name: '_count', value: String(count) },
          { name: '_offset', value: String(offset) },
        ],
      });
      appointments.push(...bundle.unbundle());
      return bundle;
    }, 200);

    for (const appointment of appointments) {
      if (!appointment.id || !appointment.start) continue;
      const patientId = appointment.participant
        ?.map((participant) => participant.actor?.reference)
        .find((ref) => ref?.startsWith('Patient/'))
        ?.replace('Patient/', '');
      if (!patientId) continue;
      const existing = lastByPatientId.get(patientId);
      if (!existing || appointment.start > existing.start) {
        lastByPatientId.set(patientId, { id: appointment.id, start: appointment.start });
      }
    }
  }
  return lastByPatientId;
}

import Oystehr from '@oystehr/sdk';
import { Appointment, Organization, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { EmptyReportParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { CardOnFileReportRow, GetBillingCardsOnFileReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { fetchAllPages } from '../../../shared/fhir';
import { getRateLimitedStripeClient, patientIdFromStripeMetadata } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { CardSummary, lookupCardsWithDirectory } from '../card-directory';
import { fullCacheKey, loadReportCache, saveReportCache } from '../framework/report-cache';
import { ReportDefinition } from '../framework/types';

const CUSTOMER_PAGE_SIZE = 100;
// hard guard against runaway accounts; the response flags truncation when hit
const MAX_CUSTOMERS = 50000;
const PATIENT_BATCH_SIZE = 100;
const APPOINTMENT_BATCH_SIZE = 50;
// fallback card lookups per drain batch; the rest stay queued in the cache. Directory hits
// are free, so a warm shared cache drains far faster than this bound suggests.
const PM_LOOKUPS_PER_RUN = 500;
// beyond this the drain can't finish inside the worker timeout; excess customers report no card
const MAX_PENDING_LOOKUPS = 5000;

interface CustomerWithAccount {
  customer: Stripe.Customer;
  stripeAccount: string | undefined;
}

interface PendingLookup {
  customerId: string;
  stripeAccount: string | undefined;
}

// cached payload carries the pending fallback-lookup queue; sanitizePayload strips it
type CardsOnFilePayload = Omit<GetBillingCardsOnFileReportResponse, 'fromCache' | 'status'> & {
  pendingLookups?: PendingLookup[];
};

const stripState = (state: CardsOnFilePayload): CardsOnFilePayload => {
  const { pendingLookups: _pendingLookups, ...payload } = state;
  return payload;
};

export const cardsOnFileReport: ReportDefinition<Record<string, never>, CardsOnFilePayload> = {
  kind: 'cards-on-file',
  cacheVersion: 'v1',
  paramsSchema: EmptyReportParamsSchema,
  cacheKeyOf: () => '',
  emptyPayload: () => ({
    rows: [],
    totals: { customers: 0, withCard: 0, withoutCard: 0, withOpenInvoices: 0 },
    pendingCardLookups: 0,
    truncated: false,
    generatedAt: '',
  }),
  // compute persists intermediate drain state itself
  savesOwnCache: true,
  sanitizePayload: stripState,
  // shed the lookup queue first, then tail rows
  shrink: (payload) => {
    if ((payload.pendingLookups?.length ?? 0) > 0) {
      console.warn('Cards-on-file cache over the size cap; dropping pending lookup queue');
      return { ...payload, pendingLookups: undefined, pendingCardLookups: 0, truncated: true };
    }
    if (payload.rows.length > 1) {
      return { ...payload, rows: payload.rows.slice(0, Math.floor(payload.rows.length / 2)), truncated: true };
    }
    return undefined;
  },
  compute: async (ctx, _params, onProgress) => ({
    payload: await computeAndDrainCardsReport(ctx.oystehr, ctx.untaggedClient, ctx.secrets, onProgress),
  }),
  summarize: (payload) => `cards-on-file report cached (${payload.totals.customers} customers)`,
};

const cacheKey = (): string => fullCacheKey(cardsOnFileReport, {});

const saveState = (oystehr: Oystehr, state: CardsOnFilePayload): Promise<void> =>
  saveReportCache(oystehr, cardsOnFileReport, cacheKey(), state);

// full recomputation + queued-lookup drain
async function computeAndDrainCardsReport(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  secrets: ZambdaInput['secrets'],
  onProgress?: (message: string) => Promise<void>
): Promise<CardsOnFilePayload> {
  let state = await computeCardsReport(oystehr, untaggedClient, secrets, onProgress);
  const totalLookups = state.pendingCardLookups;
  let guard = 0;
  while (state.pendingCardLookups > 0 && guard < 200) {
    const previousPending = state.pendingCardLookups;
    await onProgress?.(`resolving cards ${totalLookups - previousPending}/${totalLookups}…`);
    state = (await continueCardLookups(oystehr, secrets)) ?? state;
    if (state.pendingCardLookups >= previousPending) break;
    guard += 1;
  }
  return state;
}

async function computeCardsReport(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  secrets: ZambdaInput['secrets'],
  onProgress?: (message: string) => Promise<void>
): Promise<CardsOnFilePayload> {
  const stripe = getRateLimitedStripeClient(secrets);
  const generatedAt = DateTime.now().toUTC().toISO();

  await onProgress?.('listing Stripe accounts…');
  const accounts = await listStripeAccounts(oystehr, stripe);
  await onProgress?.('listing customers and invoices…');
  const [customers, openInvoicesByCustomerId] = await Promise.all([
    listAllCustomers(stripe, accounts, async (count) => {
      await onProgress?.(`listing customers… ${count.toLocaleString('en-US')} so far`);
    }),
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
    };
  }

  // customers with open invoices get their fallback lookups in the first batch
  const { cardByCustomerId, pending } = await resolveCards(
    oystehr,
    stripe,
    customers,
    new Set(openInvoicesByCustomerId.keys()),
    async (done, total) => {
      await onProgress?.(
        `checking cards for ${done.toLocaleString('en-US')}/${total.toLocaleString('en-US')} customers…`
      );
    }
  );

  const patientIds = [
    ...new Set(
      customers
        .map(({ customer }) => patientIdFromStripeMetadata(customer.metadata))
        .filter((id): id is string => !!id && isValidUUID(id))
    ),
  ];
  await onProgress?.(`matching ${patientIds.length.toLocaleString('en-US')} patients…`);
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
  const state: CardsOnFilePayload = {
    rows,
    totals: { customers: rows.length, withCard, withoutCard: rows.length - withCard, withOpenInvoices },
    pendingCardLookups: boundedPending.length,
    truncated: truncated || boundedPending.length < pending.length,
    generatedAt,
    ...(boundedPending.length > 0 ? { pendingLookups: boundedPending } : {}),
  };
  await saveState(oystehr, state);
  return state;
}

// One batch of queued fallback lookups against the saved report; undefined when there is no saved report.
async function continueCardLookups(
  oystehr: Oystehr,
  secrets: ZambdaInput['secrets']
): Promise<CardsOnFilePayload | undefined> {
  const state = await loadReportCache<CardsOnFilePayload>(oystehr, cacheKey());
  if (!state) return undefined;
  const pending = state.pendingLookups ?? [];
  if (pending.length === 0) return state;

  const stripe = getRateLimitedStripeClient(secrets);
  const batch = pending.slice(0, PM_LOOKUPS_PER_RUN);
  const rest = pending.slice(PM_LOOKUPS_PER_RUN);
  const cards = await lookupCardsWithDirectory(oystehr, stripe, batch);

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
  await saveState(oystehr, state);
  return state;
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

async function listAllCustomers(
  stripe: Stripe,
  accounts: (string | undefined)[],
  onCount?: (count: number) => Promise<void>
): Promise<CustomerWithAccount[]> {
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
      if (customers.length % 1000 === 0) await onCount?.(customers.length);
      if (customers.length >= MAX_CUSTOMERS) break;
    }
    if (customers.length >= MAX_CUSTOMERS) break;
  }
  return customers;
}

interface CardSummaryLike {
  id: string;
  brand: string;
  last4: string;
}

// default payment method, else legacy default card source, else the shared card directory
// (first batch now, the rest queued for continueLookups calls)
async function resolveCards(
  oystehr: Oystehr,
  stripe: Stripe,
  customers: CustomerWithAccount[],
  priorityCustomerIds: Set<string>,
  onProgress?: (done: number, total: number) => Promise<void>
): Promise<{ cardByCustomerId: Map<string, CardSummaryLike>; pending: PendingLookup[] }> {
  const cardByCustomerId = new Map<string, CardSummaryLike>();
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

  let lastReported = 0;
  const looked: Map<string, CardSummary> = await lookupCardsWithDirectory(oystehr, stripe, batch, async (done) => {
    if (done - lastReported >= 100 || done === batch.length) {
      lastReported = done;
      await onProgress?.(done, prioritized.length);
    }
  });
  for (const [customerId, card] of looked) cardByCustomerId.set(customerId, card);
  return { cardByCustomerId, pending };
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

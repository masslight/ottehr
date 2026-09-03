import Oystehr from '@oystehr/sdk';
import { Appointment, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { Secrets } from 'utils/lib/secrets';
import { EmptyReportParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { CardOnFileReportRow, GetBillingCardsOnFileReportResponse } from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { fetchAllPages } from '../../../shared/fhir';
import { getRateLimitedStripeClient, patientIdFromStripeMetadata } from '../../../shared/stripeIntegration';
import { fhirName } from '../../shared';
import { lookupCardsWithDirectory } from '../card-directory';
import { ProgressFn, ReportComputeContext, ReportDefinition } from '../framework/types';
import { listStripeAccounts } from '../shared';

const CUSTOMER_PAGE_SIZE = 100;
// customers listed per worker run; the build checkpoints and continues in a chained task
const CUSTOMERS_PER_RUN = 10000;
const PATIENT_BATCH_SIZE = 100;
const APPOINTMENT_BATCH_SIZE = 50;
// queued card lookups per drain run; directory hits are free, so warm drains fly through
const PM_LOOKUPS_PER_RUN = 2000;
// an interrupted build older than this restarts instead of resuming
const BUILD_STALE_HOURS = 24;

interface CustomerWithAccount {
  customer: Stripe.Customer;
  stripeAccount: string | undefined;
}

interface PendingLookup {
  customerId: string;
  stripeAccount: string | undefined;
}

// checkpointed listing progress; null account = platform (undefined is not JSON-safe)
export interface CardsBuildState {
  accounts: (string | null)[];
  accountIndex: number;
  cursor?: string;
  customersSeen: number;
  rows: CardOnFileReportRow[];
  pendingLookups: PendingLookup[];
  openInvoices: Record<string, OpenInvoiceSummary>;
  startedAt: string;
}

// cached payload carries the build checkpoint and pending-lookup queue; sanitizePayload strips them
export type CardsOnFilePayload = Omit<GetBillingCardsOnFileReportResponse, 'fromCache' | 'status'> & {
  pendingLookups?: PendingLookup[];
  building?: CardsBuildState;
};

const stripState = (state: CardsOnFilePayload): CardsOnFilePayload => {
  const { pendingLookups: _pendingLookups, building: _building, ...payload } = state;
  return payload;
};

export const cardsOnFileReport: ReportDefinition<Record<string, never>, CardsOnFilePayload> = {
  kind: 'cards-on-file',
  cacheVersion: 'v2',
  paramsSchema: EmptyReportParamsSchema,
  cacheKeyOf: () => '',
  emptyPayload: () => ({
    rows: [],
    totals: { customers: 0, withCard: 0, withoutCard: 0, withOpenInvoices: 0 },
    pendingCardLookups: 0,
    generatedAt: '',
  }),
  usesPrevious: true,
  sanitizePayload: stripState,
  compute: async (ctx, _params, onProgress) => {
    const payload = await advanceCardsReport(ctx, onProgress);
    return { payload, continueRefresh: !!payload.building || (payload.pendingLookups?.length ?? 0) > 0 };
  },
  summarize: (payload) =>
    payload.building
      ? `cards-on-file build in progress (${payload.building.customersSeen} customers listed)`
      : `cards-on-file report cached (${payload.totals.customers} customers)`,
};

// One bounded step of the report lifecycle per worker run: resume an in-flight listing chunk,
// else drain a batch of queued card lookups, else start a fresh build. The worker chains a
// continuation task while there is more to do.
async function advanceCardsReport(
  ctx: ReportComputeContext<CardsOnFilePayload>,
  onProgress?: ProgressFn
): Promise<CardsOnFilePayload> {
  const { oystehr, untaggedClient, secrets, previous } = ctx;
  const stripe = getRateLimitedStripeClient(secrets);

  const building = previous?.building;
  const buildFresh =
    !!building &&
    DateTime.fromISO(building.startedAt).toMillis() > DateTime.now().minus({ hours: BUILD_STALE_HOURS }).toMillis();
  if (previous && building && buildFresh) {
    return buildChunk(oystehr, stripe, untaggedClient, previous, building, onProgress);
  }
  if (previous && !building && (previous.pendingLookups?.length ?? 0) > 0) {
    return drainChunk(oystehr, secrets, stripe, previous, onProgress);
  }

  // fresh build: snapshot accounts and open invoices, then run the first listing chunk.
  // The served rows stay untouched until the new build completes.
  await onProgress?.('listing Stripe accounts…');
  const accounts = await listStripeAccounts(oystehr, untaggedClient, stripe);
  await onProgress?.('listing open invoices…');
  const openInvoices = await fetchOpenInvoices(stripe, accounts);
  const newBuild: CardsBuildState = {
    accounts: accounts.map((account) => account ?? null),
    accountIndex: 0,
    customersSeen: 0,
    rows: [],
    pendingLookups: [],
    openInvoices: Object.fromEntries(openInvoices),
    startedAt: DateTime.now().toUTC().toISO() ?? '',
  };
  return buildChunk(
    oystehr,
    stripe,
    untaggedClient,
    previous ?? cardsOnFileReport.emptyPayload(),
    newBuild,
    onProgress
  );
}

// One listing chunk: page customers from the checkpoint, build their rows (cards from the
// listing expansions only — the rest queue for drain runs), and either checkpoint or finalize.
async function buildChunk(
  oystehr: Oystehr,
  stripe: Stripe,
  untaggedClient: Oystehr,
  served: CardsOnFilePayload,
  building: CardsBuildState,
  onProgress?: ProgressFn
): Promise<CardsOnFilePayload> {
  const customers = await listCustomersChunk(stripe, building, async (count) => {
    await onProgress?.(`listing customers… ${(building.customersSeen + count).toLocaleString('en-US')} so far`);
  });
  building.customersSeen += customers.length;

  const openInvoicesByCustomerId = new Map(Object.entries(building.openInvoices));
  const { cardByCustomerId, needLookup } = resolveExpandedCards(customers);
  // open-invoice customers drain first
  building.pendingLookups.push(
    ...needLookup
      .filter((entry) => openInvoicesByCustomerId.has(entry.customer.id))
      .map(({ customer, stripeAccount }) => ({ customerId: customer.id, stripeAccount })),
    ...needLookup
      .filter((entry) => !openInvoicesByCustomerId.has(entry.customer.id))
      .map(({ customer, stripeAccount }) => ({ customerId: customer.id, stripeAccount }))
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

  building.rows.push(
    ...customers.map(({ customer, stripeAccount }) => {
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
    })
  );

  const listingDone = building.accountIndex >= building.accounts.length;
  if (!listingDone) {
    return { ...served, building };
  }
  return finalizeBuild(served, building);
}

// swap the completed build into the served payload; cross-account duplicates keep the first row
export function finalizeBuild(served: CardsOnFilePayload, building: CardsBuildState): CardsOnFilePayload {
  const rowByCustomerId = new Map<string, CardOnFileReportRow>();
  for (const row of building.rows) {
    if (!rowByCustomerId.has(row.stripeCustomerId)) rowByCustomerId.set(row.stripeCustomerId, row);
  }
  const rows = [...rowByCustomerId.values()];
  rows.sort((a, b) => (a.patientName || a.customerName).localeCompare(b.patientName || b.customerName));
  const seenIds = new Set(rowByCustomerId.keys());
  const pendingLookups = building.pendingLookups.filter((lookup) => seenIds.has(lookup.customerId));
  const withCard = rows.filter((row) => row.cardId).length;
  const withOpenInvoices = rows.filter((row) => row.openInvoiceCount > 0).length;
  return {
    ...stripState(served),
    rows,
    totals: { customers: rows.length, withCard, withoutCard: rows.length - withCard, withOpenInvoices },
    pendingCardLookups: pendingLookups.length,
    generatedAt: DateTime.now().toUTC().toISO() ?? '',
    ...(pendingLookups.length > 0 ? { pendingLookups } : {}),
  };
}

// One batch of queued card lookups against the served rows
async function drainChunk(
  oystehr: Oystehr,
  secrets: Secrets | null,
  stripe: Stripe,
  state: CardsOnFilePayload,
  onProgress?: ProgressFn
): Promise<CardsOnFilePayload> {
  const pending = state.pendingLookups ?? [];
  await onProgress?.(`resolving cards… ${pending.length.toLocaleString('en-US')} remaining`);
  const batch = pending.slice(0, PM_LOOKUPS_PER_RUN);
  const rest = pending.slice(PM_LOOKUPS_PER_RUN);
  const cards = await lookupCardsWithDirectory(oystehr, secrets, stripe, batch);

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
  return {
    ...state,
    totals: { ...state.totals, withCard, withoutCard: state.rows.length - withCard },
    pendingCardLookups: rest.length,
    pendingLookups: rest.length > 0 ? rest : undefined,
  };
}

// platform account plus connected accounts stamped on billing provider organizations; the
// platform's own id can be stamped on an org too and must not be listed a second time
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

// One page-bounded chunk of the customer listing, resuming from the build checkpoint and
// advancing it in place. default_source expanded so legacy card customers skip the PM lookup.
export async function listCustomersChunk(
  stripe: Stripe,
  building: CardsBuildState,
  onCount?: (count: number) => Promise<void>
): Promise<CustomerWithAccount[]> {
  const customers: CustomerWithAccount[] = [];
  while (building.accountIndex < building.accounts.length && customers.length < CUSTOMERS_PER_RUN) {
    const stripeAccount = building.accounts[building.accountIndex] ?? undefined;
    // account failures propagate: a partial result must not be cached as the complete report
    const page = await stripe.customers.list(
      {
        limit: CUSTOMER_PAGE_SIZE,
        expand: ['data.invoice_settings.default_payment_method', 'data.default_source'],
        ...(building.cursor ? { starting_after: building.cursor } : {}),
      },
      { stripeAccount }
    );
    for (const customer of page.data) customers.push({ customer, stripeAccount });
    if (page.data.length > 0) {
      building.cursor = page.data[page.data.length - 1].id;
      if (customers.length % 1000 < CUSTOMER_PAGE_SIZE) await onCount?.(customers.length);
    }
    if (!page.has_more || page.data.length === 0) {
      console.log(
        `[cards-on-file] finished account ${stripeAccount ?? 'platform'} ` +
          `(index ${building.accountIndex}/${building.accounts.length})`
      );
      building.accountIndex += 1;
      building.cursor = undefined;
    }
  }
  return customers;
}

interface CardSummaryLike {
  id: string;
  brand: string;
  last4: string;
}

// cards resolvable from the listing expansions alone: default payment method, else legacy
// default card source; everything else needs a directory lookup
function resolveExpandedCards(customers: CustomerWithAccount[]): {
  cardByCustomerId: Map<string, CardSummaryLike>;
  needLookup: CustomerWithAccount[];
} {
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
  return { cardByCustomerId, needLookup };
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

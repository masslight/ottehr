import Oystehr from '@oystehr/sdk';
import { Appointment, Claim, Encounter, Location, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { BILLING_RESOURCE_TAG, PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  PatientPaymentsDrilldownParams,
  PatientPaymentsDrilldownParamsSchema,
  ReportDateWindowParams,
  ReportDateWindowParamsSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingPatientPaymentsReportResponse,
  PatientPaymentsDetailItem,
  PatientPaymentsReportDetail,
  PatientPaymentsReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { isValidUUID } from 'utils/lib/validation/helper';
import { fetchAllPages } from '../../../shared/fhir';
import {
  encounterIdFromStripeMetadata,
  getRateLimitedStripeClient,
  STRIPE_PAYMENT_ID_SYSTEM,
} from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { CLINICAL_PAYMENT_NOTICE_ID_SYSTEM } from '../../payments';
import { BILLING_WORKING_COPY_TAG, fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { ReportDefinition } from '../framework/types';
import { listStripeAccounts, toDay } from '../shared';

const NOTICE_PAGE_SIZE = 200;
const RESOURCE_BATCH_SIZE = 100;
// conservative parallelism for per-invoice Stripe retrieves in the drill-down
const INVOICE_LOOKUP_CONCURRENCY = 8;
const UNKNOWN_LOCATION = 'Unknown Location';
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');
// locationId filter value selecting payments with no resolvable location
const NO_LOCATION = 'none';

type PatientPaymentsPayload = Omit<GetBillingPatientPaymentsReportResponse, 'fromCache' | 'status'>;

export const patientPaymentsReport: ReportDefinition<
  ReportDateWindowParams,
  PatientPaymentsPayload,
  PatientPaymentsReportDetail,
  PatientPaymentsDrilldownParams
> = {
  kind: 'patient-payments',
  cacheVersion: 'v2',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({ rows: [], totals: emptyTotals(), generatedAt: '' }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('rolling up patient payments…');
    const context = await loadNoticeContext(ctx.oystehr, ctx.untaggedClient, params, ctx.secrets, onProgress);
    const payload = rollupOf(context);
    await onProgress(`resolving payment statuses for ${context.notices.length.toLocaleString('en-US')} payments…`);
    const detail = await detailOf(ctx.oystehr, ctx.untaggedClient, context, ctx.secrets);
    return { payload, detail };
  },
  drilldown: {
    paramsSchema: PatientPaymentsDrilldownParamsSchema,
    empty: () => ({ payments: [] }),
    select: (detail, params) => ({
      payments: detail.payments.filter(
        (payment) =>
          (!params.locationId || payment.locationId === (params.locationId === NO_LOCATION ? '' : params.locationId)) &&
          (!params.paymentMethod || payment.paymentMethod === params.paymentMethod)
      ),
    }),
  },
  summarize: (payload) => `patient payments report cached (${payload.totals.paymentCount} payments)`,
};

const noticeDay = (notice: PaymentNotice): string | null => toDay(notice.created);

const noticeInWindow = (notice: PaymentNotice, from?: string, to?: string): boolean => {
  if (!from && !to) return true;
  const day = noticeDay(notice);
  if (!day) return false;
  if (from && day < (toDay(from) ?? '')) return false;
  if (to && day > (toDay(to) ?? '')) return false;
  return true;
};

const noticeMethod = (notice: PaymentNotice): string =>
  notice.extension?.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString ?? 'unknown';

const noticeClaimId = (notice: PaymentNotice): string | undefined => {
  const id = notice.request?.reference?.replace('Claim/', '');
  return id && isValidUUID(id) ? id : undefined;
};

const stripeIdsOf = (notice: PaymentNotice): string[] =>
  (notice.identifier ?? [])
    .filter((identifier) => identifier.system === STRIPE_PAYMENT_ID_SYSTEM)
    .map((identifier) => identifier.value ?? '')
    .filter(Boolean);

// the webhook's disposition strings carry the charge↔invoice/refund links
const invoiceIdOf = (notice: PaymentNotice): string | undefined =>
  stripeIdsOf(notice).find((id) => id.startsWith('in_')) ??
  notice.payment?.reference?.match(/in_\w+/)?.[0] ??
  (notice.contained?.[0] as { disposition?: string } | undefined)?.disposition?.match(/invoice (in_\w+)/)?.[1];

const refundedChargeIdOf = (notice: PaymentNotice): string | undefined =>
  (notice.contained?.[0] as { disposition?: string } | undefined)?.disposition?.match(/for charge (ch_\w+)/)?.[1];

const dispositionOf = (notice: PaymentNotice): string =>
  (notice.contained?.[0] as { disposition?: string } | undefined)?.disposition ?? '';

// webhook notices carry a claim-encounter-id identifier; EHR-recorded ones reference the Encounter
const noticeEncounterId = (notice: PaymentNotice): string | undefined => {
  const identifier = notice.request?.identifier;
  const fromIdentifier = identifier?.system === CLAIM_ENCOUNTER_ID_SYSTEM ? identifier.value : undefined;
  const fromReference = notice.request?.reference?.startsWith('Encounter/')
    ? notice.request.reference.replace('Encounter/', '')
    : undefined;
  const value = fromIdentifier ?? fromReference;
  return value && isValidUUID(value) ? value : undefined;
};

// windowed notices + the notice → encounter → appointment → location resolution graph
interface NoticeContext {
  notices: PaymentNotice[];
  generatedAt: string;
  // in-memory rows synthesized from Stripe charges that have no PaymentNotice
  synthetic: WeakSet<PaymentNotice>;
  // reporting category with refunds resolved to their original charge's category
  categoryOf: (notice: PaymentNotice) => string;
  locationIdOf: (notice: PaymentNotice) => string;
  locationNameOf: (locationId: string) => string;
  encounterOf: (notice: PaymentNotice) => Encounter | undefined;
  appointmentOf: (notice: PaymentNotice) => Appointment | undefined;
}

async function loadNoticeContext(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: ReportDateWindowParams,
  secrets: ZambdaInput['secrets'],
  onProgress?: (message: string) => Promise<void>
): Promise<NoticeContext> {
  const windowParams = [
    ...(params.dateFrom ? [{ name: 'created', value: `ge${params.dateFrom}` }] : []),
    ...(params.dateTo
      ? [{ name: 'created', value: `le${DateTime.fromISO(params.dateTo).plus({ days: 1 }).toISODate()}` }]
      : []),
  ];
  const fetchNotices = async (
    client: Oystehr,
    extraParams: { name: string; value: string }[]
  ): Promise<PaymentNotice[]> => {
    const fetched: PaymentNotice[] = [];
    await fetchAllPages(
      async (offset, count) => {
        const bundle = await client.fhir.search<PaymentNotice>({
          resourceType: 'PaymentNotice',
          params: [
            ...windowParams,
            ...extraParams,
            { name: '_count', value: String(count) },
            { name: '_offset', value: String(offset) },
          ],
        });
        fetched.push(...bundle.unbundle());
        return bundle;
      },
      NOTICE_PAGE_SIZE,
      { failOnLimit: true }
    );
    return fetched;
  };

  // billing-tagged notices plus EHR-recorded ones outside the billing workspace
  const [billingNotices, unscopedNotices] = await Promise.all([
    fetchNotices(oystehr, []),
    fetchNotices(untaggedClient, [
      { name: '_tag:not', value: `${BILLING_RESOURCE_TAG.system}|${BILLING_RESOURCE_TAG.code}` },
      { name: '_tag:not', value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}` },
    ]),
  ]);
  // the billing-tagged copy wins: match by Stripe id, or by the clinical→billing bridge
  // identifier for off-Stripe (cash/check) payments
  const billingStripeIds = new Set(billingNotices.flatMap(stripeIdsOf));
  const billingNoticeIds = new Set(billingNotices.map((notice) => notice.id));
  const bridgedClinicalIds = new Set(
    billingNotices
      .flatMap((notice) => notice.identifier ?? [])
      .filter((identifier) => identifier.system === CLINICAL_PAYMENT_NOTICE_ID_SYSTEM)
      .map((identifier) => identifier.value ?? '')
      .filter(Boolean)
  );
  const allNotices = [
    ...billingNotices,
    ...unscopedNotices.filter(
      (notice) =>
        !billingNoticeIds.has(notice.id) &&
        !bridgedClinicalIds.has(notice.id ?? '') &&
        !stripeIdsOf(notice).some((id) => billingStripeIds.has(id))
    ),
  ];

  const notices = allNotices.filter(
    (notice) => notice.status === 'active' && noticeInWindow(notice, params.dateFrom, params.dateTo)
  );

  // where Stripe has data it enriches: unrecorded charges join as synthetic rows;
  // recorded notices are preserved so gross collected/refunded stay accurate;
  // cash/check/external notices carry no Stripe ids and pass through.
  // Refunds inherit the original charge's category via chargeId → invoice correlation.
  const synthetic = new WeakSet<PaymentNotice>();
  const invoiceChargeIds = new Set<string>();
  for (const notice of notices) {
    if (invoiceIdOf(notice)) {
      stripeIdsOf(notice)
        .filter((id) => id.startsWith('ch_') || id.startsWith('pi_'))
        .forEach((id) => invoiceChargeIds.add(id));
    }
  }
  await onProgress?.('listing Stripe charges…');
  try {
    const charges = await listWindowCharges(oystehr, untaggedClient, params, secrets);
    for (const charge of charges) {
      if (charge.invoice) {
        chargeStripeIds(charge)
          .filter((id) => id.startsWith('ch_') || id.startsWith('pi_'))
          .forEach((id) => invoiceChargeIds.add(id));
      }
    }
    const knownStripeIds = new Set(notices.flatMap(stripeIdsOf));
    for (const syntheticNotice of syntheticNoticesFor(charges, knownStripeIds)) {
      synthetic.add(syntheticNotice);
      notices.push(syntheticNotice);
    }
  } catch (err) {
    // charge listing is best-effort enrichment; notice-based data must still be served
    console.warn('Failed to list Stripe charges for unmatched payments:', (err as Error)?.message);
  }

  const categoryOf = (notice: PaymentNotice): string => {
    if (invoiceIdOf(notice)) return 'invoice';
    const refundedChargeId = refundedChargeIdOf(notice);
    if (refundedChargeId && invoiceChargeIds.has(refundedChargeId)) return 'invoice';
    return noticeMethod(notice);
  };

  const generatedAt = DateTime.now().toUTC().toISO();

  // location resolution matches the EHR daily payments report: notice → encounter → appointment →
  // participant Location, keyed by Location id
  const encountersById = await fetchResourcesById<Encounter>(
    untaggedClient,
    'Encounter',
    notices.map(noticeEncounterId).filter(Boolean) as string[],
    'id,appointment,period,subject'
  );
  const appointmentsById = await fetchResourcesById<Appointment>(
    untaggedClient,
    'Appointment',
    [...encountersById.values()]
      .map((encounter) => encounter.appointment?.[0]?.reference?.replace('Appointment/', ''))
      .filter((id): id is string => !!id && isValidUUID(id)),
    'id,participant,start'
  );

  const appointmentLocationId = (appointment: Appointment | undefined): string | undefined =>
    appointment?.participant
      ?.map((participant) => participant.actor?.reference)
      .find((ref) => ref?.startsWith('Location/'))
      ?.replace('Location/', '');

  const encounterOf = (notice: PaymentNotice): Encounter | undefined => {
    const encounterId = noticeEncounterId(notice);
    return encounterId ? encountersById.get(encounterId) : undefined;
  };
  const appointmentOf = (notice: PaymentNotice): Appointment | undefined => {
    const appointmentId = encounterOf(notice)?.appointment?.[0]?.reference?.replace('Appointment/', '');
    return appointmentId ? appointmentsById.get(appointmentId) : undefined;
  };

  const locationsById = await fetchResourcesById<Location>(
    untaggedClient,
    'Location',
    [...appointmentsById.values()].map(appointmentLocationId).filter((id): id is string => !!id && isValidUUID(id)),
    'id,name'
  );

  const locationIdOf = (notice: PaymentNotice): string => appointmentLocationId(appointmentOf(notice)) ?? '';
  const locationNameOf = (locationId: string): string =>
    (locationId ? locationsById.get(locationId)?.name : undefined) ?? UNKNOWN_LOCATION;

  return { notices, generatedAt, synthetic, categoryOf, locationIdOf, locationNameOf, encounterOf, appointmentOf };
}

// platform account plus connected accounts stamped on billing provider organizations; the
// platform's own id can be stamped on an org too and must not be listed a second time

const chargeStripeIds = (charge: Stripe.Charge): string[] =>
  [
    charge.id,
    typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id,
    typeof charge.invoice === 'string' ? charge.invoice : charge.invoice?.id,
  ].filter((id): id is string => !!id);

// succeeded charges across all accounts in the window
async function listWindowCharges(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: ReportDateWindowParams,
  secrets: ZambdaInput['secrets']
): Promise<Stripe.Charge[]> {
  const stripe = getRateLimitedStripeClient(secrets);
  const accounts = await listStripeAccounts(oystehr, untaggedClient, stripe);
  const createdWindow = {
    ...(params.dateFrom ? { gte: Math.floor(DateTime.fromISO(params.dateFrom).toSeconds()) } : {}),
    ...(params.dateTo ? { lt: Math.floor(DateTime.fromISO(params.dateTo).plus({ days: 1 }).toSeconds()) } : {}),
  };

  const charges: Stripe.Charge[] = [];
  const seenChargeIds = new Set<string>();
  for (const stripeAccount of accounts) {
    const listing = stripe.charges.list(
      {
        limit: 100,
        expand: ['data.invoice'],
        ...(Object.keys(createdWindow).length > 0 ? { created: createdWindow } : {}),
      },
      { stripeAccount }
    );
    for await (const charge of listing) {
      if (charge.status !== 'succeeded' || !charge.paid || seenChargeIds.has(charge.id)) continue;
      seenChargeIds.add(charge.id);
      charges.push(charge);
    }
  }
  return charges;
}

// in-memory PaymentNotice stand-ins for charges with no recorded notice; they ride the normal
// rollup/drilldown pipeline, resolving location through the charge's encounter metadata
function syntheticNoticesFor(charges: Stripe.Charge[], knownStripeIds: Set<string>): PaymentNotice[] {
  const syntheticNotices: PaymentNotice[] = [];
  for (const charge of charges) {
    const chargeIds = chargeStripeIds(charge);
    if (chargeIds.some((id) => knownStripeIds.has(id))) continue;

    const createdISO = DateTime.fromSeconds(charge.created).toUTC().toISO() ?? '';
    // invoice-settling charges usually carry encounter metadata on the invoice, not the charge
    const invoiceMetadata = typeof charge.invoice === 'object' ? charge.invoice?.metadata : undefined;
    const encounterId =
      encounterIdFromStripeMetadata(charge.metadata) ?? encounterIdFromStripeMetadata(invoiceMetadata);
    const base: Omit<PaymentNotice, 'amount' | 'contained'> = {
      resourceType: 'PaymentNotice',
      status: 'active',
      created: createdISO,
      payment: { display: charge.billing_details?.name ?? charge.billing_details?.email ?? undefined },
      recipient: {},
      identifier: chargeIds.map((id) => ({ system: STRIPE_PAYMENT_ID_SYSTEM, value: id })),
      extension: [{ url: PAYMENT_METHOD_EXTENSION_URL, valueString: 'card' }],
      ...(encounterId ? { request: { identifier: { system: CLAIM_ENCOUNTER_ID_SYSTEM, value: encounterId } } } : {}),
    };
    const containedFor = (value: number, disposition: string): PaymentNotice['contained'] => [
      {
        resourceType: 'PaymentReconciliation',
        status: 'active',
        created: createdISO,
        paymentDate: createdISO.slice(0, 10),
        paymentAmount: { value, currency: 'USD' },
        disposition,
      },
    ];
    syntheticNotices.push({
      ...base,
      amount: { value: (charge.amount ?? 0) / 100, currency: 'USD' },
      contained: containedFor((charge.amount ?? 0) / 100, `Stripe charge ${charge.id} with no recorded PaymentNotice`),
    });
    if ((charge.amount_refunded ?? 0) > 0) {
      syntheticNotices.push({
        ...base,
        amount: { value: -((charge.amount_refunded ?? 0) / 100), currency: 'USD' },
        contained: containedFor(
          -((charge.amount_refunded ?? 0) / 100),
          `Stripe refund for charge ${charge.id} with no recorded PaymentNotice`
        ),
      });
    }
  }
  return syntheticNotices;
}

// rollup: location × payment category
function rollupOf(context: NoticeContext): PatientPaymentsPayload {
  const { notices, generatedAt, categoryOf, locationIdOf, locationNameOf } = context;
  const rowsByKey = new Map<string, PatientPaymentsReportRow>();
  for (const notice of notices) {
    const locationId = locationIdOf(notice);
    const paymentMethod = categoryOf(notice);
    const key = `${locationId}|${paymentMethod}`;
    let row = rowsByKey.get(key);
    if (!row) {
      row = {
        locationId,
        locationName: locationNameOf(locationId),
        paymentMethod,
        paymentCount: 0,
        collected: 0,
        refunded: 0,
        net: 0,
      };
      rowsByKey.set(key, row);
    }
    const amount = notice.amount?.value ?? 0;
    if (amount >= 0) {
      row.paymentCount += 1;
      row.collected += amount;
    } else {
      row.refunded += -amount;
    }
    row.net += amount;
  }

  const rows = [...rowsByKey.values()]
    .map((row) => ({
      ...row,
      collected: roundNumberToDecimalPlaces(row.collected, 2),
      refunded: roundNumberToDecimalPlaces(row.refunded, 2),
      net: roundNumberToDecimalPlaces(row.net, 2),
    }))
    .sort((a, b) => a.locationName.localeCompare(b.locationName) || a.paymentMethod.localeCompare(b.paymentMethod));

  return { rows, totals: totalsOf(rows), generatedAt };
}

// drilldown dataset: every payment with snapshot Stripe status and location id
async function detailOf(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  context: NoticeContext,
  secrets: ZambdaInput['secrets']
): Promise<PatientPaymentsReportDetail> {
  const { notices, synthetic, categoryOf, locationIdOf, locationNameOf, encounterOf, appointmentOf } = context;
  if (notices.length === 0) {
    return { payments: [] };
  }

  const claimsById = await fetchResourcesById<Claim>(
    oystehr,
    'Claim',
    notices.map(noticeClaimId).filter(Boolean) as string[],
    'id,patient'
  );

  // pre-claim payments resolve the patient through Encounter.subject
  const encounterPatientId = (notice: PaymentNotice): string | undefined => {
    const id = encounterOf(notice)?.subject?.reference?.replace('Patient/', '');
    return id && isValidUUID(id) ? id : undefined;
  };

  // Patients are clinical (untagged) resources
  const patientsById = await fetchResourcesById<Patient>(
    untaggedClient,
    'Patient',
    [
      ...[...claimsById.values()]
        .map((claim) => claim.patient?.reference?.replace('Patient/', ''))
        .filter((id): id is string => !!id && isValidUUID(id)),
      ...notices.map(encounterPatientId).filter((id): id is string => !!id),
    ],
    'id,name'
  );

  // refunds across the whole window let charge rows show as refunded
  const refundTotalsByChargeId = new Map<string, number>();
  for (const notice of notices) {
    const chargeId = refundedChargeIdOf(notice);
    const amount = notice.amount?.value ?? 0;
    if (chargeId && amount < 0) {
      refundTotalsByChargeId.set(chargeId, (refundTotalsByChargeId.get(chargeId) ?? 0) + -amount);
    }
  }

  const stripeStatuses = await resolveStripeStatuses(oystehr, notices, refundTotalsByChargeId, secrets, synthetic);

  const payments: PatientPaymentsDetailItem[] = notices
    .map((notice, index) => {
      const claim = noticeClaimId(notice) ? claimsById.get(noticeClaimId(notice) ?? '') : undefined;
      const patientId = claim?.patient?.reference?.replace('Patient/', '') ?? encounterPatientId(notice);
      const encounter = encounterOf(notice);
      const appointment = appointmentOf(notice);
      return {
        date: notice.created ?? '',
        patientName:
          fhirName(patientId ? patientsById.get(patientId) : undefined) ||
          (synthetic.has(notice) ? notice.payment?.display ?? '' : ''),
        locationId: locationIdOf(notice),
        locationName: locationNameOf(locationIdOf(notice)),
        paymentMethod: categoryOf(notice),
        amount: roundNumberToDecimalPlaces(notice.amount?.value ?? 0, 2),
        stripeStatus: stripeStatuses[index],
        description: dispositionOf(notice),
        appointmentId: appointment?.id ?? '',
        encounterDate: encounter?.period?.start ?? appointment?.start ?? '',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return { payments };
}

const emptyTotals = (): GetBillingPatientPaymentsReportResponse['totals'] => ({
  paymentCount: 0,
  collected: 0,
  refunded: 0,
  net: 0,
});

const totalsOf = (rows: PatientPaymentsReportRow[]): GetBillingPatientPaymentsReportResponse['totals'] =>
  rows.reduce(
    (acc, row) => ({
      paymentCount: acc.paymentCount + row.paymentCount,
      collected: roundNumberToDecimalPlaces(acc.collected + row.collected, 2),
      refunded: roundNumberToDecimalPlaces(acc.refunded + row.refunded, 2),
      net: roundNumberToDecimalPlaces(acc.net + row.net, 2),
    }),
    emptyTotals()
  );

// Status per notice, aligned by index with the input. Stripe-linked payments get live invoice
// state ('Invoice past due' etc.); manual payments report ''.
async function resolveStripeStatuses(
  oystehr: Oystehr,
  notices: PaymentNotice[],
  refundTotalsByChargeId: Map<string, number>,
  secrets: ZambdaInput['secrets'],
  synthetic?: WeakSet<PaymentNotice>
): Promise<string[]> {
  let stripe: Stripe | undefined;
  try {
    stripe = getRateLimitedStripeClient(secrets);
  } catch {
    console.warn('Stripe client unavailable; invoice statuses will be FHIR-derived only');
  }
  const stripeAccountByOrgId = new Map<string, string | undefined>();
  const invoiceCache = new Map<string, Stripe.Invoice | undefined>();

  const stripeAccountFor = async (notice: PaymentNotice): Promise<string | undefined> => {
    const orgId = notice.payee?.reference?.replace('Organization/', '');
    if (!orgId || !isValidUUID(orgId)) return undefined;
    if (!stripeAccountByOrgId.has(orgId)) {
      try {
        const org = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: orgId });
        stripeAccountByOrgId.set(
          orgId,
          org.identifier?.find((identifier) => identifier.system === STRIPE_ACCOUNT_IDENTIFIER_SYSTEM)?.value
        );
      } catch {
        stripeAccountByOrgId.set(orgId, undefined);
      }
    }
    return stripeAccountByOrgId.get(orgId);
  };

  const fetchInvoice = async (invoiceId: string, notice: PaymentNotice): Promise<Stripe.Invoice | undefined> => {
    if (!stripe) return undefined;
    if (!invoiceCache.has(invoiceId)) {
      try {
        const stripeAccount = await stripeAccountFor(notice);
        invoiceCache.set(invoiceId, await stripe.invoices.retrieve(invoiceId, undefined, { stripeAccount }));
      } catch (err) {
        console.warn(`Failed to retrieve Stripe invoice ${invoiceId}:`, (err as Error)?.message);
        invoiceCache.set(invoiceId, undefined);
      }
    }
    return invoiceCache.get(invoiceId);
  };

  // warm the cache for unique invoices with bounded concurrency so a broad drill-down
  // can't fire one uncapped Stripe request per notice; synthetic rows never fetch
  const noticeByInvoiceId = new Map<string, PaymentNotice>();
  for (const notice of notices) {
    if (synthetic?.has(notice)) continue;
    const invoiceId = invoiceIdOf(notice);
    if (invoiceId && !noticeByInvoiceId.has(invoiceId)) noticeByInvoiceId.set(invoiceId, notice);
  }
  const invoiceEntries = [...noticeByInvoiceId.entries()];
  for (let i = 0; i < invoiceEntries.length; i += INVOICE_LOOKUP_CONCURRENCY) {
    await Promise.all(
      invoiceEntries
        .slice(i, i + INVOICE_LOOKUP_CONCURRENCY)
        .map(([invoiceId, notice]) => fetchInvoice(invoiceId, notice))
    );
  }

  return Promise.all(
    notices.map(async (notice) => {
      const stripeIds = stripeIdsOf(notice);
      if (stripeIds.length === 0) return '';

      const amount = notice.amount?.value ?? 0;
      if (amount < 0) return 'Refunded';

      const chargeId = stripeIds.find((id) => id.startsWith('ch_'));
      const refunded = chargeId ? refundTotalsByChargeId.get(chargeId) ?? 0 : 0;
      if (refunded > 0) return refunded >= amount ? 'Refunded' : 'Partially refunded';

      // synthetic rows already carry their charge/refund state; no invoice retrieve needed
      if (synthetic?.has(notice)) return 'Paid';

      const invoiceId = invoiceIdOf(notice);
      if (invoiceId) {
        const invoice = await fetchInvoice(invoiceId, notice);
        if (!invoice) return 'Invoice status unavailable';
        if (invoice.status === 'paid') return 'Invoice paid';
        if (invoice.status === 'open') {
          const pastDue = invoice.due_date && invoice.due_date * 1000 < Date.now();
          return pastDue ? 'Invoice past due' : 'Invoice open';
        }
        return `Invoice ${invoice.status ?? 'unknown'}`;
      }

      return 'Paid';
    })
  );
}

async function fetchResourcesById<T extends Appointment | Claim | Encounter | Location | Patient>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  ids: string[],
  elements: string
): Promise<Map<string, T>> {
  const byId = new Map<string, T>();
  const uniqueIds = [...new Set(ids)];
  for (let i = 0; i < uniqueIds.length; i += RESOURCE_BATCH_SIZE) {
    const batch = uniqueIds.slice(i, i + RESOURCE_BATCH_SIZE);
    const bundle = await oystehr.fhir.search<T>({
      resourceType,
      params: [
        { name: '_id', value: batch.join(',') },
        { name: '_elements', value: elements },
        { name: '_count', value: String(batch.length) },
      ],
    });
    for (const resource of bundle.unbundle()) {
      if (resource.id) byId.set(resource.id, resource);
    }
  }
  return byId;
}

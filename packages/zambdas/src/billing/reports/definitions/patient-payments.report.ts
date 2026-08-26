import Oystehr from '@oystehr/sdk';
import { Appointment, Claim, Encounter, Location, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
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
import { getRateLimitedStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { ReportDefinition } from '../framework/types';
import { toDay } from '../shared';

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
  cacheVersion: 'v1',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({ rows: [], totals: emptyTotals(), generatedAt: '' }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('rolling up patient payments…');
    const context = await loadNoticeContext(ctx.oystehr, ctx.untaggedClient, params);
    const payload = rollupOf(context);
    await onProgress(`resolving payment statuses for ${context.notices.length.toLocaleString('en-US')} payments…`);
    const detail = await detailOf(ctx.oystehr, context, ctx.secrets);
    return { payload, detail };
  },
  // oldest payments are the least interesting slice of an oversized detail
  shrinkDetail: (detail) =>
    detail.payments.length > 1
      ? { payments: detail.payments.slice(0, Math.floor(detail.payments.length / 2)) }
      : undefined,
  drilldown: {
    paramsSchema: PatientPaymentsDrilldownParamsSchema,
    empty: () => ({ payments: [] }),
    // row filter over the snapshot: location ('none' = unresolved) and/or payment category
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

// reporting category: invoice-settling payments group under 'invoice' regardless of how they were paid
const noticeCategory = (notice: PaymentNotice): string => (invoiceIdOf(notice) ? 'invoice' : noticeMethod(notice));

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

const noticeEncounterId = (notice: PaymentNotice): string | undefined => {
  const identifier = notice.request?.identifier;
  const value = identifier?.system === CLAIM_ENCOUNTER_ID_SYSTEM ? identifier.value : undefined;
  return value && isValidUUID(value) ? value : undefined;
};

// Notices in the window plus the notice → encounter → appointment → location resolution graph,
// shared by the rollup compute and the detail drill-down.
interface NoticeContext {
  notices: PaymentNotice[];
  generatedAt: string;
  locationIdOf: (notice: PaymentNotice) => string;
  locationNameOf: (locationId: string) => string;
  encounterOf: (notice: PaymentNotice) => Encounter | undefined;
  appointmentOf: (notice: PaymentNotice) => Appointment | undefined;
}

async function loadNoticeContext(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: ReportDateWindowParams
): Promise<NoticeContext> {
  // billing-tagged (client is workspace-scoped) active notices; window filtered in memory by day
  const allNotices: PaymentNotice[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
        ...(params.dateFrom ? [{ name: 'created', value: `ge${params.dateFrom}` }] : []),
        ...(params.dateTo
          ? [{ name: 'created', value: `le${DateTime.fromISO(params.dateTo).plus({ days: 1 }).toISODate()}` }]
          : []),
        { name: '_count', value: String(count) },
        { name: '_offset', value: String(offset) },
      ],
    });
    allNotices.push(...bundle.unbundle());
    return bundle;
  }, NOTICE_PAGE_SIZE);

  const notices = allNotices.filter(
    (notice) => notice.status === 'active' && noticeInWindow(notice, params.dateFrom, params.dateTo)
  );
  const generatedAt = DateTime.now().toUTC().toISO();

  // location resolution matches the EHR daily payments report: notice → encounter → appointment →
  // participant Location, keyed by Location id
  const encountersById = await fetchResourcesById<Encounter>(
    untaggedClient,
    'Encounter',
    notices.map(noticeEncounterId).filter(Boolean) as string[],
    'id,appointment,period'
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

  return { notices, generatedAt, locationIdOf, locationNameOf, encounterOf, appointmentOf };
}

// rollup: location × payment category
function rollupOf(context: NoticeContext): PatientPaymentsPayload {
  const { notices, generatedAt, locationIdOf, locationNameOf } = context;
  const rowsByKey = new Map<string, PatientPaymentsReportRow>();
  for (const notice of notices) {
    const locationId = locationIdOf(notice);
    const paymentMethod = noticeCategory(notice);
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

// Full drilldown dataset over the window's notices: every payment with Stripe status (as of
// compute time) and the location id the drilldown filters on. Runs inside the worker.
async function detailOf(
  oystehr: Oystehr,
  context: NoticeContext,
  secrets: ZambdaInput['secrets']
): Promise<PatientPaymentsReportDetail> {
  const { notices, locationIdOf, locationNameOf, encounterOf, appointmentOf } = context;
  if (notices.length === 0) {
    return { payments: [] };
  }

  const claimsById = await fetchResourcesById<Claim>(
    oystehr,
    'Claim',
    notices.map(noticeClaimId).filter(Boolean) as string[],
    'id,patient'
  );

  const patientsById = await fetchResourcesById<Patient>(
    oystehr,
    'Patient',
    [...claimsById.values()]
      .map((claim) => claim.patient?.reference?.replace('Patient/', ''))
      .filter((id): id is string => !!id && isValidUUID(id)),
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

  const stripeStatuses = await resolveStripeStatuses(oystehr, notices, refundTotalsByChargeId, secrets);

  const payments: PatientPaymentsDetailItem[] = notices
    .map((notice, index) => {
      const claim = noticeClaimId(notice) ? claimsById.get(noticeClaimId(notice) ?? '') : undefined;
      const patientId = claim?.patient?.reference?.replace('Patient/', '');
      const encounter = encounterOf(notice);
      const appointment = appointmentOf(notice);
      return {
        date: notice.created ?? '',
        patientName: fhirName(patientId ? patientsById.get(patientId) : undefined),
        locationId: locationIdOf(notice),
        locationName: locationNameOf(locationIdOf(notice)),
        paymentMethod: noticeCategory(notice),
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
  secrets: ZambdaInput['secrets']
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
  // can't fire one uncapped Stripe request per notice
  const noticeByInvoiceId = new Map<string, PaymentNotice>();
  for (const notice of notices) {
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

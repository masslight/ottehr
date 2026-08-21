import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Claim, Encounter, Location, MeasureReport, Organization, Patient, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import Stripe from 'stripe';
import { PAYMENT_METHOD_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import {
  GetBillingPatientPaymentsReportResponse,
  PatientPaymentItem,
  PatientPaymentsReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { roundNumberToDecimalPlaces } from 'utils/lib/utils/convert';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { fetchAllPages } from '../../../shared/fhir';
import { wrapHandler } from '../../../shared/sentry';
import { getStripeClient, STRIPE_PAYMENT_ID_SYSTEM } from '../../../shared/stripeIntegration';
import { ZambdaInput } from '../../../shared/types/common';
import { createBillingClient, createEraReadClient, fhirName, STRIPE_ACCOUNT_IDENTIFIER_SYSTEM } from '../../shared';
import { toDay } from '../shared';
import { GetBillingPatientPaymentsReportParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-billing-patient-payments-report';

const NOTICE_PAGE_SIZE = 200;
const RESOURCE_BATCH_SIZE = 100;
const UNKNOWN_LOCATION = 'Unknown Location';
const CLAIM_ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

const REPORT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('billing-report');
const CACHE_KEY_PREFIX = 'patient-payments:v1';
const MEASURE_URL = 'https://fhir.ottehr.com/billing/measures/patient-payments';
const ROW_METRIC_KEYS = ['collected', 'refunded', 'net'] as const;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  // encounters/appointments are clinical (untagged) resources in the same store
  const untaggedClient = createEraReadClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, untaggedClient, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

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

export async function performEffect(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: GetBillingPatientPaymentsReportParams
): Promise<GetBillingPatientPaymentsReportResponse> {
  const cacheKey = `${CACHE_KEY_PREFIX}:${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`;

  // rollup requests serve the latest saved report; detail (drill-down) always computes live
  if (!params.detail && !params.refresh) {
    const cached = await findCachedRollup(oystehr, cacheKey);
    if (cached) {
      const rows = rowsFromCache(cached);
      return { rows, totals: totalsOf(rows), generatedAt: cached.date ?? '', fromCache: true };
    }
  }

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
  if (notices.length === 0) {
    return { rows: [], totals: emptyTotals(), ...(params.detail ? { payments: [] } : {}), generatedAt };
  }

  const claimsById = await fetchResourcesById<Claim>(
    oystehr,
    'Claim',
    notices.map(noticeClaimId).filter(Boolean) as string[],
    'id,facility,patient'
  );

  // clinical chain for the visit link and the location fallback: encounter → appointment → location
  const encountersById = await fetchResourcesById<Encounter>(
    untaggedClient,
    'Encounter',
    notices.map(noticeEncounterId).filter(Boolean) as string[],
    'id,appointment,location,period'
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
    [
      ...[...claimsById.values()].map((claim) => claim.facility?.reference?.replace('Location/', '')),
      ...[...appointmentsById.values()].map(appointmentLocationId),
      ...[...encountersById.values()].map(
        (encounter) => encounter.location?.[0]?.location?.reference?.replace('Location/', '')
      ),
    ].filter((id): id is string => !!id && isValidUUID(id)),
    'id,name'
  );

  // claim facility → appointment location → encounter location
  const locationNameOf = (notice: PaymentNotice): string => {
    const claim = noticeClaimId(notice) ? claimsById.get(noticeClaimId(notice) ?? '') : undefined;
    const locationId =
      claim?.facility?.reference?.replace('Location/', '') ??
      appointmentLocationId(appointmentOf(notice)) ??
      encounterOf(notice)?.location?.[0]?.location?.reference?.replace('Location/', '');
    return (locationId ? locationsById.get(locationId)?.name : undefined) ?? UNKNOWN_LOCATION;
  };

  // rollup: location × payment category
  const rowsByKey = new Map<string, PatientPaymentsReportRow>();
  for (const notice of notices) {
    const locationName = locationNameOf(notice);
    const paymentMethod = noticeCategory(notice);
    const key = `${locationName}|${paymentMethod}`;
    let row = rowsByKey.get(key);
    if (!row) {
      row = { locationName, paymentMethod, paymentCount: 0, collected: 0, refunded: 0, net: 0 };
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

  const totals = totalsOf(rows);

  if (!params.detail) {
    await saveCachedRollup(oystehr, cacheKey, rows, generatedAt, params);
    return { rows, totals, generatedAt, fromCache: false };
  }

  const detailNotices = notices.filter(
    (notice) =>
      (!params.locationName || locationNameOf(notice) === params.locationName) &&
      (!params.paymentMethod || noticeCategory(notice) === params.paymentMethod)
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

  const stripeStatuses = await resolveStripeStatuses(oystehr, detailNotices, refundTotalsByChargeId, params.secrets);

  const payments: PatientPaymentItem[] = detailNotices
    .map((notice, index) => {
      const claim = noticeClaimId(notice) ? claimsById.get(noticeClaimId(notice) ?? '') : undefined;
      const patientId = claim?.patient?.reference?.replace('Patient/', '');
      const encounter = encounterOf(notice);
      const appointment = appointmentOf(notice);
      return {
        date: notice.created ?? '',
        patientName: fhirName(patientId ? patientsById.get(patientId) : undefined),
        locationName: locationNameOf(notice),
        paymentMethod: noticeCategory(notice),
        amount: roundNumberToDecimalPlaces(notice.amount?.value ?? 0, 2),
        stripeStatus: stripeStatuses[index],
        description: dispositionOf(notice),
        appointmentId: appointment?.id ?? '',
        encounterDate: encounter?.period?.start ?? appointment?.start ?? '',
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return { rows, totals, payments, generatedAt };
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

async function findCachedRollup(oystehr: Oystehr, cacheKey: string): Promise<MeasureReport | undefined> {
  const bundle = await oystehr.fhir.search<MeasureReport>({
    resourceType: 'MeasureReport',
    params: [
      { name: 'identifier', value: `${REPORT_IDENTIFIER_SYSTEM}|${cacheKey}` },
      { name: '_sort', value: '-_lastUpdated' },
      { name: '_count', value: '1' },
    ],
  });
  return bundle.unbundle()[0];
}

// one group per location|method row: payment count as population, dollar metrics as strata
async function saveCachedRollup(
  oystehr: Oystehr,
  cacheKey: string,
  rows: PatientPaymentsReportRow[],
  generatedAt: string,
  params: { dateFrom?: string; dateTo?: string }
): Promise<void> {
  const report: MeasureReport = {
    resourceType: 'MeasureReport',
    status: 'complete',
    type: 'summary',
    measure: MEASURE_URL,
    identifier: [{ system: REPORT_IDENTIFIER_SYSTEM, value: cacheKey }],
    date: generatedAt,
    // period is required and must be non-empty (ele-1)
    period: { start: params.dateFrom ?? generatedAt, ...(params.dateTo ? { end: params.dateTo } : {}) },
    group: rows.map((row) => ({
      code: { text: `${row.locationName}|${row.paymentMethod}` },
      population: [{ code: { text: 'payments' }, count: row.paymentCount }],
      stratifier: [
        {
          stratum: ROW_METRIC_KEYS.map((key) => ({
            value: { text: key },
            measureScore: { value: row[key] },
          })),
        },
      ],
    })),
  };
  try {
    const existing = await findCachedRollup(oystehr, cacheKey);
    if (existing?.id) {
      await oystehr.fhir.update<MeasureReport>({ ...report, id: existing.id });
    } else {
      await oystehr.fhir.create<MeasureReport>(report);
    }
  } catch (err) {
    // the cache is an optimization; a failed write must not fail the report
    console.error('Failed to cache patient payments rollup:', err);
  }
}

function rowsFromCache(report: MeasureReport): PatientPaymentsReportRow[] {
  return (report.group ?? []).map((group) => {
    const [locationName = UNKNOWN_LOCATION, paymentMethod = 'unknown'] = (group.code?.text ?? '').split('|');
    const metrics = new Map(
      (group.stratifier?.[0]?.stratum ?? []).map((stratum) => [
        stratum.value?.text ?? '',
        stratum.measureScore?.value ?? 0,
      ])
    );
    return {
      locationName,
      paymentMethod,
      paymentCount: group.population?.[0]?.count ?? 0,
      collected: metrics.get('collected') ?? 0,
      refunded: metrics.get('refunded') ?? 0,
      net: metrics.get('net') ?? 0,
    };
  });
}

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
    stripe = getStripeClient(secrets);
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

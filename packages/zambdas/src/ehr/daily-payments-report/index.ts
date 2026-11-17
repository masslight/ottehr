import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, PaymentNotice } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { chunkThings } from 'utils/lib/fhir/chat';
import {
  DailyPaymentsReportZambdaOutput,
  PaymentItem,
  PaymentMethodSummary,
} from 'utils/lib/types/api/daily-payments-report.types';
import {
  encounterIdForPaymentNotice,
  fetchPaymentNoticeCounterparts,
  mergeBillingAndLegacyPaymentNotices,
  paymentMethodForNotice,
} from '../../billing/patient-payments';
import { PATIENT_PAYMENT_IDENTIFIER_FILTER } from '../../billing/payments';
import { createBillingClient } from '../../billing/shared';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'daily-payments-report';
// keeps the _id list of the location lookup within URL limits
const ENCOUNTER_BATCH_SIZE = 100;

const uniqueById = (notices: PaymentNotice[]): PaymentNotice[] => [
  ...new Map(notices.map((notice) => [notice.id, notice])).values(),
];

// A FHIR date search value covers the whole period at its own precision ('2026-10-27' is that entire
// day), so a bound widens to the start or end of that period; zone-less values are read as UTC.
function fhirSearchBoundMillis(value: string, side: 'start' | 'end'): number {
  const time = value.split('T')[1]?.replace(/(Z|[+-]\d{2}:\d{2})$/, '');
  const unit = time
    ? time.includes('.')
      ? 'millisecond'
      : time.split(':').length > 2
      ? 'second'
      : 'minute'
    : (['year', 'month', 'day'] as const)[value.split('-').length - 1];
  const dateTime = DateTime.fromISO(value, { zone: 'utc' });
  return (side === 'start' ? dateTime.startOf(unit) : dateTime.endOf(unit)).toMillis();
}

// Helper function to parse string as number, defaulting to 0
function parseAsNumber(value: any): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }

  // For any other type, try to convert to string first, then parse
  const stringValue = String(value);
  const parsed = parseFloat(stringValue);
  return isNaN(parsed) ? 0 : parsed;
}

// Helper to return ISO string for date-time
function formatGMTToLocalDate(gmtDateString: string): string {
  if (!gmtDateString) return 'N/A';
  try {
    // Parse the GMT date string and validate it
    const gmtDate = new Date(gmtDateString);
    if (isNaN(gmtDate.getTime())) return 'N/A';

    // Return ISO string for front-end to format as needed
    return gmtDate.toISOString();
  } catch {
    return 'N/A';
  }
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { dateRange, locationId } = validatedParameters;

  // Get M2M token for FHIR access
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  const billingOystehr = createBillingClient(m2mToken, validatedParameters.secrets);

  // TODO: Once billable follow-up visits are available (with their own Appointment and full visit workflow),
  // ensure this report includes them as independent visits on their follow-up date.
  // Currently, follow-up encounters without their own Appointment are excluded from reports.

  console.log('Searching for payment notices in date range:', dateRange);
  if (locationId) {
    console.log('Filtering by location ID:', locationId);
  }

  // Search for payment notices within the date range: billing notices, plus the EHR notices
  // recorded before payments moved to the billing app
  const createdParams = [
    { name: 'created', value: `ge${dateRange.start}` },
    { name: 'created', value: `le${dateRange.end}` },
    { name: '_count', value: '1000' },
  ];
  const fetchWindowNotices = async (
    client: typeof oystehr | typeof billingOystehr,
    extraParams: { name: string; value: string }[] = []
  ): Promise<PaymentNotice[]> => {
    const notices: PaymentNotice[] = [];
    for (let offset = 0; ; offset += 1000) {
      const bundle = await client.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [...createdParams, ...extraParams, { name: '_offset', value: String(offset) }],
      });
      notices.push(...bundle.unbundle());
      if (!bundle.link?.some((link) => link.relation === 'next')) return notices;
    }
  };
  const [billingNotices, legacyNotices] = await Promise.all([
    fetchWindowNotices(billingOystehr, [{ name: 'identifier', value: PATIENT_PAYMENT_IDENTIFIER_FILTER }]),
    fetchWindowNotices(oystehr),
  ]);
  // The two halves of a payment recorded in both workspaces can carry created times on either side
  // of a range boundary, so the window is applied to the merged payment, not to each half: otherwise
  // the same payment would count on two adjacent reports.
  const counterparts = await fetchPaymentNoticeCounterparts({
    clinicalOystehr: oystehr,
    billingOystehr,
    billingNotices,
    legacyNotices,
  });
  const rangeStart = fhirSearchBoundMillis(dateRange.start, 'start');
  const rangeEnd = fhirSearchBoundMillis(dateRange.end, 'end');
  let paymentNotices = mergeBillingAndLegacyPaymentNotices(
    uniqueById([...billingNotices, ...counterparts.billing]),
    uniqueById([...legacyNotices, ...counterparts.legacy])
  ).filter((notice) => {
    const created = DateTime.fromISO(notice.created ?? '').toMillis();
    return created >= rangeStart && created <= rangeEnd;
  });
  console.log(`Found ${paymentNotices.length} payment notices`);

  // If locationId filter is provided, filter payment notices by location
  if (locationId && paymentNotices.length > 0) {
    const encounterIds = [
      ...new Set(paymentNotices.map(encounterIdForPaymentNotice).filter((id): id is string => Boolean(id))),
    ];
    const encounterBatches = chunkThings(encounterIds, ENCOUNTER_BATCH_SIZE);
    const encounterResources = (
      await Promise.all(
        encounterBatches.map(async (batch) =>
          (
            await oystehr.fhir.search<Encounter | Appointment>({
              resourceType: 'Encounter',
              params: [
                { name: '_id', value: batch.join(',') },
                { name: '_include', value: 'Encounter:appointment' },
                { name: '_count', value: String(ENCOUNTER_BATCH_SIZE * 2) },
              ],
            })
          ).unbundle()
        )
      )
    ).flat();
    const encounters = encounterResources.filter((r): r is Encounter => r.resourceType === 'Encounter');
    const appointments = encounterResources.filter((r): r is Appointment => r.resourceType === 'Appointment');

    // Create maps for quick lookups
    const encounterMap = new Map<string, Encounter>();
    encounters.forEach((encounter) => {
      if (encounter.id) {
        encounterMap.set(encounter.id, encounter);
      }
    });

    const appointmentMap = new Map<string, Appointment>();
    appointments.forEach((appointment) => {
      if (appointment.id) {
        appointmentMap.set(appointment.id, appointment);
      }
    });

    // Filter payment notices by location
    paymentNotices = paymentNotices.filter((payment) => {
      const encounterId = encounterIdForPaymentNotice(payment);
      const encounter = encounterId ? encounterMap.get(encounterId) : undefined;

      if (!encounter || !encounter.appointment || encounter.appointment.length === 0) {
        return false;
      }

      // Get the appointment reference from encounter
      const appointmentRef = encounter.appointment[0].reference;
      if (!appointmentRef) {
        return false;
      }

      const appointmentId = appointmentRef.replace('Appointment/', '');
      const appointment = appointmentMap.get(appointmentId);

      if (!appointment || !appointment.participant) {
        return false;
      }

      // Check if appointment has the specified location
      return appointment.participant.some((participant) => {
        const locationRef = participant.actor?.reference;
        return locationRef && locationRef === `Location/${locationId}`;
      });
    });

    console.log(`After location filtering: ${paymentNotices.length} payment notices`);
  }

  if (paymentNotices.length === 0) {
    const response: DailyPaymentsReportZambdaOutput = {
      message: 'No payment notices found for the specified date range',
      totalAmount: 0,
      totalTransactions: 0,
      currencies: [],
      paymentMethods: [],
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }

  // Process payment notices into structured data
  const paymentItems: PaymentItem[] = paymentNotices.map((payment) => {
    // Extract payment method from extension
    const paymentMethod = paymentMethodForNotice(payment) || 'N/A';

    // Extract amount and currency
    const amount = parseAsNumber(payment.amount?.value);
    const currency = payment.amount?.currency || 'USD';

    // Format created date
    const createdDate = formatGMTToLocalDate(payment.created || '');

    return {
      id: payment.id || '',
      paymentMethod,
      amount,
      currency,
      createdDate,
      // TODO: Add patient name and appointment ID if needed
      patientName: undefined,
      appointmentId: undefined,
    };
  });

  // Group payments by payment method
  const paymentsByMethod = new Map<string, PaymentItem[]>();
  let totalAmount = 0;
  const allCurrencies = new Set<string>();

  paymentItems.forEach((payment) => {
    if (!paymentsByMethod.has(payment.paymentMethod)) {
      paymentsByMethod.set(payment.paymentMethod, []);
    }
    paymentsByMethod.get(payment.paymentMethod)!.push(payment);
    totalAmount += payment.amount;
    allCurrencies.add(payment.currency);
  });

  // Create payment method summaries
  const paymentMethods: PaymentMethodSummary[] = Array.from(paymentsByMethod.entries())
    .map(([method, payments]) => {
      const methodTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
      const methodCurrency = payments[0]?.currency || 'USD'; // Assume same currency per method

      return {
        paymentMethod: method,
        totalAmount: methodTotal,
        currency: methodCurrency,
        transactionCount: payments.length,
        payments,
      };
    })
    .sort((a, b) => a.paymentMethod.localeCompare(b.paymentMethod));

  const response: DailyPaymentsReportZambdaOutput = {
    message: `Found ${paymentNotices.length} payment notices with total amount ${totalAmount.toFixed(2)}`,
    totalAmount,
    totalTransactions: paymentNotices.length,
    currencies: Array.from(allCurrencies),
    paymentMethods,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

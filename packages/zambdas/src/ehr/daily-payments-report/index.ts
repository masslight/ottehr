import { APIGatewayProxyResult } from 'aws-lambda';
import { DailyPaymentsReportZambdaOutput, getSecret, PaymentItem, PaymentMethodSummary, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'daily-payments-report';

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

// Helper to format GMT date to local timezone as yyyy-MM-dd
function formatGMTToLocalDate(gmtDateString: string): string {
  if (!gmtDateString) return 'N/A';
  try {
    // Parse the GMT date string and convert to local date
    const gmtDate = new Date(gmtDateString);
    if (isNaN(gmtDate.getTime())) return 'N/A';

    // Format as yyyy-MM-dd in local timezone
    const yyyy = gmtDate.getFullYear();
    const mm = String(gmtDate.getMonth() + 1).padStart(2, '0');
    const dd = String(gmtDate.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return 'N/A';
  }
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);
    const { dateRange, locationId } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    console.log('Searching for payment notices in date range:', dateRange);
    if (locationId) {
      console.log('Filtering by location ID:', locationId);
    }

    // Search for payment notices within the date range with related resources
    const searchParams: any[] = [
      {
        name: 'created',
        value: `ge${dateRange.start}`,
      },
      {
        name: 'created',
        value: `le${dateRange.end}`,
      },
      {
        name: '_count',
        value: '1000',
      },
    ];

    // Add _include parameters to get related resources for location filtering
    if (locationId) {
      searchParams.push(
        {
          name: '_include',
          value: 'PaymentNotice:request',
        },
        {
          name: '_include:iterate',
          value: 'Encounter:appointment',
        },
        {
          name: '_include:iterate',
          value: 'Appointment:location',
        }
      );
    }

    const paymentNoticeSearchResult = await oystehr.fhir.search<any>({
      resourceType: 'PaymentNotice',
      params: searchParams,
    });

    // Get all resources from the search
    const allResources = paymentNoticeSearchResult.unbundle();

    // Separate resources by type
    let paymentNotices = allResources.filter((r: any) => r.resourceType === 'PaymentNotice');
    console.log(`Found ${paymentNotices.length} payment notices`);

    // If locationId filter is provided, filter payment notices by location
    if (locationId && paymentNotices.length > 0) {
      const encounters = allResources.filter((r: any) => r.resourceType === 'Encounter');
      const appointments = allResources.filter((r: any) => r.resourceType === 'Appointment');

      // Create maps for quick lookups
      const encounterMap = new Map<string, any>();
      encounters.forEach((encounter: any) => {
        if (encounter.id) {
          encounterMap.set(encounter.id, encounter);
        }
      });

      const appointmentMap = new Map<string, any>();
      appointments.forEach((appointment: any) => {
        if (appointment.id) {
          appointmentMap.set(appointment.id, appointment);
        }
      });

      // Filter payment notices by location
      paymentNotices = paymentNotices.filter((payment: any) => {
        // Get the encounter reference from payment notice
        if (!payment.request?.reference || payment.request.type !== 'Encounter') {
          return false;
        }

        const encounterId = payment.request.reference.replace('Encounter/', '');
        const encounter = encounterMap.get(encounterId);

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
        return appointment.participant.some((participant: any) => {
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
    const paymentItems: PaymentItem[] = paymentNotices.map((payment: any) => {
      // Extract payment method from extension
      const paymentMethodExtension = payment.extension?.find(
        (ext: any) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
      );
      const paymentMethod = paymentMethodExtension?.valueString || 'N/A';

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
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});

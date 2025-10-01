import { APIGatewayProxyResult } from 'aws-lambda';
import { PaymentNotice } from 'fhir/r4b';
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
    const { dateRange } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    console.log('Searching for payment notices in date range:', dateRange);

    // Search for payment notices within the date range
    const paymentNoticeSearchResult = await oystehr.fhir.search<PaymentNotice>({
      resourceType: 'PaymentNotice',
      params: [
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
      ],
    });

    // Get all payment notices
    const paymentNotices = paymentNoticeSearchResult.unbundle();
    console.log(`Found ${paymentNotices.length} payment notices`);

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
      const paymentMethodExtension = payment.extension?.find(
        (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
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

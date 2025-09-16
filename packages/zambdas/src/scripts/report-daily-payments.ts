import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import * as fs from 'fs';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// Helper function to convert local date to UTC range
function getUTCRangeForLocalDate(localDateString: string): { start: Date; end: Date } {
  // Create start of day in local timezone (00:00:00.000)
  const startOfDayLocal = new Date(`${localDateString}T00:00:00.000`);

  // Create end of day in local timezone (23:59:59.999)
  const endOfDayLocal = new Date(`${localDateString}T23:59:59.999`);

  return {
    start: startOfDayLocal,
    end: endOfDayLocal,
  };
}

async function getPaymentNoticesByDateRange(
  oystehr: Oystehr,
  startDate: Date,
  endDate: Date
): Promise<PaymentNotice[]> {
  let currentIndex = 0;
  let total = 1;
  const result: PaymentNotice[] = [];

  // Convert Date objects to ISO strings for FHIR search
  const startISO = startDate.toISOString();
  const endISO = endDate.toISOString();

  console.log(`Fetching PaymentNotices for date range: ${startISO} to ${endISO}`);

  while (currentIndex < total) {
    try {
      const searchParams = [
        {
          name: 'created',
          value: `ge${startISO}`,
        },
        {
          name: 'created',
          value: `le${endISO}`,
        },
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ];

      const bundledResponse = await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: searchParams,
      });

      total = bundledResponse.total || 0;
      const unbundled = bundledResponse.unbundle();
      result.push(...unbundled);
      currentIndex += unbundled.length;

      console.log(`Fetched ${unbundled.length} PaymentNotices (${result.length}/${total} total)`);
    } catch (error) {
      console.error(`Error fetching PaymentNotices at offset ${currentIndex}:`, error);
      break;
    }
  }

  console.log(`Found ${result.length} PaymentNotices between ${startISO} and ${endISO}`);
  return result;
}

// Helper to get timezone abbreviation (e.g., "PST", "EST")
function getTimezoneAbbreviation(): string {
  const date = new Date();
  const timeZoneName = date
    .toLocaleDateString('en', {
      day: '2-digit',
      timeZoneName: 'short',
    })
    .slice(4);
  return timeZoneName;
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

async function main(): Promise<void> {
  const env = process.argv[2];
  const targetDateString =
    process.argv[3] ||
    (() => {
      // Default to yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday.toISOString().split('T')[0];
    })();

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const { start, end } = getUTCRangeForLocalDate(targetDateString);

  const payments = await getPaymentNoticesByDateRange(oystehr, start, end);

  if (payments.length === 0) {
    console.log('No payment notices found for the specified date.');
    return;
  }

  const timezoneAbbr = getTimezoneAbbreviation();
  console.log(`\n📊 Payment Notices for ${targetDateString} (${timezoneAbbr}):`);

  // Group payments by payment method
  const paymentsByMethod = new Map<string, PaymentNotice[]>();

  for (const payment of payments) {
    const paymentMethodExtension = payment.extension?.find(
      (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
    );
    const paymentMethod = paymentMethodExtension?.valueString || 'N/A';

    if (!paymentsByMethod.has(paymentMethod)) {
      paymentsByMethod.set(paymentMethod, []);
    }
    paymentsByMethod.get(paymentMethod)!.push(payment);
  }

  // Sort payment methods alphabetically for consistent output
  const sortedMethods = Array.from(paymentsByMethod.keys()).sort();

  let grandTotal = 0;
  const allCurrencies = new Set<string>();

  for (const paymentMethod of sortedMethods) {
    const methodPayments = paymentsByMethod.get(paymentMethod)!;

    console.log(`\n💳 ${paymentMethod.toUpperCase()}:`);
    console.log('Date\t\tAmount\t\tPayment Method');
    console.log('--------------------------------------------');

    let methodTotal = 0;
    const methodCurrencies = new Set<string>();

    for (const payment of methodPayments) {
      // Extract and format the GMT created date to local date only
      const createdDate = formatGMTToLocalDate(payment.created || '');

      // Extract payment amount and format as currency with 2 decimal places
      const amount: number = parseAsNumber(payment.amount?.value);
      const currency = payment.amount?.currency || '';
      const formattedAmount = amount.toFixed(2);

      // Right-align the amount with fixed width (7 characters for the number part)
      const paddedAmount = formattedAmount.padStart(7, ' ');
      const amountDisplay = currency ? `${paddedAmount} ${currency}` : paddedAmount;

      console.log(`${createdDate}\t${amountDisplay}\t${paymentMethod}`);

      // Add to totals
      methodTotal += amount;
      grandTotal += amount;

      if (currency) {
        methodCurrencies.add(currency);
        allCurrencies.add(currency);
      }
    }

    // Print subtotal for this payment method
    console.log('--------------------------------------------');
    const methodTotalFormatted = methodTotal.toFixed(2).padStart(7, ' ');
    const methodCurrencyList = Array.from(methodCurrencies).join(', ') || 'N/A';
    console.log(`Subtotal: ${methodTotalFormatted} (${methodCurrencyList}) - ${methodPayments.length} transactions`);
  }

  // Print grand total
  console.log('\n============================================');
  const grandTotalFormatted = grandTotal.toFixed(2).padStart(7, ' ');
  const allCurrencyList = Array.from(allCurrencies).join(', ') || 'N/A';
  console.log(`GRAND TOTAL: ${grandTotalFormatted} (${allCurrencyList})`);
  console.log(`TOTAL COUNT: ${payments.length} payment notices`);
}

main()
  .then(() => console.log('✅ This is all the transactions for the specified date'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

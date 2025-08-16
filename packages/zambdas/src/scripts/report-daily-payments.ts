import Oystehr from '@oystehr/sdk';
import { PaymentNotice } from 'fhir/r4b';
import * as fs from 'fs';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// Helper to get UTC range for a local date (YYYY-MM-DD)
function getUTCRangeForLocalDate(localDate: string): { start: string; end: string } {
  // localDate: 'YYYY-MM-DD'
  const startLocal = new Date(`${localDate}T00:00:00`);
  const endLocal = new Date(`${localDate}T23:59:59.999`);
  const startUTC = new Date(startLocal.getTime() - startLocal.getTimezoneOffset() * 60000).toISOString();
  const endUTC = new Date(endLocal.getTime() - endLocal.getTimezoneOffset() * 60000).toISOString();
  return { start: startUTC, end: endUTC };
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

// Helper to format GMT date to local timezone as yyyy-MM-dd HH:mm
function formatGMTToLocalDateTime(gmtDateString: string): string {
  if (!gmtDateString) return 'N/A';
  try {
    // Parse the GMT date string
    const gmtDate = new Date(gmtDateString);
    if (isNaN(gmtDate.getTime())) return 'N/A';

    // Convert to local timezone and format as yyyy-MM-dd HH:mm
    const yyyy = gmtDate.getFullYear();
    const mm = String(gmtDate.getMonth() + 1).padStart(2, '0');
    const dd = String(gmtDate.getDate()).padStart(2, '0');
    const hh = String(gmtDate.getHours()).padStart(2, '0');
    const min = String(gmtDate.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  } catch {
    return 'N/A';
  }
}

// Update getPaymentNoticesByDate to accept a date range
async function getPaymentNoticesByDateRange(oystehr: Oystehr, start: string, end: string): Promise<PaymentNotice[]> {
  let currentIndex = 0;
  let total = 1;
  const result: PaymentNotice[] = [];

  console.log(`Fetching PaymentNotices from ${start} to ${end}`);

  while (currentIndex < total) {
    try {
      const bundledResponse = await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [
          { name: 'created', value: `ge${start}` },
          { name: 'created', value: `le${end}` },
          { name: '_offset', value: currentIndex },
          { name: '_count', value: 1000 },
          { name: '_total', value: 'accurate' },
        ],
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

  console.log(`Found ${result.length} PaymentNotices from ${start} to ${end}`);
  return result;
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const dateArg = process.argv[3]; // Optional date argument

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // Use provided date or default to yesterday's date in YYYY-MM-DD format
  let targetDate: string;
  if (dateArg) {
    // Validate date format (basic check for YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateArg)) {
      throw new Error('❌ Invalid date format. Please use YYYY-MM-DD format.');
    }
    targetDate = dateArg;
  } else {
    // Get yesterday's date
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    targetDate = yesterday.toISOString().split('T')[0];
  }

  // Compute UTC range for local date
  const { start, end } = getUTCRangeForLocalDate(targetDate);

  console.log(`\n📊 Daily Payment Report for ${targetDate}:`);
  console.log(`🔍 Searching GMT range: ${start} to ${end}`);

  // Fetch all payment notices for the local date range (in UTC)
  const paymentNotices = await getPaymentNoticesByDateRange(oystehr, start, end);

  if (paymentNotices.length === 0) {
    console.log('No payment notices found for this date.');
    return;
  }

  // Get timezone abbreviation for CSV header
  const timezoneAbbr = getTimezoneAbbreviation();

  // Prepare CSV content with timezone in header
  const csvHeaders = [`Date (${timezoneAbbr})`, 'Amount', 'Currency', 'Payment Method'];
  const csvRows: string[] = [csvHeaders.join(',')];

  console.log(`\nProcessing ${paymentNotices.length} payment notices for ${targetDate}...`);

  for (const notice of paymentNotices) {
    // Extract and format the GMT created date to local timezone
    const createdDate = formatGMTToLocalDateTime(notice.created || '');

    // Extract amount and currency
    const amount = notice.amount?.value || 'N/A';
    const currency = notice.amount?.currency || 'N/A';

    // Find the payment method extension
    const paymentMethodExtension = notice.extension?.find(
      (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
    );
    const paymentMethod = paymentMethodExtension?.valueString || 'N/A';

    // Create CSV row (escape commas in values)
    const csvRow = [createdDate, amount, currency, paymentMethod]
      .map((value) => (typeof value === 'string' && value.includes(',') ? `"${value}"` : value))
      .join(',');

    csvRows.push(csvRow);
  }

  // Generate CSV filename
  const csvFilename = `payments-report-${targetDate}.csv`;

  // Write CSV file
  const csvContent = csvRows.join('\n');
  fs.writeFileSync(csvFilename, csvContent, 'utf8');

  // Summary
  const totalAmount = paymentNotices.reduce((sum, notice) => {
    const value = notice.amount?.value || 0;
    return sum + (typeof value === 'number' ? value : parseFloat(value) || 0);
  }, 0);

  const currencies = [...new Set(paymentNotices.map((notice) => notice.amount?.currency).filter(Boolean))];

  console.log(`\n✅ CSV report generated: ${csvFilename}`);
  console.log(`📊 Summary:`);
  console.log(`   Total Amount: ${totalAmount.toFixed(2)} (currencies: ${currencies.join(', ') || 'N/A'})`);
  console.log(`   Total Notices: ${paymentNotices.length}`);
  console.log(`   Timezone: ${timezoneAbbr}`);
}

main()
  .then(() => console.log('\n✅ Completed daily payment report'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

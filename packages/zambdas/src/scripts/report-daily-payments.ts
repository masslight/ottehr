import Oystehr from '@oystehr/sdk';
import { Organization, PaymentNotice } from 'fhir/r4b';
import * as fs from 'fs';
import { ORG_TYPE_CODE_SYSTEM, ORG_TYPE_PAYER_CODE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// Helper function to format date as yyyy-MM-dd HH:mm
function formatDateTime(dateString: string): string {
  if (!dateString) return 'N/A';
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    
    return date.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return 'N/A';
  }
}

async function getPaymentNoticesByDate(oystehr: Oystehr, date: string): Promise<PaymentNotice[]> {
  let currentIndex = 0;
  let total = 1;
  const result: PaymentNotice[] = [];

  console.log(`Fetching PaymentNotices for date: ${date}`);

  while (currentIndex < total) {
    try {
      const bundledResponse = await oystehr.fhir.search<PaymentNotice>({
        resourceType: 'PaymentNotice',
        params: [
          {
            name: 'created',
            value: date, // Expected format: YYYY-MM-DD
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

  console.log(`Found ${result.length} PaymentNotices for date: ${date}`);
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
  
  console.log(`\n📊 Daily Payment Report for ${targetDate}:`);
  
  // Fetch all payment notices for the target date
  const paymentNotices = await getPaymentNoticesByDate(oystehr, targetDate);
  
  if (paymentNotices.length === 0) {
    console.log('No payment notices found for this date.');
    return;
  }

  // Prepare CSV content
  const csvHeaders = ['Date', 'Amount', 'Currency', 'Payment Method'];
  const csvRows: string[] = [csvHeaders.join(',')];

  console.log(`\nProcessing ${paymentNotices.length} payment notices for ${targetDate}...`);

  for (const notice of paymentNotices) {
    // Extract and format the created date
    const createdDate = formatDateTime(notice.created || '');
    
    // Extract amount and currency
    const amount = notice.amount?.value || 'N/A';
    const currency = notice.amount?.currency || 'N/A';
    
    // Find the payment method extension
    const paymentMethodExtension = notice.extension?.find(
      ext => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
    );
    const paymentMethod = paymentMethodExtension?.valueString || 'N/A';
    
    // Create CSV row (escape commas in values)
    const csvRow = [createdDate, amount, currency, paymentMethod].map(value => 
      typeof value === 'string' && value.includes(',') ? `"${value}"` : value
    ).join(',');
    
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

  const currencies = [...new Set(paymentNotices.map(notice => notice.amount?.currency).filter(Boolean))];
  
  console.log(`\n✅ CSV report generated: ${csvFilename}`);
  console.log(`📊 Summary:`);
  console.log(`   Total Amount: ${totalAmount.toFixed(2)} (currencies: ${currencies.join(', ') || 'N/A'})`);
  console.log(`   Total Notices: ${paymentNotices.length}`);
}

main()
  .then(() => console.log('\n✅ Completed daily payment report'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

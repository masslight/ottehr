import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, PaymentNotice } from 'fhir/r4b';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

// Add new Payment interface
interface Payment {
  paymentNotice: PaymentNotice;
  encounter?: Encounter;
  appointment?: Appointment;
  location?: Location;
}

async function getPaymentNoticesByDateRange(oystehr: Oystehr, startDate: Date, endDate: Date): Promise<Payment[]> {
  let currentIndex = 0;
  let total = 1;
  const paymentNotices: PaymentNotice[] = [];
  const encounterMap = new Map<string, Encounter>();
  const appointmentMap = new Map<string, Appointment>();
  const locationMap = new Map<string, Location>();

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
        },
      ];

      const bundledResponse = await oystehr.fhir.search<PaymentNotice | Encounter | Appointment | Location>({
        resourceType: 'PaymentNotice',
        params: searchParams,
      });

      total = bundledResponse.total || 0;

      // Process bundle entries to separate resource types
      const entries = bundledResponse.entry || [];

      for (const entry of entries) {
        if (entry.resource) {
          const resource = entry.resource;
          switch (resource.resourceType) {
            case 'PaymentNotice': {
              paymentNotices.push(resource as PaymentNotice);
              break;
            }
            case 'Encounter': {
              const encounter = resource as Encounter;
              if (encounter.id) {
                encounterMap.set(encounter.id, encounter);
              }
              break;
            }
            case 'Appointment': {
              const appointment = resource as Appointment;
              if (appointment.id) {
                appointmentMap.set(appointment.id, appointment);
              }
              break;
            }
            case 'Location': {
              const location = resource as Location;
              if (location.id) {
                locationMap.set(location.id, location);
              }
              break;
            }
          }
        }
      }

      currentIndex += paymentNotices.length - currentIndex;

      console.log(
        `Fetched ${paymentNotices.length} PaymentNotices, ${encounterMap.size} Encounters, ${appointmentMap.size} Appointments, ${locationMap.size} Locations (${paymentNotices.length}/${total} total)`
      );
    } catch (error) {
      console.error(`Error fetching PaymentNotices at offset ${currentIndex}:`, error);
      break;
    }
  }

  console.log(`Found ${paymentNotices.length} PaymentNotices between ${startISO} and ${endISO}`);
  console.log(
    `Found ${encounterMap.size} Encounters, ${appointmentMap.size} Appointments, ${locationMap.size} Locations`
  );

  // Build Payment objects by linking resources together
  const payments: Payment[] = [];

  for (const paymentNotice of paymentNotices) {
    const payment: Payment = {
      paymentNotice,
    };

    // Link encounter if request references one
    if (paymentNotice.request?.reference && paymentNotice.request.type === 'Encounter') {
      const encounterId = paymentNotice.request.reference.replace('Encounter/', '');
      const encounter = encounterMap.get(encounterId);

      if (encounter) {
        payment.encounter = encounter;

        // Link appointment if encounter references one
        if (encounter.appointment && encounter.appointment.length > 0) {
          const appointmentRef = encounter.appointment[0].reference;
          if (appointmentRef) {
            const appointmentId = appointmentRef.replace('Appointment/', '');
            const appointment = appointmentMap.get(appointmentId);

            if (appointment) {
              payment.appointment = appointment;

              // Link location if appointment references one
              if (appointment.participant) {
                for (const participant of appointment.participant) {
                  if (participant.actor?.reference?.startsWith('Location/')) {
                    const locationId = participant.actor.reference.replace('Location/', '');
                    const location = locationMap.get(locationId);

                    if (location) {
                      payment.location = location;
                      break; // Use first location found
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    payments.push(payment);
  }

  console.log(`✅ Built ${payments.length} Payment objects with linked resources`);

  return payments;
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

// Add CSV report generation function
function generatePaymentCSVReport(payments: Payment[], targetDate: string, env: string, customFilename?: string): void {
  try {
    // Determine filename
    let filename: string;
    if (customFilename) {
      filename = customFilename;
    } else {
      const downloadsDir = path.join(os.homedir(), 'Downloads');
      filename = path.join(downloadsDir, `${env}-daily-payments-report-${targetDate}.csv`);
    }

    console.log(`\n📊 Generating CSV report: ${filename}`);

    // CSV headers
    const headers = ['Date', 'Amount', 'Payment Method', 'Location', 'Appointment Date'];

    // Convert payments to CSV rows
    const csvRows = [
      headers.join(','), // Header row
      ...payments.map((payment) => {
        const date = formatGMTToLocalDate(payment.paymentNotice.created || '');
        const amount = parseAsNumber(payment.paymentNotice.amount?.value).toFixed(2);
        const currency = payment.paymentNotice.amount?.currency || '';
        const amountWithCurrency = currency ? `${amount} ${currency}` : amount;

        const paymentMethodExtension = payment.paymentNotice.extension?.find(
          (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
        );
        const paymentMethod = paymentMethodExtension?.valueString || 'N/A';
        const locationName = payment.location?.name || 'Unknown Location';
        const appointmentDate = payment.appointment?.start ? formatGMTToLocalDate(payment.appointment.start) : 'N/A';

        return [
          `"${date}"`,
          `"${amountWithCurrency}"`,
          `"${paymentMethod}"`,
          `"${locationName}"`,
          `"${appointmentDate}"`,
        ].join(',');
      }),
    ];

    // Write CSV file
    const csvContent = csvRows.join('\n');
    fs.writeFileSync(filename, csvContent, 'utf8');

    console.log(`✅ CSV report generated successfully: ${filename}`);
    console.log(`📄 Report contains ${payments.length} payment records`);
  } catch (error) {
    console.error(`❌ Error generating CSV report:`, error);
    throw error;
  }
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
  const csvFilename = process.argv[4]; // Optional custom filename

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

  // Group payments by location, then by payment method
  const paymentsByLocation = new Map<string, Map<string, Payment[]>>();

  for (const payment of payments) {
    const locationName = payment.location?.name || 'Unknown Location';

    const paymentMethodExtension = payment.paymentNotice.extension?.find(
      (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
    );
    const paymentMethod = paymentMethodExtension?.valueString || 'N/A';

    // Get or create location map
    if (!paymentsByLocation.has(locationName)) {
      paymentsByLocation.set(locationName, new Map<string, Payment[]>());
    }

    const locationMap = paymentsByLocation.get(locationName)!;

    // Get or create payment method array
    if (!locationMap.has(paymentMethod)) {
      locationMap.set(paymentMethod, []);
    }

    locationMap.get(paymentMethod)!.push(payment);
  }

  // Sort locations alphabetically
  const sortedLocations = Array.from(paymentsByLocation.keys()).sort();

  let grandTotal = 0;
  const allCurrencies = new Set<string>();
  const overallMethodTotals = new Map<string, number>();
  const overallMethodCounts = new Map<string, number>();

  // Process each location
  for (const locationName of sortedLocations) {
    const locationMap = paymentsByLocation.get(locationName)!;
    let locationTotal = 0;
    const locationCurrencies = new Set<string>();

    console.log(`\n${'='.repeat(100)}`);
    console.log(`📍 LOCATION: ${locationName}`);
    console.log(`${'='.repeat(100)}`);

    // Sort payment methods alphabetically within location
    const sortedMethods = Array.from(locationMap.keys()).sort();

    for (const paymentMethod of sortedMethods) {
      const methodPayments = locationMap.get(paymentMethod)!;

      // Choose emoji based on payment method
      let emoji = '💳'; // default card emoji
      const methodLower = paymentMethod.toLowerCase();
      if (methodLower === 'cash') {
        emoji = '💵';
      } else if (methodLower === 'card' || methodLower === 'credit-card' || methodLower === 'debit-card') {
        emoji = '💳';
      } else if (methodLower === 'check') {
        emoji = '🏦';
      }

      console.log(`\n   ${emoji} ${paymentMethod.toUpperCase()}:`);
      console.log('   Date\t\t   Amount\t   Payment Method\t   Appointment Date');
      console.log('   ' + '-'.repeat(90));

      let methodTotal = 0;
      const methodCurrencies = new Set<string>();

      for (const payment of methodPayments) {
        // Extract and format the GMT created date to local date only
        const createdDate = formatGMTToLocalDate(payment.paymentNotice.created || '');

        // Extract payment amount and format as currency with 2 decimal places
        const amount: number = parseAsNumber(payment.paymentNotice.amount?.value);
        const currency = payment.paymentNotice.amount?.currency || '';
        const formattedAmount = amount.toFixed(2);

        // Right-align the amount with fixed width (7 characters for the number part)
        const paddedAmount = formattedAmount.padStart(7, ' ');
        const amountDisplay = currency ? `${paddedAmount} ${currency}` : paddedAmount;

        // Extract encounter date
        const encounterDate = payment.appointment?.start ? formatGMTToLocalDate(payment.appointment.start) : 'N/A';

        console.log(`   ${createdDate}\t   ${amountDisplay}\t   ${paymentMethod}\t\t   ${encounterDate}`);

        // Add to totals
        methodTotal += amount;
        locationTotal += amount;
        grandTotal += amount;

        if (currency) {
          methodCurrencies.add(currency);
          locationCurrencies.add(currency);
          allCurrencies.add(currency);
        }
      }

      // Update overall method totals
      overallMethodTotals.set(paymentMethod, (overallMethodTotals.get(paymentMethod) || 0) + methodTotal);
      overallMethodCounts.set(paymentMethod, (overallMethodCounts.get(paymentMethod) || 0) + methodPayments.length);

      // Print subtotal for this payment method within this location
      console.log('   ' + '-'.repeat(90));
      const methodTotalFormatted = methodTotal.toFixed(2).padStart(7, ' ');
      const methodCurrencyList = Array.from(methodCurrencies).join(', ') || 'N/A';
      console.log(
        `   ${paymentMethod} Subtotal: ${methodTotalFormatted} (${methodCurrencyList}) - ${methodPayments.length} transactions`
      );
    }

    // Print location total
    console.log(`\n   ${'='.repeat(90)}`);
    const locationTotalFormatted = locationTotal.toFixed(2).padStart(7, ' ');
    const locationCurrencyList = Array.from(locationCurrencies).join(', ') || 'N/A';
    const locationTransactionCount = Array.from(locationMap.values()).reduce((sum, arr) => sum + arr.length, 0);
    console.log(
      `   📍 ${locationName} TOTAL: ${locationTotalFormatted} (${locationCurrencyList}) - ${locationTransactionCount} transactions`
    );
  }

  // Print overall summary
  console.log(`\n${'='.repeat(100)}`);
  console.log(`📊 OVERALL SUMMARY`);
  console.log(`${'='.repeat(100)}`);

  // Print summary by payment method
  console.log('\n💰 Totals by Payment Method:');
  const sortedOverallMethods = Array.from(overallMethodTotals.keys()).sort();

  for (const method of sortedOverallMethods) {
    const total = overallMethodTotals.get(method)!;
    const count = overallMethodCounts.get(method)!;
    const totalFormatted = total.toFixed(2).padStart(10, ' ');
    console.log(`   ${method.padEnd(20)} ${totalFormatted} (${count} transactions)`);
  }

  // Print grand total
  console.log('\n' + '='.repeat(100));
  const grandTotalFormatted = grandTotal.toFixed(2).padStart(10, ' ');
  const allCurrencyList = Array.from(allCurrencies).join(', ') || 'N/A';
  console.log(`🏆 GRAND TOTAL: ${grandTotalFormatted} (${allCurrencyList})`);
  console.log(`📋 TOTAL COUNT: ${payments.length} payment notices`);
  console.log(`📍 LOCATIONS: ${sortedLocations.length}`);
  console.log('='.repeat(100));

  // Generate CSV report
  generatePaymentCSVReport(payments, targetDateString, env, csvFilename);
}

main()
  .then(() => console.log('✅ This is all the transactions for the specified date'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

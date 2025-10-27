import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, Location, PaymentNotice } from 'fhir/r4b';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

// Helper function to convert local date to UTC range (from start date to end of today)
function getUTCRangeForLocalDateRangeToToday(localDateString: string): { start: Date; end: Date } {
  // Create start of day in local timezone (00:00:00.000)
  const startOfDayLocal = new Date(`${localDateString}T00:00:00.000`);

  // Create end of today in local timezone (23:59:59.999)
  const today = new Date();
  const todayDateString = today.toISOString().split('T')[0];
  const endOfDayLocal = new Date(`${todayDateString}T23:59:59.999`);

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

// Generate CSV report for duplicate payments
async function generateDuplicatePaymentsCSV(
  duplicateGroups: [string, Payment[]][],
  oystehr: Oystehr,
  customFilename?: string
): Promise<void> {
  // Determine filename
  let filename: string;
  if (customFilename) {
    filename = customFilename;
  } else {
    const downloadsDir = path.join(os.homedir(), 'Downloads');
    filename = path.join(downloadsDir, `duplicate-payments.csv`);
  }

  console.log(`\n📊 Generating duplicate payments CSV report: ${filename}`);

  // CSV headers
  const headers = ['Patient Name', 'Payment Timestamp', 'Amount', 'Payment Method'];

  const csvRows: string[] = [headers.join(',')];

  // Cache patient names to avoid duplicate fetches
  const patientNameCache = new Map<string, string>();

  for (const [key, duplicatePayments] of duplicateGroups) {
    const [, amountStr] = key.split('|');
    const amount = parseFloat(amountStr);

    // Get patient name from first payment (same for all duplicates)
    let patientName = 'Unknown';
    let patientId = '';

    if (duplicatePayments[0].encounter?.subject?.reference) {
      patientId = duplicatePayments[0].encounter.subject.reference.replace('Patient/', '');

      // Check cache first
      if (patientNameCache.has(patientId)) {
        patientName = patientNameCache.get(patientId)!;
      } else {
        try {
          const patient = (await oystehr.fhir.get({
            resourceType: 'Patient',
            id: patientId,
          })) as import('fhir/r4b').Patient;

          const firstName = patient.name?.[0]?.given?.[0] || '';
          const lastName = patient.name?.[0]?.family || '';
          patientName = `${firstName} ${lastName}`.trim() || 'Unknown';

          // Cache the name
          patientNameCache.set(patientId, patientName);
        } catch (error) {
          patientName = `Patient ${patientId}`;
          console.warn(`⚠️ Failed to fetch patient name for ${patientId}: ${JSON.stringify(error)}`);
        }
      }
    }

    for (const payment of duplicatePayments) {
      const paymentDateTime = payment.paymentNotice.created
        ? new Date(payment.paymentNotice.created).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          })
        : 'N/A';
      const paymentMethodExtension = payment.paymentNotice.extension?.find(
        (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
      );
      const paymentMethod = paymentMethodExtension?.valueString || 'N/A';
      const currency = payment.paymentNotice.amount?.currency || 'USD';
      const amountWithCurrency = `$${amount.toFixed(2)} ${currency}`;

      csvRows.push(
        [`"${patientName}"`, `"${paymentDateTime}"`, `"${amountWithCurrency}"`, `"${paymentMethod}"`].join(',')
      );
    }
  }

  // Write CSV file
  const csvContent = csvRows.join('\n');
  fs.writeFileSync(filename, csvContent, 'utf8');

  console.log(`✅ CSV report generated successfully: ${filename}`);
  console.log(`📄 Report contains ${csvRows.length - 1} duplicate payment records`);
  console.log(`👥 Unique patients: ${patientNameCache.size}`);
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const daysAgo = parseInt(process.argv[3] || '1', 10); // Default to 1 day ago
  const csvFilename = process.argv[4]; // Optional custom filename

  // Validate daysAgo is a positive number
  if (isNaN(daysAgo) || daysAgo < 0) {
    throw new Error(
      '❌ Days ago must be a positive number. Usage: npm run script report-duplicate-payments <env> <days-ago>'
    );
  }

  // Calculate target date based on days ago
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetDateString = targetDate.toISOString().split('T')[0];

  console.log(`\n📅 Analyzing payments from ${daysAgo} day(s) ago (${targetDateString})`);

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const { start, end } = getUTCRangeForLocalDateRangeToToday(targetDateString);

  const payments = await getPaymentNoticesByDateRange(oystehr, start, end);

  if (payments.length === 0) {
    console.log('No payment notices found for the specified date.');
    return;
  }

  const timezoneAbbr = getTimezoneAbbreviation();
  console.log(`\n📊 Payment Notices for ${targetDateString} (${timezoneAbbr}):`);
  console.log(`Total payments: ${payments.length}`);

  // Check for duplicate payments (same appointment and same amount)
  console.log(`\n🔍 Checking for duplicate payments...`);

  // Group payments by appointment ID and amount
  const paymentGroups = new Map<string, Payment[]>();

  for (const payment of payments) {
    const appointmentId = payment.appointment?.id;
    const amount = parseAsNumber(payment.paymentNotice.amount?.value);
    // console.log(`Processing PaymentNotice ID: ${payment.paymentNotice.id}, Appointment ID: ${appointmentId}, Amount: ${amount}`);

    if (appointmentId && amount > 0) {
      const key = `${appointmentId}|${amount}`;

      if (!paymentGroups.has(key)) {
        paymentGroups.set(key, []);
      }

      paymentGroups.get(key)!.push(payment);
    }
  }

  // Find groups with duplicates (more than 1 payment)
  const duplicateGroups = Array.from(paymentGroups.entries()).filter(([_, payments]) => payments.length > 1);

  if (duplicateGroups.length > 0) {
    console.log(`\n⚠️  Found ${duplicateGroups.length} appointment(s) with duplicate payments:`);
    console.log('='.repeat(140));

    for (const [key, duplicatePayments] of duplicateGroups) {
      const [appointmentId, amountStr] = key.split('|');
      const amount = parseFloat(amountStr);

      console.log(`\n🔴 Duplicate Payment Alert - Appointment: ${appointmentId}`);
      console.log(`   Amount: $${amount.toFixed(2)} (${duplicatePayments.length} payments)`);
      console.log(`   Location: ${duplicatePayments[0].location?.name || 'Unknown'}`);
      console.log(
        `   Appointment Date: ${
          duplicatePayments[0].appointment?.start ? formatGMTToLocalDate(duplicatePayments[0].appointment.start) : 'N/A'
        }`
      );

      // Get patient information from the encounter
      let patientName = 'Unknown';
      let patientId = 'N/A';

      if (duplicatePayments[0].encounter?.subject?.reference) {
        patientId = duplicatePayments[0].encounter.subject.reference.replace('Patient/', '');

        try {
          const patient = (await oystehr.fhir.get({
            resourceType: 'Patient',
            id: patientId,
          })) as import('fhir/r4b').Patient;

          const firstName = patient.name?.[0]?.given?.[0] || '';
          const lastName = patient.name?.[0]?.family || '';
          patientName = `${firstName} ${lastName}`.trim() || 'Unknown';

          console.log(`   Patient: ${patientName} (ID: ${patientId})`);
        } catch (error) {
          console.log(`   Patient: Unable to fetch (ID: ${patientId}) - ${JSON.stringify(error)}`);
        }
      } else {
        console.log(`   Patient: No patient reference found`);
      }

      console.log(`\n   Individual Payments:`);
      console.log('   ' + '-'.repeat(130));

      for (let i = 0; i < duplicatePayments.length; i++) {
        const payment = duplicatePayments[i];
        const paymentDateTime = payment.paymentNotice.created
          ? new Date(payment.paymentNotice.created).toLocaleString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZoneName: 'short',
            })
          : 'N/A';

        const paymentMethodExtension = payment.paymentNotice.extension?.find(
          (ext) => ext.url === 'https://extensions.fhir.zapehr.com/payment-method'
        );
        const paymentMethod = paymentMethodExtension?.valueString || 'N/A';
        const currency = payment.paymentNotice.amount?.currency || 'USD';

        console.log(
          `[${
            i + 1
          }] Patient: ${patientName} Time: ${paymentDateTime} Amount: $${amountStr} ${currency} Method: ${paymentMethod}`
        );
      }

      console.log('   ' + '='.repeat(130));
    }

    console.log(`\n⚠️  Total duplicate payment groups found: ${duplicateGroups.length}`);
    console.log(
      `💰 Total duplicate amount: $${duplicateGroups
        .reduce((sum, [key, payments]) => {
          const amount = parseFloat(key.split('|')[1]);
          return sum + amount * (payments.length - 1); // Only count the extra payments
        }, 0)
        .toFixed(2)}`
    );

    // Generate CSV report
    await generateDuplicatePaymentsCSV(duplicateGroups, oystehr, csvFilename);
  } else {
    console.log(`✅ No duplicate payments found.`);
  }
}

main()
  .then(() => console.log('✅ This is all the transactions for the specified date'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

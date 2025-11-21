import Oystehr from '@oystehr/sdk';
import { Appointment, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import Stripe from 'stripe';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

interface StripeInvoice {
  invoiceId: string;
  customerId: string;
  oystehrPatientId?: string;
  amount: number; // in cents
  amountDue: number; // in cents
  status: string;
  createdDate: Date;
  dueDate: Date | null;
  invoiceLink: string;
  customerEmail?: string;
  customerName?: string;
  metadata: { [key: string]: string };
  defaultPaymentMethod?: {
    id: string;
    type: string;
    last4?: string;
    brand?: string;
    expMonth?: number;
    expYear?: number;
  };
}

async function findOpenStripeInvoicesDueOnOrBeforeDate(stripe: Stripe, beforeDate: Date): Promise<StripeInvoice[]> {
  try {
    const beforeTimestamp = Math.floor(beforeDate.getTime() / 1000); // Convert to Unix timestamp
    console.log(`🔍 Searching for Stripe invoices created on or before: ${beforeDate.toISOString()}`);

    const allInvoices: StripeInvoice[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const invoicesResponse = await stripe.invoices.list({
        limit: 100,
        due_date: {
          lte: beforeTimestamp, // Less than the provided date
        },
        status: 'open', // Only get open (unpaid) invoices
        starting_after: startingAfter,
        expand: ['data.customer'], // Expand customer data to get email and name
      });

      for (const invoice of invoicesResponse.data) {
        const customer = invoice.customer as Stripe.Customer;

        // Get default payment method if available
        let defaultPaymentMethod = undefined;

        if (customer && typeof customer !== 'string' && customer.invoice_settings?.default_payment_method) {
          try {
            const paymentMethod = await stripe.paymentMethods.retrieve(
              customer.invoice_settings.default_payment_method as string
            );

            defaultPaymentMethod = {
              id: paymentMethod.id,
              type: paymentMethod.type,
              last4: paymentMethod.card?.last4,
              brand: paymentMethod.card?.brand,
              expMonth: paymentMethod.card?.exp_month,
              expYear: paymentMethod.card?.exp_year,
            };
          } catch (error) {
            console.log(`⚠️  Could not retrieve payment method for customer ${customer.id}:`, error);
          }
        }

        const stripeInvoiceData: StripeInvoice = {
          invoiceId: invoice.id,
          customerId: typeof customer === 'string' ? customer : customer.id,
          oystehrPatientId:
            customer && typeof customer !== 'string' ? customer.metadata?.oystehr_patient_id : undefined,
          amount: invoice.amount_paid + invoice.amount_due,
          amountDue: invoice.amount_due,
          status: invoice.status || 'unknown',
          createdDate: new Date(invoice.created * 1000),
          dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          invoiceLink: invoice.hosted_invoice_url || invoice.invoice_pdf || '',
          customerEmail: customer && typeof customer !== 'string' ? customer.email || undefined : undefined,
          customerName: customer && typeof customer !== 'string' ? customer.name || undefined : undefined,
          metadata: invoice.metadata || {},
          defaultPaymentMethod: defaultPaymentMethod,
        };

        allInvoices.push(stripeInvoiceData);
      }

      hasMore = invoicesResponse.has_more;
      if (hasMore && invoicesResponse.data.length > 0) {
        startingAfter = invoicesResponse.data[invoicesResponse.data.length - 1].id;
      }

      console.log(`📄 Fetched ${invoicesResponse.data.length} invoices (${allInvoices.length} total so far)`);
    }

    console.log(`✅ Found ${allInvoices.length} invoices created before ${beforeDate.toLocaleDateString()}`);
    return allInvoices;
  } catch (error) {
    console.error(`❌ Error finding Stripe invoices before ${beforeDate.toISOString()}:`, error);
    throw error;
  }
}

interface PatientInfo {
  fullName: string;
  dateOfBirth: string;
  latestAppointmentDate: string | null;
}

async function getPatientInfoWithLatestAppointment(oystehr: Oystehr, patientId: string): Promise<PatientInfo | null> {
  try {
    // Get patient resource
    const patient = await oystehr.fhir.get<Patient>({
      resourceType: 'Patient',
      id: patientId,
    });

    if (!patient) {
      console.log(`❌ Patient not found: ${patientId}`);
      return null;
    }

    // Extract full name
    const name = patient.name?.[0];
    const fullName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';

    // Extract date of birth
    const dateOfBirth = patient.birthDate || 'Unknown';

    // Get latest appointment for this patient
    const appointmentsResponse = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
        {
          name: 'patient',
          value: `Patient/${patientId}`,
        },
        {
          name: '_sort',
          value: '-date', // Sort by date descending (latest first)
        },
        {
          name: '_count',
          value: 1, // Only get the most recent appointment
        },
      ],
    });

    const appointments = appointmentsResponse.unbundle();

    let latestAppointmentDate: string | null = null;

    if (appointments.length > 0) {
      const latestAppointment = appointments[0];
      if (latestAppointment.start) {
        // Store the ISO date string for CSV formatting
        latestAppointmentDate = latestAppointment.start;
      }
    }

    return {
      fullName,
      dateOfBirth,
      latestAppointmentDate: latestAppointmentDate, // This will be the ISO string for CSV conversion
    };
  } catch (error) {
    console.error(`❌ Error fetching patient info for ${patientId}:`, error);
    return null;
  }
}

// Function to attempt payment on an invoice
async function attemptInvoicePayment(
  stripe: Stripe,
  invoiceId: string,
  testMode: boolean
): Promise<{ success: boolean; status: 'charged' | 'attempted' | 'not-attempted'; error?: string }> {
  if (testMode) {
    return { success: false, status: 'not-attempted' };
  }

  try {
    // Attempt to pay the invoice using the default payment method
    const paidInvoice = await stripe.invoices.pay(invoiceId);

    // const paidInvoice = {'status': 'open'} as Stripe.Invoice; // Mocked for illustration

    if (paidInvoice.status === 'paid') {
      return { success: true, status: 'charged' };
    } else {
      return { success: false, status: 'attempted', error: `Invoice status: ${paidInvoice.status}` };
    }
  } catch (error: any) {
    return {
      success: false,
      status: 'attempted',
      error: error.message || 'Unknown error',
    };
  }
}

// Updated interface for CSV data with payment status column
interface CSVReportData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  amountDue: string;
  dateDue: string;
  appointmentDate: string;
  cardOnFile: string;
  paymentStatus: string; // New column: charged, attempted, not-attempted
  status: string;
}

// Updated function to generate CSV report with payment status column
function generateCSVReport(reportData: CSVReportData[], filename: string): void {
  try {
    console.log(`\n📊 Generating CSV report: ${filename}`);

    // CSV headers with payment status
    const headers = [
      'First Name',
      'Last Name',
      'Date of Birth',
      'Amount Due',
      'Date Due',
      'Appointment Date',
      'Card on File',
      'Payment Status',
      'Status',
    ];

    // Convert data to CSV format
    const csvRows = [
      headers.join(','), // Header row
      ...reportData.map((row) =>
        [
          `"${row.firstName}"`,
          `"${row.lastName}"`,
          `"${row.dateOfBirth}"`,
          `"${row.amountDue}"`,
          `"${row.dateDue}"`,
          `"${row.appointmentDate}"`,
          `"${row.cardOnFile}"`,
          `"${row.paymentStatus}"`,
          `"${row.status}"`,
        ].join(',')
      ),
    ];

    // Write CSV file
    const csvContent = csvRows.join('\n');
    fs.writeFileSync(filename, csvContent, 'utf8');

    console.log(`✅ CSV report generated successfully: ${filename}`);
    console.log(`📄 Report contains ${reportData.length} patient records`);
  } catch (error) {
    console.error(`❌ Error generating CSV report:`, error);
    throw error;
  }
}

// Updated main function with required test mode switch
async function main(): Promise<void> {
  const env = process.argv[2];
  const testModeArg = process.argv[3]; // Required: 'test-on' or 'test-off'
  const dueDateArg: string | undefined = process.argv[4];
  const csvFilenameArg: string | undefined = process.argv[5];

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run script charge-due-and-past-due-invoices <env> <test-mode: test-on|test-off> [dueDate] [csvFilename]'
    );
  }

  if (!testModeArg) {
    throw new Error(
      '❌ Test mode is required. Usage: npm run script charge-due-and-past-due-invoices <env> <test-mode: on|off> [dueDate] [csvFilename]'
    );
  }

  // Parse test mode - default to true (on) always
  let testMode = true;
  const testModeNormalized = testModeArg.toLowerCase();

  if (testModeNormalized === 'test-off') {
    testMode = false;
  } else if (testModeNormalized === 'test-on') {
    testMode = true;
  } else {
    throw new Error('❌ Test mode must be "test-on" or "test-off"');
  }

  // Use today's date if dueDate is not provided
  let dueDate: Date;
  let dueDateString: string;

  if (dueDateArg) {
    // Validate date format (yyyy-mm-dd)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dueDateArg)) {
      throw new Error('❌ Due date must be in yyyy-mm-dd format (e.g., 2025-11-01)');
    }

    dueDate = new Date(dueDateArg);
    if (isNaN(dueDate.getTime())) {
      throw new Error('❌ Invalid date provided');
    }

    dueDateString = dueDateArg;
  } else {
    // Use today's date
    dueDate = new Date();
    dueDate.setHours(0, 0, 0, 0); // Start of today
    dueDateString = dueDate.toISOString().split('T')[0]; // yyyy-mm-dd format
  }

  // Generate default CSV filename if not provided
  const csvFilename =
    csvFilenameArg || `${process.env.HOME || '~'}/Downloads/${env}-charged-invoices-report-${dueDateString}.csv`;

  console.log(`\n📅 Processing invoices due on or before: ${dueDateString}`);
  console.log(`🧪 Test Mode: ${testMode ? 'ON (no charges will be made)' : 'OFF (invoices will be charged)'}`);
  console.log(`📄 CSV report will be saved to: ${csvFilename}`);

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  // Initialize Stripe
  const stripe = new Stripe(secrets.STRIPE_SECRET_KEY, {
    apiVersion: '2025-02-24.acacia',
  });

  // Initialize Oystehr
  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // Find all invoices due on or before the specified date
  const invoices = await findOpenStripeInvoicesDueOnOrBeforeDate(stripe, dueDate);

  if (invoices.length === 0) {
    console.log(`\n❌ No invoices found due on or before ${dueDateString}`);
    return;
  }

  console.log(`\n📊 Found ${invoices.length} invoices due on or before ${dueDateString}\n`);

  const csvReportData: CSVReportData[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let successCount = 0;
  let failCount = 0;
  let dueCount = 0;
  let pastDueCount = 0;
  let totalAmountDue = 0;
  let chargedCount = 0;
  let attemptedCount = 0;
  let notAttemptedCount = 0;
  let totalAmountCharged = 0;

  // Process each invoice
  for (let i = 0; i < invoices.length; i++) {
    const invoice = invoices[i];

    if (!invoice.oystehrPatientId) {
      console.log(`[${i + 1}/${invoices.length}] ⚠️  Invoice ${invoice.invoiceId} - No patient ID`);
      failCount++;
      notAttemptedCount++;
      continue;
    }

    try {
      // Get patient info
      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, invoice.oystehrPatientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';
      let fullName = 'Unknown';

      if (patientInfo) {
        fullName = patientInfo.fullName;
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      // Determine if invoice is due or past due
      const invoiceDueDate = invoice.dueDate || new Date(0);
      const isDue = invoiceDueDate.getTime() === today.getTime();
      const isPastDue = invoiceDueDate.getTime() < today.getTime();
      const status = isDue ? 'Due' : isPastDue ? 'Past Due' : 'Future';

      if (isDue) dueCount++;
      if (isPastDue) pastDueCount++;

      // Format card on file
      let cardOnFile = 'No card';
      let hasCard = false;
      if (invoice.defaultPaymentMethod) {
        const pm = invoice.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
        hasCard = true;
      }

      // Attempt payment if card is on file and not in test mode
      let paymentResult = { success: false, status: 'not-attempted' as 'charged' | 'attempted' | 'not-attempted' };

      if (hasCard) {
        paymentResult = await attemptInvoicePayment(stripe, invoice.invoiceId, testMode);

        if (paymentResult.status === 'charged') {
          chargedCount++;
          totalAmountCharged += invoice.amountDue;
        } else if (paymentResult.status === 'attempted') {
          attemptedCount++;
        }
      } else {
        notAttemptedCount++;
      }

      // Format dates
      const appointmentDate = patientInfo?.latestAppointmentDate
        ? new Date(patientInfo.latestAppointmentDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'No appt';

      const dueDateFormatted = invoice.dueDate
        ? invoice.dueDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : 'Unknown';

      const amountDue = invoice.amountDue / 100;
      totalAmountDue += invoice.amountDue;

      // Format payment status for display
      const paymentStatusDisplay =
        paymentResult.status === 'charged'
          ? '✅ Charged'
          : paymentResult.status === 'attempted'
          ? '❌ Failed'
          : testMode
          ? '🧪 Test'
          : '⏸️  No Card';

      // Print compact single line with payment status
      console.log(
        `[${i + 1}/${invoices.length}] ${fullName.padEnd(25)} | Appt: ${appointmentDate.padEnd(
          8
        )} | Due: ${dueDateFormatted.padEnd(8)} | $${amountDue.toFixed(2).padStart(8)} | ${status.padEnd(
          8
        )} | ${cardOnFile.padEnd(20)} | ${paymentStatusDisplay}`
      );

      successCount++;

      // Add to CSV report
      csvReportData.push({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${amountDue.toFixed(2)}`,
        dateDue: invoice.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile: cardOnFile,
        paymentStatus: paymentResult.status,
        status: status,
      });
    } catch (error) {
      console.log(`[${i + 1}/${invoices.length}] ❌ Failed to process invoice ${invoice.invoiceId}:`, error);
      failCount++;
      notAttemptedCount++;

      // Add error entry to CSV
      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoice.amountDue / 100).toFixed(2)}`,
        dateDue: invoice.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        paymentStatus: 'not-attempted',
        status: 'Processing Error',
      });
    }
  }

  // Generate CSV report
  generateCSVReport(csvReportData, csvFilename);

  // Final summary
  console.log('\n' + '='.repeat(140));
  console.log(`\n📊 Final Summary:`);
  console.log(`   Test Mode: ${testMode ? 'ON' : 'OFF'}`);
  console.log(`   Total invoices processed: ${invoices.length}`);
  console.log(`   ✅ Successfully processed: ${successCount}`);
  console.log(`   ❌ Failed: ${failCount}`);
  console.log(`\n💰 Invoice Status Breakdown:`);
  console.log(`   Due Today:       ${dueCount} invoices`);
  console.log(`   Past Due:        ${pastDueCount} invoices`);
  console.log(`   Total Amount:    $${(totalAmountDue / 100).toFixed(2)}`);
  console.log(`\n💳 Payment Results:`);
  console.log(`   ✅ Charged:         ${chargedCount} invoices ($${(totalAmountCharged / 100).toFixed(2)})`);
  console.log(`   ❌ Attempted (Failed): ${attemptedCount} invoices`);
  console.log(`   ⏸️  Not Attempted:  ${notAttemptedCount} invoices`);
  console.log(`\n📄 CSV report saved to: ${csvFilename}`);
}

main()
  .then(() => console.log('\n✅ Invoice report completed.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

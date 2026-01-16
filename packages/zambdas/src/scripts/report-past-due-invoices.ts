import Oystehr from '@oystehr/sdk';
import { Appointment, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
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

async function findOpenStripeInvoicesDueBeforeDate(stripe: Stripe, beforeDate: Date): Promise<StripeInvoice[]> {
  try {
    const beforeTimestamp = Math.floor(beforeDate.getTime() / 1000); // Convert to Unix timestamp
    console.log(`🔍 Searching for Stripe invoices due before: ${beforeDate.toISOString()}`);

    const allInvoices: StripeInvoice[] = [];
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const invoicesResponse = await stripe.invoices.list({
        limit: 100,
        due_date: {
          lt: beforeTimestamp, // Less than the provided date
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

    console.log(`✅ Found ${allInvoices.length} invoices due before ${beforeDate.toLocaleDateString()}`);
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

// Updated interface for CSV data - removed invoiceLink
interface CSVReportData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  amountDue: string;
  dateDue: string;
  appointmentDate: string;
  cardOnFile: string;
  agingBucket: string;
}

// Updated function to generate CSV report - removed invoice link column
function generateCSVReport(reportData: CSVReportData[], filename: string): void {
  try {
    console.log(`\n📊 Generating CSV report: ${filename}`);

    // CSV headers - removed Invoice Link
    const headers = [
      'First Name',
      'Last Name',
      'Date of Birth',
      'Amount Due',
      'Date Due',
      'Appointment Date',
      'Card on File',
      'Aging Bucket',
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
          `"${row.agingBucket}"`,
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

// Helper function to calculate days past due
function calculateDaysPastDue(dueDate: Date): number {
  const now = new Date();
  const diffMs = now.getTime() - dueDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// Helper function to determine aging bucket
function getAgingBucket(daysPastDue: number): string {
  if (daysPastDue <= 15) return '0-15 days';
  if (daysPastDue <= 30) return '16-30 days';
  if (daysPastDue <= 45) return '31-45 days';
  if (daysPastDue <= 60) return '46-60 days';
  if (daysPastDue <= 75) return '61-75 days';
  if (daysPastDue <= 90) return '76-90 days';
  if (daysPastDue <= 105) return '91-105 days';
  if (daysPastDue <= 120) return '106-120 days';
  return '120+ days';
}

// Helper function to generate default filename
function getDefaultFilename(env: string): string {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; // YYYY-MM-DD
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  return path.join(downloadsDir, `${env}-past-due-invoices-${dateString}.csv`);
}

// Updated main function with expanded aging buckets
async function main(): Promise<void> {
  const env = process.argv[2];
  const csvFilenameArg = process.argv[3]; // Optional CSV filename for report

  // Validate required arguments
  if (!env) {
    throw new Error('❌ Environment is required. Usage: npm run script report-past-due-invoices <env> [csvFilename]');
  }

  // Use provided filename or generate default
  const csvFilename = csvFilenameArg || getDefaultFilename(env);

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

  // Find all past due invoices (due before today)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const pastDueInvoices = await findOpenStripeInvoicesDueBeforeDate(stripe, today);

  if (pastDueInvoices.length === 0) {
    console.log(`❌ No past due invoices found.`);
    return;
  }

  // Separate invoices into expanded aging buckets
  const buckets = {
    '0-15': [] as StripeInvoice[],
    '16-30': [] as StripeInvoice[],
    '31-45': [] as StripeInvoice[],
    '46-60': [] as StripeInvoice[],
    '61-75': [] as StripeInvoice[],
    '76-90': [] as StripeInvoice[],
    '91-105': [] as StripeInvoice[],
    '106-120': [] as StripeInvoice[],
    '120+': [] as StripeInvoice[],
  };

  for (const invoice of pastDueInvoices) {
    if (!invoice.dueDate) continue;

    const daysPastDue = calculateDaysPastDue(invoice.dueDate);
    const bucket = getAgingBucket(daysPastDue);

    if (bucket === '0-15 days') buckets['0-15'].push(invoice);
    else if (bucket === '16-30 days') buckets['16-30'].push(invoice);
    else if (bucket === '31-45 days') buckets['31-45'].push(invoice);
    else if (bucket === '46-60 days') buckets['46-60'].push(invoice);
    else if (bucket === '61-75 days') buckets['61-75'].push(invoice);
    else if (bucket === '76-90 days') buckets['76-90'].push(invoice);
    else if (bucket === '91-105 days') buckets['91-105'].push(invoice);
    else if (bucket === '106-120 days') buckets['106-120'].push(invoice);
    else buckets['120+'].push(invoice);
  }

  // Calculate totals
  const totalAmountDue = pastDueInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);

  console.log(`\n💰 Past Due Invoice Summary:`);
  console.log(`   Total invoices: ${pastDueInvoices.length} ($${(totalAmountDue / 100).toFixed(2)})`);
  console.log(`\n📊 Aging Buckets:`);
  console.log(
    `   0-15 days:    ${buckets['0-15'].length.toString().padStart(4)} invoices ($${(
      buckets['0-15'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   16-30 days:   ${buckets['16-30'].length.toString().padStart(4)} invoices ($${(
      buckets['16-30'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   31-45 days:   ${buckets['31-45'].length.toString().padStart(4)} invoices ($${(
      buckets['31-45'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   46-60 days:   ${buckets['46-60'].length.toString().padStart(4)} invoices ($${(
      buckets['46-60'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   61-75 days:   ${buckets['61-75'].length.toString().padStart(4)} invoices ($${(
      buckets['61-75'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   76-90 days:   ${buckets['76-90'].length.toString().padStart(4)} invoices ($${(
      buckets['76-90'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   91-105 days:  ${buckets['91-105'].length.toString().padStart(4)} invoices ($${(
      buckets['91-105'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   106-120 days: ${buckets['106-120'].length.toString().padStart(4)} invoices ($${(
      buckets['106-120'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );
  console.log(
    `   120+ days:    ${buckets['120+'].length.toString().padStart(4)} invoices ($${(
      buckets['120+'].reduce((sum, inv) => sum + inv.amountDue, 0) / 100
    ).toFixed(2)})`
  );

  console.log(`\n📋 Processing ${pastDueInvoices.length} invoices...`);

  let successCount = 0;
  let failCount = 0;
  const csvReportData: CSVReportData[] = [];

  // Process all invoices
  for (let i = 0; i < pastDueInvoices.length; i++) {
    const invoiceInfo = pastDueInvoices[i];

    if (!invoiceInfo.oystehrPatientId) {
      failCount++;
      continue;
    }

    try {
      const patientId = invoiceInfo.oystehrPatientId;

      // Get patient info including latest appointment
      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        // Split full name into first and last name
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      // Format payment method info
      let cardOnFile = ' - ';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
      }

      // Calculate aging bucket
      const daysPastDue = invoiceInfo.dueDate ? calculateDaysPastDue(invoiceInfo.dueDate) : 0;
      const agingBucket = getAgingBucket(daysPastDue);

      successCount++;

      // Add data to CSV report
      csvReportData.push({
        firstName: firstName,
        lastName: lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile: cardOnFile,
        agingBucket: agingBucket,
      });
    } catch (error) {
      failCount++;

      // Still add to CSV report even if processing failed
      const daysPastDue = invoiceInfo.dueDate ? calculateDaysPastDue(invoiceInfo.dueDate) : 0;
      const agingBucket = getAgingBucket(daysPastDue);

      csvReportData.push({
        firstName: `Error ${
          typeof error === 'object' && error !== null && 'message' in error
            ? (error as { message: string }).message
            : String(error)
        }`,
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        agingBucket: agingBucket,
      });
    }
  }

  // Generate CSV report
  generateCSVReport(csvReportData, csvFilename);

  // Final Summary
  console.log(`\n📊 Final Summary:`);
  console.log(`   ✅ Successfully processed: ${successCount} patients`);
  console.log(`   ❌ Failed: ${failCount} patients`);
  console.log(`   💰 Total amount due: $${(totalAmountDue / 100).toFixed(2)}`);
  console.log(`📄 Total records in CSV: ${csvReportData.length}`);
  console.log(`📄 CSV report saved as: ${csvFilename}`);
}

main()
  .then(() => console.log('\n✅ Past due invoices report completed.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

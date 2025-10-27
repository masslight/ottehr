import Oystehr from '@oystehr/sdk';
import { Appointment, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import Stripe from 'stripe';
import { getAuth0Token, getRelatedPersonForPatient } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function sendSMSMessage(oystehr: Oystehr, patientId: string, message: string): Promise<void> {
  const relatedPerson = await getRelatedPersonForPatient(patientId || '', oystehr);
  let resource: string;
  if (relatedPerson) {
    resource = `RelatedPerson/${relatedPerson.id}`;
  } else {
    console.log(`❌ Failed to send SMS to ${patientId}: No RelatedPerson found`);
    return;
  }

  try {
    const response = await oystehr.transactionalSMS.send({
      resource: resource,
      message: message,
    });
    console.log(
      `✅ SMS details are in sent to ${patientId} (RelatedPerson/${relatedPerson.id}), response in `,
      response
    );
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${patientId}:`, error);
    throw error;
  }
}

async function sendPastDueInvoiceBySMS(
  oystehr: Oystehr,
  resourceId: string,
  balanceDue: number, // Changed to number (cents)
  invoiceLink: string
): Promise<void> {
  // Convert cents to dollars and format as currency
  const balanceInDollars = (balanceDue / 100).toFixed(2);

  const shortInvoiceLink = invoiceLink; //await shortenURL(invoiceLink);

  const invoiceMessage = `Thank you for visiting UrgiKids. You have a past due balance of $${balanceInDollars}.
💳 We were unable to process your card on file.  Please, pay your invoice:\n
${shortInvoiceLink}`;
  await sendSMSMessage(oystehr, resourceId, invoiceMessage);
  // console.log('💬 SMS Message:\n', invoiceMessage);
}

async function sendDelinquentPastDueInvoiceBySMS(
  oystehr: Oystehr,
  resourceId: string,
  invoiceLink: string
): Promise<void> {
  const shortInvoiceLink = invoiceLink; //await shortenURL(invoiceLink);
  const invoiceMessage = `Friendly reminder: your UrgiKids balance is still outstanding. Please submit payment using the link below to keep your account in good standing:\n
${shortInvoiceLink}`;
  await sendSMSMessage(oystehr, resourceId, invoiceMessage);
  // console.log('💬 SMS Message:\n', invoiceMessage);
}

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
    console.log(`🔍 Searching for Stripe invoices created before: ${beforeDate.toISOString()}`);

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
    console.log(`🔍 Fetching patient info for: ${patientId}`);

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
    console.log(`🔍 Fetching appointments for patient: ${patientId}`);

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

    const displayDate = latestAppointmentDate
      ? new Date(latestAppointmentDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'No appointments found';

    console.log(`✅ Found patient info for ${patientId}:`);
    console.log(`   Name: ${fullName}`);
    console.log(`   DOB: ${dateOfBirth}`);
    console.log(`   Latest appointment: ${displayDate}`);

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

// Add this interface for CSV data with collections column
interface CSVReportData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  amountDue: string;
  dateDue: string;
  appointmentDate: string;
  cardOnFile: string;
  invoiceLink: string;
  collectionsStatus: string; // New column
}

// Add this function to generate CSV report with collections column
function generateCSVReport(reportData: CSVReportData[], filename: string): void {
  try {
    console.log(`\n📊 Generating CSV report: ${filename}`);

    // CSV headers with swapped invoice link and collections status
    const headers = [
      'First Name',
      'Last Name',
      'Date of Birth',
      'Amount Due',
      'Date Due',
      'Appointment Date',
      'Card on File',
      'Collections Status', // Moved before Invoice Link
      'Invoice Link', // Moved after Collections Status
    ];

    // Convert data to CSV format with swapped columns
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
          `"${row.collectionsStatus}"`, // Moved before Invoice Link
          `"${row.invoiceLink}"`, // Moved after Collections Status
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

// Updated main function with collections logic
async function main(): Promise<void> {
  const env = process.argv[2];
  const newestPastDueDaysArg = process.argv[3]; // Number of days before today
  const collectablePastDueDaysArg = process.argv[4]; // Number of days for collections
  const csvFilename = process.argv[5]; // CSV filename for report

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <collectablePastDueDays> <csvFilename>'
    );
  }

  if (!newestPastDueDaysArg) {
    throw new Error(
      '❌ Newest past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <collectablePastDueDays> <csvFilename>'
    );
  }

  if (!collectablePastDueDaysArg) {
    throw new Error(
      '❌ Collectable past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <collectablePastDueDays> <csvFilename>'
    );
  }

  if (!csvFilename) {
    throw new Error(
      '❌ CSV filename is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <collectablePastDueDays> <csvFilename>'
    );
  }

  // Parse and validate the number of days
  const newestPastDueDays = parseInt(newestPastDueDaysArg);
  if (isNaN(newestPastDueDays) || newestPastDueDays < 0) {
    throw new Error('❌ Newest past due days must be a valid positive number (e.g., 7 for 7 days ago)');
  }

  const collectablePastDueDays = parseInt(collectablePastDueDaysArg);
  if (isNaN(collectablePastDueDays) || collectablePastDueDays < 0) {
    throw new Error('❌ Collectable past due days must be a valid positive number (e.g., 90 for 90 days ago)');
  }

  // Validate that collectable days is larger than newest days
  if (collectablePastDueDays <= newestPastDueDays) {
    throw new Error('❌ Collectable past due days must be larger than newest past due days');
  }

  // Calculate the date ranges
  const newestBeforeDate = new Date();
  newestBeforeDate.setDate(newestBeforeDate.getDate() - newestPastDueDays);

  const collectableBeforeDate = new Date();
  collectableBeforeDate.setDate(collectableBeforeDate.getDate() - collectablePastDueDays);

  console.log(`🗓️ Looking for invoices due between:`);
  console.log(
    `   ${collectableBeforeDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} (${collectablePastDueDays} days ago) - COLLECTIONS`
  );
  console.log(
    `   ${newestBeforeDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })} (${newestPastDueDays} days ago) - SMS REMINDERS`
  );

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

  // Find past due invoices before the newest date (this includes both SMS and collections)
  const pastDueInvoices = await findOpenStripeInvoicesDueBeforeDate(stripe, newestBeforeDate);

  if (pastDueInvoices.length === 0) {
    console.log(`❌ No past due invoices found due before ${newestPastDueDays} days ago.`);
    return;
  }

  // Separate invoices into SMS and Collections categories
  const smsInvoices = pastDueInvoices.filter((invoice) => invoice.dueDate && invoice.dueDate >= collectableBeforeDate);

  const collectionsInvoices = pastDueInvoices.filter(
    (invoice) => invoice.dueDate && invoice.dueDate < collectableBeforeDate
  );

  // Calculate totals
  const totalAmountDue = pastDueInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const smsAmountDue = smsInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const collectionsAmountDue = collectionsInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);

  console.log(`\n💰 Past Due Invoice Summary:`);
  console.log(`   Total invoices: ${pastDueInvoices.length} ($${(totalAmountDue / 100).toFixed(2)})`);
  console.log(`   📱 SMS reminders: ${smsInvoices.length} ($${(smsAmountDue / 100).toFixed(2)})`);
  console.log(`   🏢 Collections: ${collectionsInvoices.length} ($${(collectionsAmountDue / 100).toFixed(2)})`);

  // Extract patient IDs from SMS invoices only
  const smsPatientIds = smsInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  // Extract patient IDs from collections invoices
  const collectionsPatientIds = collectionsInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  console.log(`\n📱 Processing ${smsPatientIds.length} patients for SMS reminders...`);

  let successCount = 0;
  let failCount = 0;
  let totalAmountProcessed = 0;
  const csvReportData: CSVReportData[] = [];

  // Process SMS invoices
  for (let i = 0; i < smsPatientIds.length; i++) {
    const patientId = smsPatientIds[i];

    // Find the corresponding invoice for this patient
    const invoiceInfo = smsInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      console.log(`⚠️  No invoice found for patient ${patientId}`);
      failCount++;
      continue;
    }

    try {
      console.log(`\n[${i + 1}/${smsPatientIds.length}] Processing SMS for patient: ${patientId}`);

      // Calculate how many days past due this invoice is
      const daysPastDue = invoiceInfo.dueDate
        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';

      // Get patient info including latest appointment
      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        console.log(`👤 Patient: ${patientInfo.fullName} (DOB: ${patientInfo.dateOfBirth})`);
        console.log(`📅 Latest appointment: ${patientInfo.latestAppointmentDate || 'No appointments'}`);

        // Split full name into first and last name
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      console.log(
        `📄 Past due invoice - Amount: $${(invoiceInfo.amountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} (${daysPastDue} days past due)`
      );

      // Format payment method info
      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
        console.log(`💳 Payment method on file: ${cardOnFile} (${pm.expMonth}/${pm.expYear})`);
      } else {
        console.log(`‼️ No payment method on file`);
      }

      // Send SMS with the invoice information
      await sendPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.amountDue, invoiceInfo.invoiceLink);

      // Re-send invoice by email via Stripe to ensure they have the latest link
      await stripe.invoices.sendInvoice(invoiceInfo.invoiceId);
      console.log(
        `📧 Re-sent invoice with id ${invoiceInfo.invoiceId} email via Stripe to ${
          invoiceInfo.customerEmail || 'unknown email'
        }`
      );

      successCount++;
      totalAmountProcessed += invoiceInfo.amountDue;

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
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'SMS Sent', // Mark as SMS sent
      });

      // Add delay between SMS sends to avoid rate limiting
      if (i < smsPatientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds before next SMS...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process patient ${patientId}:`, error);
      failCount++;

      // Still add to CSV report even if SMS failed
      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'SMS Failed', // Mark as SMS failed
      });
    }
  }

  // Process Collections invoices (send delinquent SMS and report)
  console.log(`\n🏢 Processing ${collectionsPatientIds.length} patients for collections referral...`);

  for (let i = 0; i < collectionsPatientIds.length; i++) {
    const patientId = collectionsPatientIds[i];

    // Find the corresponding invoice for this patient
    const invoiceInfo = collectionsInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      console.log(`⚠️  No collections invoice found for patient ${patientId}`);
      continue;
    }

    try {
      console.log(`\n[${i + 1}/${collectionsPatientIds.length}] 🏢 Refer to collections - Patient: ${patientId}`);

      // Calculate how many days past due this invoice is
      const daysPastDue = invoiceInfo.dueDate
        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';

      // Get patient info including latest appointment
      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        console.log(`👤 Patient: ${patientInfo.fullName} (DOB: ${patientInfo.dateOfBirth})`);

        // Split full name into first and last name
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      console.log(
        `📄 Collections invoice - Amount: $${(invoiceInfo.amountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} (${daysPastDue} days past due)`
      );

      // Format payment method info
      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
      }

      // Send delinquent SMS reminder
      await sendDelinquentPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.invoiceLink);

      // Re-send invoice by email via Stripe to ensure they have the latest link
      await stripe.invoices.sendInvoice(invoiceInfo.invoiceId);
      console.log(
        `📧 Re-sent very late invoice with id ${invoiceInfo.invoiceId} email via Stripe to ${
          invoiceInfo.customerEmail || 'unknown email'
        }`
      );

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
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Delinquent SMS Sent', // Mark as delinquent SMS sent
      });

      // Add delay between SMS sends to avoid rate limiting
      if (i < collectionsPatientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds before next SMS...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process collections patient ${patientId}:`, error);

      // Still add to CSV report even if processing failed
      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Delinquent SMS Failed', // Mark as SMS failed
      });
    }
  }

  // Generate CSV report
  generateCSVReport(csvReportData, csvFilename);

  // Final Summary
  console.log(`\n📊 Final Summary:`);
  console.log(`📱 SMS Processing:`);
  console.log(`   ✅ Successfully sent: ${successCount} SMS messages`);
  console.log(`   ❌ Failed: ${failCount} patients`);
  console.log(`   💰 Amount in SMS notifications: $${(totalAmountProcessed / 100).toFixed(2)}`);
  console.log(`🏢 Collections Processing:`);
  console.log(`   📋 Referred to collections: ${collectionsPatientIds.length} patients`);
  console.log(`   💰 Amount for collections: $${(collectionsAmountDue / 100).toFixed(2)}`);
  console.log(`📄 Total records in CSV: ${csvReportData.length}`);
  console.log(`📄 CSV report saved as: ${csvFilename}`);
  console.log(`🗓️ Date ranges:`);
  console.log(`   SMS: ${newestPastDueDays}-${collectablePastDueDays} days past due`);
  console.log(`   Collections: More than ${collectablePastDueDays} days past due`);
}

main()
  .then(() => console.log('\n✅ All invoices sent to patients by SMS.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

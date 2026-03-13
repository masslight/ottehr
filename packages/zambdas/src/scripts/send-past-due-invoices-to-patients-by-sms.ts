import Oystehr from '@oystehr/sdk';
import { Appointment, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import Stripe from 'stripe';
import { getRelatedPersonForPatient } from 'utils';
import { getAuth0Token } from '../shared';
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

async function sendCollectionsPastDueInvoiceBySMS(
  oystehr: Oystehr,
  resourceId: string,
  invoiceLink: string
): Promise<void> {
  const shortInvoiceLink = invoiceLink; //await shortenURL(invoiceLink);
  const invoiceMessage = `Your UrgiKids balance is now over 60 days past due. Please submit payment using the link below to avoid the balance being sent to collections:\n
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

// Updated main function with 4-tier collections logic
async function main(): Promise<void> {
  const env = process.argv[2];
  const newestPastDueDaysArg = process.argv[3]; // Number of days before today - SMS tier
  const delinquentPastDueDaysArg = process.argv[4]; // Number of days for delinquent - Delinquent SMS tier
  const collectionsWarningDaysArg = process.argv[5]; // Number of days for collections warning - Collections SMS tier
  const writtenOffDaysArg = process.argv[6]; // Number of days for written off - No SMS, just report
  const csvFilename = process.argv[7]; // CSV filename for report

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  if (!newestPastDueDaysArg) {
    throw new Error(
      '❌ Newest past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  if (!delinquentPastDueDaysArg) {
    throw new Error(
      '❌ Delinquent past due days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  if (!collectionsWarningDaysArg) {
    throw new Error(
      '❌ Collections warning days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  if (!writtenOffDaysArg) {
    throw new Error(
      '❌ Written off days is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  if (!csvFilename) {
    throw new Error(
      '❌ CSV filename is required. Usage: npm run script send-past-due-invoices-to-patients-by-sms <env> <newestPastDueDays> <delinquentPastDueDays> <collectionsWarningDays> <writtenOffDays> <csvFilename>'
    );
  }

  // Parse and validate the number of days
  const newestPastDueDays = parseInt(newestPastDueDaysArg);
  if (isNaN(newestPastDueDays) || newestPastDueDays < 0) {
    throw new Error('❌ Newest past due days must be a valid positive number (e.g., 7 for 7 days ago)');
  }

  const delinquentPastDueDays = parseInt(delinquentPastDueDaysArg);
  if (isNaN(delinquentPastDueDays) || delinquentPastDueDays < 0) {
    throw new Error('❌ Delinquent past due days must be a valid positive number (e.g., 30 for 30 days ago)');
  }

  const collectionsWarningDays = parseInt(collectionsWarningDaysArg);
  if (isNaN(collectionsWarningDays) || collectionsWarningDays < 0) {
    throw new Error('❌ Collections warning days must be a valid positive number (e.g., 60 for 60 days ago)');
  }

  const writtenOffDays = parseInt(writtenOffDaysArg);
  if (isNaN(writtenOffDays) || writtenOffDays < 0) {
    throw new Error('❌ Written off days must be a valid positive number (e.g., 90 for 90 days ago)');
  }

  // Validate that days are in ascending order
  if (delinquentPastDueDays <= newestPastDueDays) {
    throw new Error('❌ Delinquent past due days must be larger than newest past due days');
  }

  if (collectionsWarningDays <= delinquentPastDueDays) {
    throw new Error('❌ Collections warning days must be larger than delinquent past due days');
  }

  if (writtenOffDays <= collectionsWarningDays) {
    throw new Error('❌ Written off days must be larger than collections warning days');
  }

  // Calculate the date ranges
  const newestBeforeDate = new Date();
  newestBeforeDate.setDate(newestBeforeDate.getDate() - newestPastDueDays);

  const delinquentBeforeDate = new Date();
  delinquentBeforeDate.setDate(delinquentBeforeDate.getDate() - delinquentPastDueDays);

  const collectionsWarningBeforeDate = new Date();
  collectionsWarningBeforeDate.setDate(collectionsWarningBeforeDate.getDate() - collectionsWarningDays);

  const writtenOffBeforeDate = new Date();
  writtenOffBeforeDate.setDate(writtenOffBeforeDate.getDate() - writtenOffDays);

  console.log(`🗓️ Invoice age tiers:`);
  console.log(`   1️⃣  ${newestPastDueDays}-${delinquentPastDueDays} days past due → SMS reminder`);
  console.log(`   2️⃣  ${delinquentPastDueDays}-${collectionsWarningDays} days past due → Delinquent SMS`);
  console.log(`   3️⃣  ${collectionsWarningDays}-${writtenOffDays} days past due → Collections warning SMS`);
  console.log(`   4️⃣  ${writtenOffDays}+ days past due → Written off (report only)`);

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

  // Find all past due invoices before the newest date
  const allPastDueInvoices = await findOpenStripeInvoicesDueBeforeDate(stripe, newestBeforeDate);

  if (allPastDueInvoices.length === 0) {
    console.log(`❌ No past due invoices found due before ${newestPastDueDays} days ago.`);
    return;
  }

  // Separate invoices into 4 tiers
  const smsInvoices = allPastDueInvoices.filter(
    (invoice) => invoice.dueDate && invoice.dueDate >= delinquentBeforeDate
  );

  const delinquentInvoices = allPastDueInvoices.filter(
    (invoice) =>
      invoice.dueDate && invoice.dueDate < delinquentBeforeDate && invoice.dueDate >= collectionsWarningBeforeDate
  );

  const collectionsWarningInvoices = allPastDueInvoices.filter(
    (invoice) =>
      invoice.dueDate && invoice.dueDate < collectionsWarningBeforeDate && invoice.dueDate >= writtenOffBeforeDate
  );

  const writtenOffInvoices = allPastDueInvoices.filter(
    (invoice) => invoice.dueDate && invoice.dueDate < writtenOffBeforeDate
  );

  // Calculate totals
  const totalAmountDue = allPastDueInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const smsAmountDue = smsInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const delinquentAmountDue = delinquentInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const collectionsWarningAmountDue = collectionsWarningInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);
  const writtenOffAmountDue = writtenOffInvoices.reduce((sum, invoice) => sum + invoice.amountDue, 0);

  console.log(`\n💰 Past Due Invoice Summary:`);
  console.log(`   Total invoices: ${allPastDueInvoices.length} ($${(totalAmountDue / 100).toFixed(2)})`);
  console.log(`   1️⃣  SMS reminders: ${smsInvoices.length} ($${(smsAmountDue / 100).toFixed(2)})`);
  console.log(`   2️⃣  Delinquent: ${delinquentInvoices.length} ($${(delinquentAmountDue / 100).toFixed(2)})`);
  console.log(
    `   3️⃣  Collections warning: ${collectionsWarningInvoices.length} ($${(collectionsWarningAmountDue / 100).toFixed(
      2
    )})`
  );
  console.log(`   4️⃣  Written off: ${writtenOffInvoices.length} ($${(writtenOffAmountDue / 100).toFixed(2)})`);

  const csvReportData: CSVReportData[] = [];

  // Process Tier 1: SMS Reminders
  const smsPatientIds = smsInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  console.log(`\n1️⃣  Processing ${smsPatientIds.length} patients for SMS reminders...`);

  let smsSentCount = 0;
  let smsFailCount = 0;

  for (let i = 0; i < smsPatientIds.length; i++) {
    const patientId = smsPatientIds[i];
    const invoiceInfo = smsInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      console.log(`⚠️  No invoice found for patient ${patientId}`);
      smsFailCount++;
      continue;
    }

    try {
      console.log(`\n[${i + 1}/${smsPatientIds.length}] Processing SMS for patient: ${patientId}`);

      const daysPastDue = invoiceInfo.dueDate
        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';

      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        console.log(`👤 Patient: ${patientInfo.fullName} (DOB: ${patientInfo.dateOfBirth})`);
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      console.log(
        `📄 Invoice - Amount: $${(invoiceInfo.amountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} (${daysPastDue} days past due)`
      );

      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
        console.log(`💳 Payment method on file: ${cardOnFile} (${pm.expMonth}/${pm.expYear})`);
      }

      await sendPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.amountDue, invoiceInfo.invoiceLink);
      await stripe.invoices.sendInvoice(invoiceInfo.invoiceId);
      console.log(`📧 Re-sent invoice email via Stripe`);

      smsSentCount++;

      csvReportData.push({
        firstName,
        lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile,
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'SMS Sent',
      });

      if (i < smsPatientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process patient ${patientId}:`, error);
      smsFailCount++;

      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'SMS Failed',
      });
    }
  }

  // Process Tier 2: Delinquent SMS
  const delinquentPatientIds = delinquentInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  console.log(`\n2️⃣  Processing ${delinquentPatientIds.length} patients for delinquent SMS...`);

  let delinquentSentCount = 0;
  let delinquentFailCount = 0;

  for (let i = 0; i < delinquentPatientIds.length; i++) {
    const patientId = delinquentPatientIds[i];
    const invoiceInfo = delinquentInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      console.log(`⚠️  No invoice found for patient ${patientId}`);
      delinquentFailCount++;
      continue;
    }

    try {
      console.log(`\n[${i + 1}/${delinquentPatientIds.length}] Processing delinquent SMS for patient: ${patientId}`);

      const daysPastDue = invoiceInfo.dueDate
        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';

      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        console.log(`👤 Patient: ${patientInfo.fullName} (DOB: ${patientInfo.dateOfBirth})`);
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      console.log(
        `📄 Delinquent invoice - Amount: $${(invoiceInfo.amountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} (${daysPastDue} days past due)`
      );

      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
      }

      await sendDelinquentPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.invoiceLink);
      await stripe.invoices.sendInvoice(invoiceInfo.invoiceId);
      console.log(`📧 Re-sent invoice email via Stripe`);

      delinquentSentCount++;

      csvReportData.push({
        firstName,
        lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile,
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Delinquent SMS Sent',
      });

      if (i < delinquentPatientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process delinquent patient ${patientId}:`, error);
      delinquentFailCount++;

      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Delinquent SMS Failed',
      });
    }
  }

  // Process Tier 3: Collections Warning SMS
  const collectionsWarningPatientIds = collectionsWarningInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  console.log(`\n3️⃣  Processing ${collectionsWarningPatientIds.length} patients for collections warning SMS...`);

  let collectionsSentCount = 0;
  let collectionsFailCount = 0;

  for (let i = 0; i < collectionsWarningPatientIds.length; i++) {
    const patientId = collectionsWarningPatientIds[i];
    const invoiceInfo = collectionsWarningInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      console.log(`⚠️  No invoice found for patient ${patientId}`);
      collectionsFailCount++;
      continue;
    }

    try {
      console.log(
        `\n[${i + 1}/${
          collectionsWarningPatientIds.length
        }] Processing collections warning SMS for patient: ${patientId}`
      );

      const daysPastDue = invoiceInfo.dueDate
        ? Math.floor((new Date().getTime() - invoiceInfo.dueDate.getTime()) / (1000 * 60 * 60 * 24))
        : 'Unknown';

      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        console.log(`👤 Patient: ${patientInfo.fullName} (DOB: ${patientInfo.dateOfBirth})`);
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      console.log(
        `📄 Collections warning invoice - Amount: $${(invoiceInfo.amountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate?.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        })} (${daysPastDue} days past due)`
      );

      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
      }

      await sendCollectionsPastDueInvoiceBySMS(oystehr, patientId, invoiceInfo.invoiceLink);
      await stripe.invoices.sendInvoice(invoiceInfo.invoiceId);
      console.log(`📧 Re-sent invoice email via Stripe`);

      collectionsSentCount++;

      csvReportData.push({
        firstName,
        lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile,
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Collections Warning SMS Sent',
      });

      if (i < collectionsWarningPatientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process collections warning patient ${patientId}:`, error);
      collectionsFailCount++;

      csvReportData.push({
        firstName: 'Error',
        lastName: 'Error',
        dateOfBirth: 'Error',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: 'Error',
        cardOnFile: 'Error',
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Collections Warning SMS Failed',
      });
    }
  }

  // Process Tier 4: Written Off (Report Only - No SMS)
  const writtenOffPatientIds = writtenOffInvoices
    .filter((invoice) => invoice.oystehrPatientId)
    .map((invoice) => invoice.oystehrPatientId!);

  console.log(`\n4️⃣  Processing ${writtenOffPatientIds.length} written off invoices (report only)...`);

  for (let i = 0; i < writtenOffPatientIds.length; i++) {
    const patientId = writtenOffPatientIds[i];
    const invoiceInfo = writtenOffInvoices.find((inv) => inv.oystehrPatientId === patientId);

    if (!invoiceInfo) {
      continue;
    }

    try {
      const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, patientId);

      let firstName = 'Unknown';
      let lastName = 'Unknown';

      if (patientInfo) {
        const nameParts = patientInfo.fullName.split(' ');
        firstName = nameParts[0] || 'Unknown';
        lastName = nameParts.slice(1).join(' ') || 'Unknown';
      }

      let cardOnFile = 'No card on file';
      if (invoiceInfo.defaultPaymentMethod) {
        const pm = invoiceInfo.defaultPaymentMethod;
        cardOnFile = `${pm.brand?.toUpperCase()} ****${pm.last4}`;
      }

      csvReportData.push({
        firstName,
        lastName,
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        amountDue: `$${(invoiceInfo.amountDue / 100).toFixed(2)}`,
        dateDue: invoiceInfo.dueDate?.toISOString().split('T')[0] || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        cardOnFile,
        invoiceLink: invoiceInfo.invoiceLink,
        collectionsStatus: 'Written Off',
      });
    } catch (error) {
      console.error(`❌ Failed to process written off patient ${patientId}:`, error);
    }
  }

  // Generate CSV report
  generateCSVReport(csvReportData, csvFilename);

  // Final Summary
  console.log(`\n📊 Final Summary:`);
  console.log(`1️⃣  SMS Reminders:`);
  console.log(`   ✅ Sent: ${smsSentCount}`);
  console.log(`   ❌ Failed: ${smsFailCount}`);
  console.log(`   💰 Amount: $${(smsAmountDue / 100).toFixed(2)}`);
  console.log(`2️⃣  Delinquent SMS:`);
  console.log(`   ✅ Sent: ${delinquentSentCount}`);
  console.log(`   ❌ Failed: ${delinquentFailCount}`);
  console.log(`   💰 Amount: $${(delinquentAmountDue / 100).toFixed(2)}`);
  console.log(`3️⃣  Collections Warning SMS:`);
  console.log(`   ✅ Sent: ${collectionsSentCount}`);
  console.log(`   ❌ Failed: ${collectionsFailCount}`);
  console.log(`   💰 Amount: $${(collectionsWarningAmountDue / 100).toFixed(2)}`);
  console.log(`4️⃣  Written Off (Report Only):`);
  console.log(`   📋 Count: ${writtenOffPatientIds.length}`);
  console.log(`   💰 Amount: $${(writtenOffAmountDue / 100).toFixed(2)}`);
  console.log(`\n📄 Total records in CSV: ${csvReportData.length}`);
  console.log(`📄 CSV report saved as: ${csvFilename}`);
}

main()
  .then(() => console.log('\n✅ All invoices processed.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

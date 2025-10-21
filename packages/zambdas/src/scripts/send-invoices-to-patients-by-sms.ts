import Oystehr from '@oystehr/sdk';
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
    console.log(`✅ SMS details are in `, response);
  } catch (error) {
    console.error(`❌ Failed to send SMS to ${patientId}:`, error);
    throw error;
  }
}

async function sendInvoiceBySMS(
  oystehr: Oystehr,
  resourceId: string,
  serviceDate: Date,
  balanceDue: number, // Changed to number (cents)
  dueDate: Date,
  invoiceLink: string
): Promise<void> {
  // Format dates as "Sep 5, 2025"
  // const formattedServiceDate = serviceDate.toLocaleDateString('en-US', {
  //   month: 'short',
  //   day: 'numeric'
  // });

  const formattedDueDate = dueDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  // Convert cents to dollars and format as currency
  const balanceInDollars = (balanceDue / 100).toFixed(2);

  const shortInvoiceLink = invoiceLink; //await shortenURL(invoiceLink);

  //   const invoiceMessage = `Thank you for visiting UrgiKids on ${formattedServiceDate}. You have a balance of $${balanceInDollars}.\n
  //  💳 If we have your card on file, it will be billed on ${formattedDueDate}.\n
  // To use a different payment method, please pay the invoice before due date: \n
  // ${shortInvoiceLink}`;

  const invoiceMessage = `Thank you for visiting UrgiKids. You have a balance of $${balanceInDollars}.\n
 💳 If we have your card on file, it will be billed on ${formattedDueDate}.\n
To use a different payment method, please pay the invoice before due date: \n
${shortInvoiceLink}`;
  await sendSMSMessage(oystehr, resourceId, invoiceMessage);
}

interface InvoiceInfo {
  generationDate: Date;
  dueDate: Date;
  invoiceLink: string;
  totalAmountDue: number; // in cents
}

async function findStripeInvoiceByPatientId(stripe: Stripe, oystehrPatientId: string): Promise<InvoiceInfo | null> {
  try {
    console.log(`🔍 Searching for Stripe customer with oystehr_patient_id: ${oystehrPatientId}`);

    // Find customer by metadata
    const customers = await stripe.customers.search({
      limit: 100,
      query: `metadata['oystehr_patient_id']:'${oystehrPatientId}'`,
    });

    const customer = customers.data[0];

    if (!customer) {
      console.log(`❌ No Stripe customer found with oystehr_patient_id: ${oystehrPatientId}`);
      return null;
    }

    console.log(`✅ Found Stripe customer: ${customer.id}`);

    // Get customer's invoices, sorted by creation date (most recent first)
    const invoices = await stripe.invoices.list({
      customer: customer.id,
      limit: 1, // Only get the most recent invoice
      status: 'open', // Only get unpaid invoices
    });

    if (invoices.data.length === 0) {
      console.log(`❌ No open invoices found for customer: ${customer.id}`);
      return null;
    }

    const mostRecentInvoice = invoices.data[0];
    console.log(`✅ Found most recent invoice: ${mostRecentInvoice.id}`);

    // Extract invoice information
    const generationDate = new Date(mostRecentInvoice.created * 1000); // Stripe timestamps are in seconds
    const dueDate = mostRecentInvoice.due_date
      ? new Date(mostRecentInvoice.due_date * 1000)
      : new Date(mostRecentInvoice.created * 1000 + 30 * 24 * 60 * 60 * 1000); // Default to 30 days from creation

    const invoiceLink = mostRecentInvoice.hosted_invoice_url || mostRecentInvoice.invoice_pdf || '';
    const totalAmountDue = mostRecentInvoice.amount_due; // Already in cents

    return {
      generationDate,
      dueDate,
      invoiceLink,
      totalAmountDue,
    };
  } catch (error) {
    console.error(`❌ Error finding Stripe invoice for patient ${oystehrPatientId}:`, error);
    throw error;
  }
}

async function readPatientIdsFromCSV(csvFilePath: string): Promise<string[]> {
  try {
    console.log(`📄 Reading patient IDs from CSV file: ${csvFilePath}`);

    // Read the CSV file
    const csvContent = fs.readFileSync(csvFilePath, 'utf8');

    // Split by lines and filter out empty lines
    const lines = csvContent.split('\n').filter((line) => line.trim() !== '');

    // Skip header row if it exists (check if first line looks like a header)
    const startIndex =
      lines[0] && (lines[0].toLowerCase().includes('patient') || lines[0].toLowerCase().includes('id')) ? 1 : 0;

    // Extract patient IDs (trim whitespace)
    const patientIds = lines.slice(startIndex).map((line) => line.trim());

    console.log(`✅ Found ${patientIds.length} patient IDs in CSV file`);

    // Log first few IDs as preview
    if (patientIds.length > 0) {
      const preview = patientIds.slice(0, 3);
      console.log(`   Preview: ${preview.join(', ')}${patientIds.length > 3 ? '...' : ''}`);
    }

    return patientIds;
  } catch (error) {
    console.error(`❌ Error reading CSV file ${csvFilePath}:`, error);
    throw error;
  }
}

// Updated main function to process multiple patients from CSV
async function main(): Promise<void> {
  const env = process.argv[2];
  const csvFilePath = process.argv[3]; // Path to CSV file

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run script send-invoices-to-patients-by-sms <env> <csvFilePath>'
    );
  }

  if (!csvFilePath) {
    throw new Error(
      '❌ CSV file path is required. Usage: npm run script send-invoices-to-patients-by-sms <env> <csvFilePath>'
    );
  }

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

  // Read patient IDs from CSV file
  const patientIds = await readPatientIdsFromCSV(csvFilePath);

  if (patientIds.length === 0) {
    console.log('❌ No patient IDs found to process.');
    return;
  }

  console.log(`\n📱 Processing ${patientIds.length} patients for invoice SMS...`);

  let successCount = 0;
  let failCount = 0;

  // Loop through all patient IDs
  for (let i = 0; i < patientIds.length; i++) {
    const patientId = patientIds[i];

    try {
      console.log(`\n[${i + 1}/${patientIds.length}] Processing patient: ${patientId}`);

      // Find Stripe invoice by patient ID
      const invoiceInfo = await findStripeInvoiceByPatientId(stripe, patientId);

      if (!invoiceInfo) {
        console.log(`⚠️  No invoice found for patient ${patientId}`);
        failCount++;
        continue;
      }

      console.log(
        `📄 Invoice found - Amount: $${(invoiceInfo.totalAmountDue / 100).toFixed(
          2
        )}, Due: ${invoiceInfo.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      );

      // Send SMS with the invoice information
      await sendInvoiceBySMS(
        oystehr,
        patientId,
        invoiceInfo.generationDate, // TODO: Need to get the source of the visit date from FHIR or candid
        invoiceInfo.totalAmountDue,
        invoiceInfo.dueDate,
        invoiceInfo.invoiceLink
      );

      successCount++;

      // Add delay between SMS sends to avoid rate limiting
      if (i < patientIds.length - 1) {
        console.log('⏳ Waiting 2 seconds before next SMS...');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`❌ Failed to process patient ${patientId}:`, error);
      failCount++;
    }
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully sent: ${successCount} SMS messages`);
  console.log(`❌ Failed: ${failCount} patients`);
  console.log(`📱 Total processed: ${patientIds.length} patients`);
}

main()
  .then(() => console.log('\n✅ All invoices sent to patients by SMS.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

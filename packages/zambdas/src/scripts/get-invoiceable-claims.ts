import Oystehr from '@oystehr/sdk';
import { CandidApi, CandidApiClient } from 'candidhealth';
import { Appointment, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import { createCandidApiClient } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

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

interface InvoiceableClaim {
  claimId: string;
  encounterId: string;
  patientExternalId: string;
  patientArStatus: string;
  timestamp: string;
}

interface InvoiceableClaimsResponse {
  claims: InvoiceableClaim[];
  nextPageToken?: string;
  totalClaims: number;
  uniquePatients: number;
  statusCounts: Record<string, number>;
}

interface ItemizedInvoice {
  claimId: string;
  patientBalanceCents: number;
  claimLevelPatientPayments: {
    totalPaymentCents: number;
    items: any[]; // Could be more specific if you have examples of payment items
  };
  serviceLineItemization: Array<{
    serviceLineId: string;
    procedureCode: string;
    dateOfService: string;
    patientBalanceCents: number;
    chargeAmountCents: number;
    insuranceAdjustments: {
      totalAdjustmentCents: number;
    };
    insurancePayments: {
      totalPaymentCents: number;
    };
    nonInsuranceAdjustments: {
      totalAdjustmentCents: number;
    };
    nonInsurancePayments: {
      totalPaymentCents: number;
    };
    patientAdjustments: {
      totalAdjustmentCents: number;
    };
    patientPayments: {
      totalPaymentCents: number;
      items: any[]; // Could be more specific if you have examples of payment items
    };
    copayCents: number;
    coinsuranceCents: number;
    deductibleCents: number;
  }>;
}

async function getInvoiceDetails(candid: CandidApiClient, claimId: string): Promise<ItemizedInvoice | null> {
  try {
    console.log(`🔍 Fetching invoice details for claim: ${claimId}`);

    const invoiceResponse = await candid.patientAr.v1.itemize(CandidApi.ClaimId(claimId));

    // console.log(`\n📄 Invoice Details for Claim ${claimId}:`);
    // console.log('==========================================');
    // console.log('Full JSON Response:');
    // console.log(JSON.stringify(invoiceResponse, null, 2));
    // console.log('==========================================\n');

    // Check if response is ok and body exists
    if (invoiceResponse && invoiceResponse.ok && invoiceResponse.body) {
      return invoiceResponse.body as ItemizedInvoice;
    } else {
      console.log(`⚠️ Invalid response for claim ${claimId}:`, {
        ok: invoiceResponse?.ok,
        hasBody: !!(invoiceResponse as any)?.body,
      });
      return null;
    }
  } catch (error) {
    console.error(`❌ Error fetching invoice details for claim ${claimId}:`, error);
    return null;
  }
}

async function getInvoiceableClaims(
  candid: CandidApiClient,
  limit: number = 100,
  pageToken?: string
): Promise<InvoiceableClaimsResponse | null> {
  try {
    console.log('🔍 Fetching patient inventory from Candid...');

    let allRecords: any[] = [];
    let currentPageToken = pageToken;
    let pageCount = 0;
    let totalFetched = 0;

    // If pageToken is provided, only fetch that specific page
    // Otherwise, iterate through all pages
    do {
      pageCount++;
      console.log(
        `📄 Fetching page ${pageCount}${currentPageToken ? ` (token: ${currentPageToken.substring(0, 20)}...)` : ''}...`
      );

      const inventoryResponse = await candid.patientAr.v1.listInventory({
        limit: limit,
        pageToken: currentPageToken ? CandidApi.PageToken(currentPageToken) : undefined,
      });

      // Handle the actual response structure: { ok: boolean, body: { records: [], nextPageToken?: string } }
      if (inventoryResponse && inventoryResponse.ok && inventoryResponse.body) {
        const { records, nextPageToken } = inventoryResponse.body;

        // Filter for only invoiceable status claims
        const invoiceableRecords = records.filter((record) => record.patientArStatus === 'invoiceable');

        console.log(
          `   📄 Page ${pageCount}: Found ${records.length} total claims, ${invoiceableRecords.length} invoiceable`
        );

        // Add filtered records to our collection
        allRecords = allRecords.concat(invoiceableRecords);
        totalFetched += invoiceableRecords.length;

        // Update page token for next iteration
        currentPageToken = nextPageToken;

        // If a specific pageToken was provided, only fetch that one page
        if (pageToken) {
          break;
        }

        // If no more pages, break the loop
        if (!nextPageToken) {
          console.log(`   🏁 Reached end of pages`);
          break;
        }
      } else {
        console.log('⚠️ Unexpected response format or failed request on page', pageCount);
        console.log('Response details:', {
          ok: inventoryResponse?.ok,
          hasBody: inventoryResponse?.ok ? !!(inventoryResponse as any).body : false,
          responseType: typeof inventoryResponse,
        });
        break;
      }
    } while (currentPageToken && !pageToken); // Continue if there's a next page and no specific pageToken was requested

    console.log('\n📊 Patient Inventory Response:');
    console.log('===============================');
    console.log(`📄 Total pages fetched: ${pageCount}`);
    console.log(`📄 Total invoiceable claims found: ${totalFetched}`);

    if (allRecords.length > 0) {
      console.log(`📄 Response Status: ✅ Success`);

      if (currentPageToken) {
        console.log(`📄 Next Page Token: ${currentPageToken}`);
        console.log(`📄 More records available: Yes`);
      } else {
        console.log(`📄 More records available: No`);
      }

      // Calculate summary statistics (should all be 'invoiceable' now)
      const uniquePatients = new Set(allRecords.map((r) => r.patientExternalId));
      const statusCounts = allRecords.reduce(
        (acc, record) => {
          acc[record.patientArStatus] = (acc[record.patientArStatus] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      // Summary
      console.log(`\n📊 Summary:`);
      console.log(`   Total invoiceable claims: ${allRecords.length}`);
      console.log(`   Unique patients: ${uniquePatients.size}`);
      console.log(`   Status breakdown:`);
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`     ${status}: ${count}`);
      });

      return {
        claims: allRecords.map((record) => ({
          claimId: record.claimId,
          encounterId: record.encounterId,
          patientExternalId: record.patientExternalId,
          patientArStatus: record.patientArStatus,
          timestamp: record.timestamp instanceof Date ? record.timestamp.toISOString() : String(record.timestamp),
        })),
        nextPageToken: currentPageToken,
        totalClaims: allRecords.length,
        uniquePatients: uniquePatients.size,
        statusCounts: statusCounts,
      };
    } else {
      console.log('📄 No invoiceable claims found');
      return {
        claims: [],
        nextPageToken: undefined,
        totalClaims: 0,
        uniquePatients: 0,
        statusCounts: {},
      };
    }
  } catch (error) {
    console.error('❌ Error fetching invoiceable claims:', error);

    // Print more detailed error information
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    throw error;
  }
}

// Add CSV interface
interface CSVReportData {
  invoiceDate: string; // New first column
  claimId: string;
  patientId: string;
  fullName: string;
  dateOfBirth: string;
  appointmentDate: string;
  patientBalance: string;
  serviceDate: string;
  procedureCode: string;
  chargeAmount: string;
  insurancePayment: string;
  copay: string;
  deductible: string;
  insuranceAdjustments: string;
}

// Add CSV generation function
function generateCSVReport(reportData: CSVReportData[], filename: string): void {
  try {
    console.log(`\n📊 Generating CSV report: ${filename}`);

    // CSV headers with invoice date as first column
    const headers = [
      'Invoice Date', // New first column
      'Claim ID',
      'Patient ID',
      'Full Name',
      'Date of Birth',
      'Appointment Date',
      'Patient Balance',
      'Service Date',
      'Procedure Code',
      'Charge Amount',
      'Insurance Payment',
      'Copay',
      'Deductible',
      'Insurance Adjustments',
    ];

    // Convert data to CSV format with invoice date as first column
    const csvRows = [
      headers.join(','), // Header row
      ...reportData.map((row) =>
        [
          `"${row.invoiceDate}"`, // New first column
          `"${row.claimId}"`,
          `"${row.patientId}"`,
          `"${row.fullName}"`,
          `"${row.dateOfBirth}"`,
          `"${row.appointmentDate}"`,
          `"${row.patientBalance}"`,
          `"${row.serviceDate}"`,
          `"${row.procedureCode}"`,
          `"${row.chargeAmount}"`,
          `"${row.insurancePayment}"`,
          `"${row.copay}"`,
          `"${row.deductible}"`,
          `"${row.insuranceAdjustments}"`,
        ].join(',')
      ),
    ];

    // Write CSV file
    const csvContent = csvRows.join('\n');
    fs.writeFileSync(filename, csvContent, 'utf8');

    console.log(`✅ CSV report generated successfully: ${filename}`);
    console.log(`📄 Report contains ${reportData.length} claim records`);
  } catch (error) {
    console.error(`❌ Error generating CSV report:`, error);
    throw error;
  }
}

// Updated main function using the new function
async function main(): Promise<void> {
  const env = process.argv[2];
  const csvFilename = process.argv[3] || 'invoiceable-claims-report.csv';

  // Validate required arguments
  if (!env) {
    throw new Error('❌ Environment is required. Usage: npm run get-invoiceable-claims <env> [csvFilename]');
  }

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  // Initialize Oystehr
  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const candid = createCandidApiClient(secrets);

  // Get invoiceable claims using the new function
  const invoiceableClaimsResponse = await getInvoiceableClaims(candid, 100);

  if (!invoiceableClaimsResponse) {
    console.log('❌ Failed to retrieve invoiceable claims');
    return;
  }

  const { claims } = invoiceableClaimsResponse;

  // Print claim ID and external patient ID for each invoiceable claim
  console.log(`\n📋 Invoiceable Claims Details:`);
  console.log('================================');

  claims.forEach((claim, index) => {
    const paddedIndex = String(index + 1).padStart(3, ' ');
    console.log(`[${paddedIndex}] Claim ID: ${claim.claimId} | Patient ID: ${claim.patientExternalId}`);
  });

  // Fetch invoice details for each claim and build CSV data
  console.log(`\n💰 Processing Invoice Details for ${claims.length} Claims:`);
  console.log('=========================================================');

  const csvReportData: CSVReportData[] = [];

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    const paddedIndex = String(i + 1).padStart(3, ' ');

    console.log(`\n[${paddedIndex}] Processing Claim: ${claim.claimId}`);

    // Get patient information
    const patientInfo = await getPatientInfoWithLatestAppointment(oystehr, claim.patientExternalId);

    if (patientInfo) {
      console.log(`      👤 Patient ID: ${claim.patientExternalId}`);
      console.log(`      👤 Full Name: ${patientInfo.fullName}`);
      console.log(`      📅 Date of Birth: ${patientInfo.dateOfBirth}`);
      console.log(
        `      📅 Latest Appointment: ${
          patientInfo.latestAppointmentDate
            ? new Date(patientInfo.latestAppointmentDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            : 'No appointments'
        }`
      );
    } else {
      console.log(`      👤 Patient ID: ${claim.patientExternalId}`);
      console.log(`      ⚠️ Patient info not found in FHIR`);
    }

    const invoiceDetails = await getInvoiceDetails(candid, claim.claimId);

    if (invoiceDetails) {
      // Print patient balance in dollars
      console.log(`      💰 Total Patient Balance: $${(invoiceDetails.patientBalanceCents / 100).toFixed(2)}`);

      // Print service lines
      console.log(`      📋 Service Lines (${invoiceDetails.serviceLineItemization.length}):`);

      invoiceDetails.serviceLineItemization.forEach((serviceLine, serviceIndex) => {
        const serviceNum = String(serviceIndex + 1).padStart(2, ' ');
        console.log(`         [${serviceNum}] Procedure Code: ${serviceLine.procedureCode}`);
        console.log(`              📅 Date of Service: ${serviceLine.dateOfService}`);
        console.log(`              💵 Charge Amount: $${(serviceLine.chargeAmountCents / 100).toFixed(2)}`);
        console.log(
          `              🏥 Insurance Payment: $${(serviceLine.insurancePayments.totalPaymentCents / 100).toFixed(2)}`
        );
        console.log(
          `              📉 Insurance Adjustments: $${(
            serviceLine.insuranceAdjustments.totalAdjustmentCents / 100
          ).toFixed(2)}`
        );
        console.log(
          `              👤 Patient Adjustments: $${(serviceLine.patientAdjustments.totalAdjustmentCents / 100).toFixed(
            2
          )}`
        );
        console.log(
          `              💳 Patient Payments: $${(serviceLine.patientPayments.totalPaymentCents / 100).toFixed(2)}`
        );
        console.log(`              🔸 Copay: $${(serviceLine.copayCents / 100).toFixed(2)}`);
        console.log(`              🔹 Coinsurance: $${(serviceLine.coinsuranceCents / 100).toFixed(2)}`);
        console.log(`              🔺 Deductible: $${(serviceLine.deductibleCents / 100).toFixed(2)}`);
        console.log(`              💰 Patient Balance: $${(serviceLine.patientBalanceCents / 100).toFixed(2)}`);

        // Add non-insurance payments and adjustments if they exist
        if (serviceLine.nonInsurancePayments.totalPaymentCents > 0) {
          console.log(
            `              🏛️ Non-Insurance Payments: $${(
              serviceLine.nonInsurancePayments.totalPaymentCents / 100
            ).toFixed(2)}`
          );
        }
        if (serviceLine.nonInsuranceAdjustments.totalAdjustmentCents > 0) {
          console.log(
            `              🔧 Non-Insurance Adjustments: $${(
              serviceLine.nonInsuranceAdjustments.totalAdjustmentCents / 100
            ).toFixed(2)}`
          );
        }

        console.log(''); // Add spacing between service lines
      });

      // Extract data for CSV (using first service line)
      const firstServiceLine = invoiceDetails.serviceLineItemization[0];

      csvReportData.push({
        invoiceDate: new Date().toISOString().split('T')[0], // Add invoice date
        claimId: claim.claimId,
        patientId: claim.patientExternalId,
        fullName: patientInfo?.fullName || 'Unknown',
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        patientBalance: `$${(invoiceDetails.patientBalanceCents / 100).toFixed(2)}`,
        serviceDate: firstServiceLine?.dateOfService || 'N/A',
        procedureCode: firstServiceLine?.procedureCode || 'N/A',
        chargeAmount: firstServiceLine ? `$${(firstServiceLine.chargeAmountCents / 100).toFixed(2)}` : 'N/A',
        insurancePayment: firstServiceLine
          ? `$${(firstServiceLine.insurancePayments.totalPaymentCents / 100).toFixed(2)}`
          : 'N/A',
        copay: firstServiceLine ? `$${(firstServiceLine.copayCents / 100).toFixed(2)}` : 'N/A',
        deductible: firstServiceLine ? `$${(firstServiceLine.deductibleCents / 100).toFixed(2)}` : 'N/A',
        insuranceAdjustments: firstServiceLine
          ? `$${(firstServiceLine.insuranceAdjustments.totalAdjustmentCents / 100).toFixed(2)}`
          : 'N/A',
      });
    } else {
      console.log(`      ❌ Failed to retrieve invoice details`);

      // Still add to CSV with error data
      csvReportData.push({
        invoiceDate: new Date().toISOString().split('T')[0], // Add invoice date
        claimId: claim.claimId,
        patientId: claim.patientExternalId,
        fullName: patientInfo?.fullName || 'Unknown',
        dateOfBirth: patientInfo?.dateOfBirth || 'Unknown',
        appointmentDate: patientInfo?.latestAppointmentDate
          ? new Date(patientInfo.latestAppointmentDate).toISOString().split('T')[0]
          : 'No appointments',
        patientBalance: 'Error',
        serviceDate: 'Error',
        procedureCode: 'Error',
        chargeAmount: 'Error',
        insurancePayment: 'Error',
        copay: 'Error',
        deductible: 'Error',
        insuranceAdjustments: 'Error',
      });
    }
  }

  // Generate CSV report
  generateCSVReport(csvReportData, csvFilename);

  console.log(`\n✅ Completed processing ${claims.length} claims`);
  console.log(`📄 CSV report saved as: ${csvFilename}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error in main execution:', error);
  process.exit(1);
});

// cSpell:ignore elig, inplan, mesg
import Oystehr from '@oystehr/sdk';
import { CoverageEligibilityResponse } from 'fhir/r4b';
import * as fs from 'fs';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function getCoverageEligibilityResponsesByPatient(
  oystehr: Oystehr,
  patientId: string
): Promise<CoverageEligibilityResponse[]> {
  console.log(`Fetching most recent CoverageEligibilityResponse for patient: ${patientId}`);

  try {
    const bundledResponse = await oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        {
          name: 'patient',
          value: `Patient/${patientId}`,
        },
        {
          name: '_sort',
          value: '-_lastUpdated',
        },
        {
          name: '_count',
          value: 1,
        },
      ],
    });

    const unbundled = bundledResponse.unbundle();

    console.log(`Found ${unbundled.length} most recent CoverageEligibilityResponse for patient: ${patientId}`);

    return unbundled;
  } catch (error) {
    console.error(`Error fetching CoverageEligibilityResponse for patient ${patientId}:`, error);
    return [];
  }
}

// Function to extract and parse raw response from CoverageEligibilityResponse
function extractRawResponse(eligibilityResponse: CoverageEligibilityResponse): any | null {
  if (!eligibilityResponse.extension) {
    console.log(`No extensions found in CoverageEligibilityResponse ${eligibilityResponse.id}`);
    return null;
  }

  // Find the extension with the specific URL
  const rawResponseExtension = eligibilityResponse.extension.find(
    (ext) => ext.url === 'https://extensions.fhir.oystehr.com/raw-response'
  );

  if (!rawResponseExtension) {
    console.log(`Raw response extension not found in CoverageEligibilityResponse ${eligibilityResponse.id}`);
    return null;
  }

  // Extract the value (could be valueString, valueAttachment, etc.)
  const rawResponseValue =
    rawResponseExtension.valueString ||
    rawResponseExtension.valueAttachment?.data ||
    rawResponseExtension.valueBase64Binary;

  if (!rawResponseValue) {
    console.log(`Raw response extension has no value in CoverageEligibilityResponse ${eligibilityResponse.id}`);
    return null;
  }

  try {
    // Parse the JSON
    const parsedResponse = JSON.parse(rawResponseValue);
    console.log(`✅ Successfully parsed raw response for CoverageEligibilityResponse ${eligibilityResponse.id}`);
    return parsedResponse;
  } catch (error) {
    console.error(
      `❌ Error parsing raw response JSON for CoverageEligibilityResponse ${eligibilityResponse.id}:`,
      error
    );
    return null;
  }
}

// Enhanced function to get responses with parsed raw data
async function getCoverageEligibilityResponsesWithRawData(
  oystehr: Oystehr,
  patientId: string
): Promise<Array<{ response: CoverageEligibilityResponse; rawData: any | null }>> {
  const eligibilityResponses = await getCoverageEligibilityResponsesByPatient(oystehr, patientId);

  const responsesWithRawData = eligibilityResponses.map((response) => ({
    response,
    rawData: extractRawResponse(response),
  }));

  return responsesWithRawData;
}

// Function to get insurance type information from raw data
function getInsuranceTypeInfo(rawData: any): { type: string; isMedicaid: boolean } {
  if (!rawData || !rawData.elig || !rawData.elig.benefit) {
    return { type: 'N/A', isMedicaid: false };
  }

  // Look for the first benefit with insurance type information
  const benefitWithInsType = rawData.elig.benefit.find(
    (benefit: any) => benefit.insurance_type_code || benefit.insurance_type_description
  );

  if (!benefitWithInsType) {
    return { type: 'N/A', isMedicaid: false };
  }

  const typeCode = benefitWithInsType.insurance_type_code || '';
  const typeDescription = benefitWithInsType.insurance_type_description || '';

  // Determine display text
  let displayType = 'N/A';
  if (typeCode && typeDescription) {
    displayType = `${typeCode} (${typeDescription})`;
  } else if (typeCode) {
    displayType = typeCode;
  } else if (typeDescription) {
    displayType = typeDescription;
  }

  // Check if it's Medicaid
  const isMedicaid = typeCode === 'MC' || typeDescription?.toLowerCase().includes('medicaid') || false;

  return { type: displayType, isMedicaid };
}

// Function to format and display eligibility response data
function displayEligibilityData(rawData: any, responseId: string): void {
  if (!rawData) {
    console.log(`No raw data found for response ${responseId}`);
    return;
  }

  // Check if response contains an error
  if (rawData.error) {
    console.log(`\n❌ Error Response for ${responseId}:`);
    console.log('=====================================');
    console.log(`Error Code: ${rawData.error.error_code || 'N/A'}`);
    console.log(`Error Message: ${rawData.error.error_mesg || 'N/A'}`);
    return;
  }

  // Check if response contains eligibility data
  if (!rawData.elig) {
    console.log(`\n⚠️  No eligibility data found for response ${responseId}`);
    console.log('📄 Full JSON Response:');
    console.log('======================');
    console.log(JSON.stringify(rawData, null, 2));
    return;
  }

  const elig = rawData.elig;

  // Get insurance type information
  const insuranceInfo = getInsuranceTypeInfo(rawData);

  console.log(`\n🏥 Eligibility Details for Response ${responseId}:`);
  console.log('=====================================');

  // Display insurance type with Medicaid highlighting
  if (insuranceInfo.isMedicaid) {
    console.log('🚨 MEDICAID COVERAGE DETECTED');
    console.log('=====================================');
  }

  console.log(`🏷️  Insurance Type: ${insuranceInfo.isMedicaid ? '🚨 ' : ''}${insuranceInfo.type}`);
  console.log('');

  // Member Information
  console.log('👤 Member Information:');
  console.log(`   Name: ${elig.ins_name_f || 'N/A'} ${elig.ins_name_l || 'N/A'}`);
  console.log(`   Member ID: ${elig.ins_number || 'N/A'}`);
  console.log(`   DOB: ${formatDate(elig.ins_dob) || 'N/A'}`);
  console.log(`   Sex: ${elig.ins_sex || 'N/A'}`);
  console.log(
    `   Address: ${elig.ins_addr_1 || 'N/A'}, ${elig.ins_city || 'N/A'}, ${elig.ins_state || 'N/A'} ${
      elig.ins_zip || 'N/A'
    }`
  );

  // Group Information
  console.log('\n🏢 Group Information:');
  console.log(`   Group Name: ${elig.group_name || 'N/A'}`);
  console.log(`   Group Number: ${elig.group_number || 'N/A'}`);

  // Eligibility Information
  console.log('\n📅 Eligibility Information:');
  console.log(`   Begin Date: ${formatDate(elig.eligibility_begin_date) || 'N/A'}`);
  console.log(`   Result Date: ${formatDate(elig.elig_result_date) || 'N/A'}`);
  console.log(`   Result Time: ${elig.elig_result_time || 'N/A'}`);

  // Benefits Information
  if (elig.benefit && Array.isArray(elig.benefit)) {
    console.log('\n💰 Benefits:');
    console.log('Code\tDescription\t\t\tCoverage\t\tAmount\t\tLevel\tPeriod\tIns Type');
    console.log('-------------------------------------------------------------------------------------');

    elig.benefit.forEach((benefit: any) => {
      const code = benefit.benefit_code || 'N/A';
      const description = benefit.benefit_description || 'N/A';
      const coverage = benefit.benefit_coverage_description || 'N/A';
      const amount = benefit.benefit_amount ? `$${parseInt(benefit.benefit_amount).toLocaleString()}` : 'N/A';
      const level = benefit.benefit_level_description || 'N/A';
      const period = benefit.benefit_period_description || 'N/A';

      // Get insurance type for this benefit
      const benefitInsType = benefit.insurance_type_code || benefit.insurance_type_description || 'N/A';
      const isBenefitMedicaid =
        benefit.insurance_type_code === 'MC' || benefit.insurance_type_description?.toLowerCase().includes('medicaid');
      const insTypeDisplay = isBenefitMedicaid ? `🚨 ${benefitInsType}` : benefitInsType;

      console.log(`${code}\t${description}\t${coverage}\t${amount}\t\t${level}\t${period}\t${insTypeDisplay}`);

      if (benefit.benefit_notes) {
        console.log(`   Notes: ${benefit.benefit_notes}`);
      }
      if (benefit.insurance_plan) {
        console.log(`   Plan: ${benefit.insurance_plan}`);
      }
      if (benefit.inplan_network) {
        console.log(`   In-Network: ${benefit.inplan_network === 'Y' ? 'Yes' : 'No'}`);
      }
      console.log('');
    });
  }
}

// Helper function to format date from YYYYMMDD to YYYY-MM-DD
function formatDate(dateString: string): string | null {
  if (!dateString || dateString.length !== 8) {
    return null;
  }

  const year = dateString.substring(0, 4);
  const month = dateString.substring(4, 6);
  const day = dateString.substring(6, 8);

  return `${year}-${month}-${day}`;
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const patientId = process.argv[3];

  if (!patientId) {
    throw new Error(
      '❌ Patient ID is required. Usage: npm run script get-coverage-eligibility-responses <env> <patientId>'
    );
  }

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('❌ Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  // Fetch all coverage eligibility responses with raw data for the patient
  const responsesWithRawData = await getCoverageEligibilityResponsesWithRawData(oystehr, patientId);

  if (responsesWithRawData.length === 0) {
    console.log('No coverage eligibility responses found for this patient.');
    return;
  }

  console.log(`\n📋 Coverage Eligibility Responses for Patient ${patientId}:`);
  console.log('ID\t\t\tStatus\t\tHas Raw Data\tMember Name\t\tInsurance Type');
  console.log('------------------------------------------------------------------------------------');

  for (const { response, rawData } of responsesWithRawData) {
    const id = response.id || 'N/A';
    const status = response.status || 'N/A';
    const hasRawData = rawData ? '✅' : '❌';

    // Extract member name and insurance type from raw data if available
    let memberName = 'N/A';
    let insuranceTypeDisplay = 'N/A';

    if (rawData && rawData.elig) {
      const firstName = rawData.elig.ins_name_f || '';
      const lastName = rawData.elig.ins_name_l || '';
      memberName = `${firstName} ${lastName}`.trim() || 'N/A';

      // Get insurance type information
      const insuranceInfo = getInsuranceTypeInfo(rawData);
      insuranceTypeDisplay = insuranceInfo.isMedicaid ? `🚨 ${insuranceInfo.type}` : insuranceInfo.type;
    }

    console.log(`${id}\t${status}\t\t${hasRawData}\t\t${memberName}\t\t${insuranceTypeDisplay}`);

    // Display detailed eligibility data if raw data is available
    if (rawData) {
      displayEligibilityData(rawData, id);
    }
  }

  const responsesWithRawData_count = responsesWithRawData.filter(({ rawData }) => rawData !== null).length;
  const medicaidCount = responsesWithRawData.filter(({ rawData }) => {
    const insuranceInfo = getInsuranceTypeInfo(rawData);
    return insuranceInfo.isMedicaid;
  }).length;

  console.log(`\n📊 Summary:`);
  console.log(`Total Responses: ${responsesWithRawData.length}`);
  console.log(`With Raw Data: ${responsesWithRawData_count}`);
  console.log(`Medicaid Coverage: ${medicaidCount}`);
}

main()
  .then(() => console.log('\n✅ This is all the coverage eligibilities for the specified patient.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

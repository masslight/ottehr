import * as fs from 'fs';

// Interface for payer data with all fields
interface PayerData {
  moniker: string;
  type: string;
  id: string;
  name: string;
  category: string;
  description: string;
}

// Interface for FHIR Organization resource
interface FhirOrganization {
  resourceType: 'Organization';
  active: boolean;
  name: string;
  type: Array<{
    coding: Array<{
      system: string;
      code: string;
    }>;
  }>;
  identifier: Array<{
    system: string;
    value: string;
  }>;
}

// Interface for FHIR resources structure
interface FhirResourcesOutput {
  'schema-version': string;
  fhirResources: {
    [key: string]: {
      resource: FhirOrganization;
    };
  };
}

// Function to parse payer data from CSV file with all columns
function parsePayersFromCSV(csvFilename: string): PayerData[] {
  try {
    console.log(`📄 Reading payer data from: ${csvFilename}`);

    const fileContent = fs.readFileSync(csvFilename, 'utf8');

    // Split by newlines and filter out empty lines
    const lines = fileContent
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Skip the first row (header row)
    if (lines.length === 0) {
      console.log('⚠️  CSV file is empty');
      return [];
    }

    const headerRow = lines[0];
    console.log(`📋 Header row: ${headerRow}`);

    if (lines.length === 1) {
      console.log('⚠️  CSV file only contains header row');
      return [];
    }

    // Parse each line as CSV (handle quoted values), starting from line 1 (skip header)
    const payers: PayerData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Simple CSV parsing (handles quoted values)
      const columns: string[] = [];
      let currentColumn = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];

        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          columns.push(currentColumn.trim());
          currentColumn = '';
        } else {
          currentColumn += char;
        }
      }
      // Add the last column
      columns.push(currentColumn.trim());

      // Extract all fields: moniker, type, id, name, category, description
      const moniker = columns[0] || '';
      const type = columns[1] || '';
      const id = columns[2] || '';
      const name = columns[3] || '';
      const category = columns[4] || '';
      const description = columns[5] || '';

      if (moniker && id && name) {
        payers.push({
          moniker,
          type,
          id,
          name,
          category,
          description,
        });
      }
    }

    console.log(`✅ Found ${payers.length} payers (excluding header row)`);

    return payers;
  } catch (error) {
    console.error(`❌ Error reading CSV file ${csvFilename}:`, error);
    throw error;
  }
}

// Function to generate FHIR resources from payer data
function generateFhirResources(payers: PayerData[]): FhirResourcesOutput {
  const fhirResources: FhirResourcesOutput = {
    'schema-version': '2025-09-25',
    fhirResources: {},
  };

  payers.forEach((payer, index) => {
    console.log(`   [${index + 1}/${payers.length}] Generating FHIR resource for: ${payer.name}`);
    console.log(`      Moniker: ${payer.moniker}`);
    console.log(`      Type: ${payer.type}`);

    // Create FHIR Organization resource
    const organization: FhirOrganization = {
      resourceType: 'Organization',
      active: true,
      name: payer.name,
      type: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/organization-type',
              code: payer.type,
            },
          ],
        },
      ],
      identifier: [
        {
          system: 'https://api.joincandidhealth.com/api/non-insurance-payers/v1/response/non_insurance_payer_id',
          value: `#{var/${payer.moniker}}`,
        },
      ],
    };

    // Add to fhirResources object using moniker as key
    fhirResources.fhirResources[payer.moniker] = {
      resource: organization,
    };
  });

  return fhirResources;
}

// Function to write FHIR resources to JSON file
function writeFhirResourcesToFile(fhirResources: FhirResourcesOutput, filename: string): void {
  try {
    console.log(`\n📄 Writing FHIR resources to: ${filename}`);

    const jsonContent = JSON.stringify(fhirResources, null, 2);
    fs.writeFileSync(filename, jsonContent, 'utf8');

    console.log(`✅ FHIR resources file created successfully`);
    console.log(`   Total resources: ${Object.keys(fhirResources.fhirResources).length}`);
  } catch (error) {
    console.error(`❌ Error writing FHIR resources file:`, error);
    throw error;
  }
}

// Function to generate JSON environment variables from payer data
function generateJsonEnvVars(payers: PayerData[]): Record<string, string> {
  const envVars: Record<string, string> = {};

  payers.forEach((payer) => {
    envVars[payer.moniker] = payer.id;
  });

  return envVars;
}

// Function to write JSON environment variables to file
function writeJsonEnvVarsToFile(envVars: Record<string, string>, filename: string): void {
  try {
    console.log(`\n📄 Writing JSON environment variables to: ${filename}`);

    const jsonContent = JSON.stringify(envVars, null, 2);
    fs.writeFileSync(filename, jsonContent, 'utf8');

    console.log(`✅ JSON environment variables file created successfully`);
    console.log(`   Total variables: ${Object.keys(envVars).length}`);
  } catch (error) {
    console.error(`❌ Error writing JSON environment variables file:`, error);
    throw error;
  }
}

// Function to generate shell environment variables from payer data
function generateShellEnvVars(payers: PayerData[]): string {
  const envLines: string[] = [];

  payers.forEach((payer) => {
    // Use moniker exactly as written (all lowercase with dashes)
    envLines.push(`${payer.moniker}=${payer.id}`);
  });

  return envLines.join('\n');
}

// Function to write shell environment variables to file
function writeShellEnvVarsToFile(envVarsContent: string, filename: string): void {
  try {
    console.log(`\n📄 Writing shell environment variables to: ${filename}`);

    fs.writeFileSync(filename, envVarsContent, 'utf8');

    const lineCount = envVarsContent.split('\n').length;
    console.log(`✅ Shell environment variables file created successfully`);
    console.log(`   Total variables: ${lineCount}`);
  } catch (error) {
    console.error(`❌ Error writing shell environment variables file:`, error);
    throw error;
  }
}

// Updated main function
async function main(): Promise<void> {
  const env = process.argv[2];

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run create-non-insurance-payer-resources <env> [csvInputFilename] [resourceOutputFilename] [jsonEnvOutputFilename] [shellEnvOutputFilename]'
    );
  }

  // Get user's home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  const downloadsDir = `${homeDir}/Downloads`;

  // Use provided filenames or generate defaults with Downloads directory
  const csvInputFilename = process.argv[3] || `${downloadsDir}/${env}-created-payers.csv`;
  const resourceOutputFilename = process.argv[4] || `${downloadsDir}/${env}-resource-payers.json`;
  const jsonEnvOutputFilename = process.argv[5] || `${downloadsDir}/${env}-payers-env-vars.json`;
  const shellEnvOutputFilename = process.argv[6] || `${downloadsDir}/${env}-payers-env-vars.env`;

  console.log(`📂 Input file: ${csvInputFilename}`);
  console.log(`📂 Resource Output file: ${resourceOutputFilename}`);
  console.log(`📂 JSON Environment Output file: ${jsonEnvOutputFilename}`);
  console.log(`📂 Shell Environment Output file: ${shellEnvOutputFilename}`);

  // Parse payer data from CSV
  const payersInput = parsePayersFromCSV(csvInputFilename);

  if (payersInput.length === 0) {
    console.log('⚠️  No payer data found in CSV file.');
    return;
  }

  console.log(`\n🔄 Processing ${payersInput.length} payers...`);

  // Generate FHIR resources
  const fhirResources = generateFhirResources(payersInput);

  // Write FHIR resources to file
  writeFhirResourcesToFile(fhirResources, resourceOutputFilename);

  // Generate and write JSON environment variables
  const jsonEnvVars = generateJsonEnvVars(payersInput);
  writeJsonEnvVarsToFile(jsonEnvVars, jsonEnvOutputFilename);

  // Generate and write shell environment variables
  const shellEnvVars = generateShellEnvVars(payersInput);
  writeShellEnvVarsToFile(shellEnvVars, shellEnvOutputFilename);

  // Final Summary
  console.log(`\n📊 Final Summary:`);
  console.log(`   📄 FHIR resources created: ${Object.keys(fhirResources.fhirResources).length}`);
  console.log(`   💾 FHIR output file: ${resourceOutputFilename}`);
  console.log(`   📝 JSON env vars file: ${jsonEnvOutputFilename}`);
  console.log(`   🐚 Shell env vars file: ${shellEnvOutputFilename}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error in main execution:', error);
  process.exit(1);
});

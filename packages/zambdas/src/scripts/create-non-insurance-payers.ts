import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { NonInsurancePayerId } from 'candidhealth/api/resources/nonInsurancePayers/resources/v1';
import * as fs from 'fs';
import { getSecret, Secrets, SecretsKeys } from 'utils';

function createCandidApiClient(secrets: Secrets | null): CandidApiClient {
  const candidApiClient: CandidApiClient = new CandidApiClient({
    clientId: getSecret(SecretsKeys.CANDID_CLIENT_ID, secrets),
    clientSecret: getSecret(SecretsKeys.CANDID_CLIENT_SECRET, secrets),
    environment:
      getSecret(SecretsKeys.CANDID_ENV, secrets) === 'PROD'
        ? CandidApiEnvironment.Production
        : CandidApiEnvironment.Staging,
  });
  return candidApiClient;
}

// Function to generate a standardized payer moniker/identifier
function generatePayerMoniker(name: string, category: string, description: string): string {
  // Helper function to create abbreviation from a phrase
  function abbreviatePhrase(phrase: string, maxCharsPerWord: number = 3): string {
    return phrase
      .toLowerCase()
      .split(/\s+/) // Split by whitespace
      .filter((word) => word.length > 0)
      .map((word) => word.substring(0, maxCharsPerWord))
      .join('-');
  }

  // Helper function to create acronym from employer name
  function createAcronym(name: string): string {
    const words = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return 'unk';
    }

    // If single word, take first 3-4 characters
    if (words.length === 1) {
      return words[0].substring(0, 4);
    }

    // If multiple words, try to create meaningful acronym
    // Take first letter of each word, up to 5 letters
    const firstLetters = words.map((word) => word[0]).join('');
    if (firstLetters.length <= 5) {
      return firstLetters;
    }

    // If too many words, take first letter of first 3 words + first 2 chars of last word
    return (
      words
        .slice(0, 3)
        .map((w) => w[0])
        .join('') + words[words.length - 1].substring(0, 2)
    );
  }

  // Generate each component
  const categoryAbbr = abbreviatePhrase(category, 3);
  const descriptionAbbr = abbreviatePhrase(description, 3);
  const employerAcronym = createAcronym(name);

  // Combine into final moniker
  const moniker = `nip-${categoryAbbr}-${descriptionAbbr}-${employerAcronym}`;

  return moniker;
}

// Function to generate a standardized payer type from category and description
function generatePayerType(category: string, description: string): string {
  // Helper function to process text: remove special chars, lowercase, replace spaces with dashes
  function processText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '') // Remove special characters
      .trim()
      .replace(/\s+/g, '-'); // Replace spaces with dashes
  }

  const categoryProcessed = processText(category);
  const descriptionProcessed = processText(description);

  // Combine into final type
  const payerType = `${categoryProcessed}-${descriptionProcessed}`;

  return payerType;
}

// Interface for payer input data
interface PayerInputData {
  name: string;
  category: string;
  description: string;
}

// Function to parse payer data from CSV file
function parsePayers(csvFilename: string): PayerInputData[] {
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
    const payers: PayerInputData[] = [];

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

      // Extract name, category, and description
      const name = columns[0] || '';
      const category = columns[1] || 'Unknown Category'; // Default if not provided
      const description = columns[2] || 'Indescribable'; // Default if not provided

      if (name) {
        payers.push({
          name,
          category,
          description,
        });
      }
    }

    console.log(`✅ Found ${payers.length} payers (excluding header row)`);

    // Log all payers
    console.log('\n📋 Payer data:');
    payers.forEach((payer, index) => {
      console.log(`   ${(index + 1).toString().padStart(3)}. ${payer.name} | ${payer.category} | ${payer.description}`);
    });

    return payers;
  } catch (error) {
    console.error(`❌ Error reading CSV file ${csvFilename}:`, error);
    throw error;
  }
}

// Interface for CSV output data
interface PayerOutputData {
  id: string;
  name: string;
  category: string;
  description: string;
  moniker?: string;
  type?: string;
}

// Function to check if a payer with the same name already exists
async function findExistingPayer(
  candid: CandidApiClient,
  payerName: string
): Promise<{ found: boolean; payerId?: string; count: number }> {
  try {
    const response = await candid.nonInsurancePayers.v1.getMulti({
      name: payerName,
    });

    if (response && response.ok && response.body) {
      const payers = response.body.items || [];

      if (payers.length === 0) {
        console.log(`   ℹ️  No existing payer found with name "${payerName}"`);
        return { found: false, count: 0 };
      } else if (payers.length === 1) {
        console.log(`   ℹ️  Found existing payer with ID: ${payers[0].nonInsurancePayerId}`);
        return {
          found: true,
          payerId: payers[0].nonInsurancePayerId,
          count: 1,
        };
      } else {
        console.log(`   ⚠️  Found ${payers.length} payers with name "${payerName}"`);
        payers.forEach((payer, index) => {
          console.log(
            `      ${index + 1}. ID: ${payer.nonInsurancePayerId} | Category: ${payer.category} | Description: ${
              payer.description
            }`
          );
        });
        return { found: true, count: payers.length };
      }
    }

    return { found: false, count: 0 };
  } catch (error) {
    console.error(`   ❌ Error searching for existing payer "${payerName}":`, error);
    throw error;
  }
}

// Function to update an existing payer
async function updateNonInsurancePayer(
  candid: CandidApiClient,
  payerId: string,
  payerData: PayerInputData
): Promise<{ id: string; name: string; category: string; description: string }> {
  try {
    const response = await candid.nonInsurancePayers.v1.update(NonInsurancePayerId(payerId), {
      category: { type: 'set', value: payerData.category },
      description: { type: 'set', value: payerData.description },
    });

    if (response && response.ok && response.body) {
      console.log(`   ✅ Updated payer ${response.body.name} (ID: ${response.body.nonInsurancePayerId})`);
      console.log(`      Category: ${response.body.category}`);
      console.log(`      Description: ${response.body.description}`);
      return {
        id: response.body.nonInsurancePayerId,
        name: response.body.name,
        category: response.body.category || payerData.category,
        description: response.body.description || payerData.description,
      };
    }

    throw new Error(`Failed to update payer "${payerData.name}"`);
  } catch (error) {
    console.error(`   ❌ Failed to update payer "${payerData.name}":`, error);
    throw error;
  }
}

// Function to create a non-insurance payer in Candid
async function createNonInsurancePayer(
  candid: CandidApiClient,
  payerData: PayerInputData
): Promise<{ id: string; name: string; category: string; description: string }> {
  try {
    const response = await candid.nonInsurancePayers.v1.create({
      name: payerData.name,
      category: payerData.category,
      description: payerData.description,
    });

    if (response && response.ok && response.body) {
      console.log(`   ✅ Created payer ${response.body.name} with ID: ${response.body.nonInsurancePayerId}`);
      return {
        id: response.body.nonInsurancePayerId,
        name: response.body.name,
        category: response.body.category || payerData.category,
        description: response.body.description || payerData.description,
      };
    }

    throw new Error(`Failed to create payer "${payerData.name}"`);
  } catch (error) {
    console.error(`   ❌ Failed to create payer "${payerData.name}":`, error);
    throw error;
  }
}

// Function to create or update a payer
async function createOrUpdatePayer(
  candid: CandidApiClient,
  payerData: PayerInputData
): Promise<{
  id: string;
  name: string;
  category: string;
  description: string;
  action: 'created' | 'updated' | 'skipped';
}> {
  // Check if payer already exists
  const existingPayer = await findExistingPayer(candid, payerData.name);

  if (existingPayer.count === 0) {
    // Create new payer
    const result = await createNonInsurancePayer(candid, payerData);
    return { ...result, action: 'created' };
  } else if (existingPayer.count === 1 && existingPayer.payerId) {
    // Update existing payer
    const result = await updateNonInsurancePayer(candid, existingPayer.payerId, payerData);
    return { ...result, action: 'updated' };
  } else {
    // Multiple payers found - skip
    console.log(`   ⏭️  Skipping due to multiple payers with same name`);
    return {
      id: 'MULTIPLE_FOUND',
      name: payerData.name,
      category: payerData.category,
      description: payerData.description,
      action: 'skipped',
    };
  }
}

// Function to ensure moniker uniqueness
function ensureUniqueMonikers(payerData: PayerOutputData[]): void {
  const monikerCounts = new Map<string, number>();
  const usedMonikers = new Set<string>();

  // First pass: count occurrences of each moniker
  payerData.forEach((payer) => {
    if (payer.moniker) {
      monikerCounts.set(payer.moniker, (monikerCounts.get(payer.moniker) || 0) + 1);
    }
  });

  // Second pass: make duplicates unique
  payerData.forEach((payer) => {
    if (!payer.moniker) return;

    const originalMoniker = payer.moniker;
    const count = monikerCounts.get(originalMoniker) || 0;

    // If this moniker appears multiple times, we need to make it unique
    if (count > 1 || usedMonikers.has(payer.moniker)) {
      let uniqueMoniker = payer.moniker;
      let attempts = 0;
      const maxAttempts = 1000;

      // Keep trying until we find a unique moniker
      while (usedMonikers.has(uniqueMoniker) && attempts < maxAttempts) {
        // Generate random lowercase letter (a-z) and digit (0-9)
        const randomLetter = String.fromCharCode(97 + Math.floor(Math.random() * 26)); // a-z
        const randomDigit = Math.floor(Math.random() * 10); // 0-9
        uniqueMoniker = `${originalMoniker}${randomLetter}${randomDigit}`;
        attempts++;
      }

      if (attempts >= maxAttempts) {
        console.warn(`   ⚠️  Could not generate unique moniker for "${originalMoniker}" after ${maxAttempts} attempts`);
      }

      if (uniqueMoniker !== originalMoniker) {
        console.log(`   🔄 Duplicate moniker detected: "${originalMoniker}" → "${uniqueMoniker}"`);
      }

      payer.moniker = uniqueMoniker;
    }

    usedMonikers.add(payer.moniker);
  });
}

// Function to write payer data to CSV
function writePayersToCSV(payerData: PayerOutputData[], csvFilename: string): void {
  try {
    console.log(`\n📄 Writing results to CSV: ${csvFilename}`);

    // Ensure all monikers are unique before writing
    ensureUniqueMonikers(payerData);

    // CSV headers - add moniker and type as leading columns
    const headers = ['moniker', 'type', 'id', 'name', 'category', 'description'];

    // Convert data to CSV format
    const csvRows = [
      headers.join(','), // Header row
      ...payerData.map((row) =>
        [
          `"${row.moniker || ''}"`,
          `"${row.type || ''}"`,
          `"${row.id}"`,
          `"${row.name}"`,
          `"${row.category}"`,
          `"${row.description}"`,
        ].join(',')
      ),
    ];

    // Write CSV file
    const csvContent = csvRows.join('\n');
    fs.writeFileSync(csvFilename, csvContent, 'utf8');

    console.log(`✅ CSV file created successfully with ${payerData.length} records`);
  } catch (error) {
    console.error(`❌ Error writing CSV file:`, error);
    throw error;
  }
}

// Updated main function
async function main(): Promise<void> {
  const env = process.argv[2];

  // Validate required arguments
  if (!env) {
    throw new Error(
      '❌ Environment is required. Usage: npm run create-non-insurance-payers <env> [csvInputFilename] [csvOutputFilename]'
    );
  }

  // Get user's home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
  const downloadsDir = `${homeDir}/Downloads`;

  // Use provided filenames or generate defaults with Downloads directory
  const csvInputFilename = process.argv[3] || `${downloadsDir}/${env}-payers.csv`;
  const csvOutputFilename = process.argv[4] || `${downloadsDir}/${env}-created-payers.csv`;

  console.log(`📂 Input file: ${csvInputFilename}`);
  console.log(`📂 Output file: ${csvOutputFilename}`);

  // Parse payer data from CSV
  const payersInput = parsePayers(csvInputFilename);

  if (payersInput.length === 0) {
    console.log('⚠️  No payer data found in CSV file.');
    return;
  }

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const candid = createCandidApiClient(secrets);

  console.log(`\n🔄 Processing ${payersInput.length} payers...`);

  const payerOutputData: PayerOutputData[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let failCount = 0;

  for (let i = 0; i < payersInput.length; i++) {
    const payerInput = payersInput[i];
    console.log(`\n[${i + 1}/${payersInput.length}] Processing payer: ${payerInput.name}`);
    console.log(`   Category: ${payerInput.category}`);
    console.log(`   Description: ${payerInput.description}`);

    // Generate moniker and type
    const moniker = generatePayerMoniker(payerInput.name, payerInput.category, payerInput.description);
    const type = generatePayerType(payerInput.category, payerInput.description);

    console.log(`   Moniker: ${moniker}`);
    console.log(`   Type: ${type}`);

    try {
      // Create or update payer in Candid
      const result = await createOrUpdatePayer(candid, payerInput);

      // Add to output data with moniker and type
      payerOutputData.push({
        moniker,
        type,
        id: result.id,
        name: result.name,
        category: result.category,
        description: result.description,
      });

      // Track action type
      if (result.action === 'created') {
        createdCount++;
      } else if (result.action === 'updated') {
        updatedCount++;
      } else if (result.action === 'skipped') {
        skippedCount++;
      }

      // Add small delay between API calls to avoid rate limiting
      if (i < payersInput.length - 1) {
        console.log('   ⏳ Waiting 500ms...');
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (error) {
      failCount++;
      console.error(`   ❌ Failed to process payer "${payerInput.name}"`, error);

      // Add failed entry with error info
      payerOutputData.push({
        moniker,
        type,
        id: 'ERROR',
        name: payerInput.name,
        category: payerInput.category,
        description: payerInput.description,
      });
    }
  }

  // Write results to CSV
  if (payerOutputData.length > 0) {
    writePayersToCSV(payerOutputData, csvOutputFilename);
  }

  // Final Summary
  console.log(`\n📊 Final Summary:`);
  console.log(`   ➕ Created: ${createdCount} payers`);
  console.log(`   ✏️  Updated: ${updatedCount} payers`);
  console.log(`   ⏭️  Skipped (multiple found): ${skippedCount} payers`);
  console.log(`   ❌ Failed: ${failCount} payers`);
  console.log(`   📄 CSV output file: ${csvOutputFilename}`);
}

main().catch((error) => {
  console.error('❌ Unexpected error in main execution:', error);
  process.exit(1);
});

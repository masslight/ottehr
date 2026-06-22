import Oystehr from '@oystehr/sdk';
import { Address, Organization } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { Secrets } from 'utils';
import { createCandidClientIfConfigured, createCandidEmployerPayer } from '../rcm/employers/candid-sync';
import {
  buildEmployerType,
  EMPLOYER_ORG_TYPE_CODE,
  EMPLOYER_ORG_TYPE_SYSTEM,
  normalizeAddress,
  normalizeEmployerNotesExtension,
  normalizeTelecom,
  setOrUpdateCandidIdentifier,
} from '../rcm/employers/helpers';
import { createOystehrClientFromConfig } from './helpers';

// ─── CSV row shape ──────────────────────────────────────────────────────────────
interface EmployerCsvRow {
  company: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  contact: string;
  phone: string;
  email: string;
  zipPlus4: string;
}

// ─── CSV parsing ────────────────────────────────────────────────────────────────
function parseCsvLine(line: string): string[] {
  const columns: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === ',' && !insideQuotes) {
      columns.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  columns.push(current.trim());
  return columns;
}

function parseEmployersCsv(csvPath: string): EmployerCsvRow[] {
  console.log(`📄 Reading employer CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    console.log('⚠️  CSV has no data rows');
    return [];
  }

  const header = lines[0];
  console.log(`📋 Header: ${header}`);

  const rows: EmployerCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const company = cols[0] || '';
    if (!company) continue; // skip blank rows

    rows.push({
      company,
      street: cols[1] || '',
      city: cols[2] || '',
      state: cols[3] || '',
      zip: cols[4] || '',
      contact: cols[5] || '',
      phone: cols[6] || '',
      email: cols[7] || '',
      zipPlus4: cols[8] || '',
    });
  }

  console.log(`✅ Parsed ${rows.length} employers from CSV\n`);
  return rows;
}

// ─── Build FHIR address from CSV row ────────────────────────────────────────────
function buildFhirAddress(row: EmployerCsvRow): Address[] | undefined {
  const hasAddress = Boolean(row.street || row.city || row.state || row.zip);
  if (!hasAddress) return undefined;

  const postalCode = row.zipPlus4 ? `${row.zip}-${row.zipPlus4}` : row.zip || undefined;

  return normalizeAddress({
    line: row.street ? [row.street] : undefined,
    city: row.city || undefined,
    state: row.state || undefined,
    postalCode,
  });
}

// ─── Duplicate check ────────────────────────────────────────────────────────────
async function fetchExistingEmployers(oystehr: Oystehr): Promise<Organization[]> {
  console.log('🔍 Fetching existing employer organizations from FHIR...');
  const results = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      {
        name: 'type',
        value: `${EMPLOYER_ORG_TYPE_SYSTEM}|${EMPLOYER_ORG_TYPE_CODE}`,
      },
      {
        name: '_count',
        value: '1000',
      },
    ],
  });
  const employers = results.unbundle();
  console.log(`   Found ${employers.length} existing employers\n`);
  return employers;
}

// ─── Main ───────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const env = process.argv[2];
  const csvPath = process.argv[3];

  if (!env || !csvPath) {
    console.error('Usage: npm run import-employers -- <environment> <csv-file-path>');
    console.error('  environment  – matches a config file at config/.env/<environment>.json');
    console.error('  csv-file-path – path to a CSV in the anycare-employers.csv format');
    console.error('');
    console.error('CSV columns: COMPANY, STREET, CITY, STATE, ZIP, CONTACT, PHONE#, EMAIL, ZIP+4');
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsv)) {
    console.error(`❌ CSV file not found: ${resolvedCsv}`);
    process.exit(1);
  }

  // Load secrets / config
  const configPath = path.resolve(__dirname, `../../../../config/.env/${env}.json`);
  let secrets: Secrets;
  try {
    secrets = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    (secrets as any).env = env;
  } catch {
    console.error(`❌ Cannot load config for environment "${env}" at ${configPath}`);
    process.exit(1);
  }

  // Parse CSV
  const csvRows = parseEmployersCsv(resolvedCsv);
  if (csvRows.length === 0) return;

  // Init Oystehr (FHIR) client
  const oystehr = await createOystehrClientFromConfig(secrets);

  // Init Candid client (may be null if secrets not configured)
  const candid = await createCandidClientIfConfigured(oystehr, secrets);
  if (candid) {
    console.log('✅ Candid client initialized\n');
  } else {
    console.log('⚠️  Candid secrets not configured — will create FHIR Organizations only (no Candid sync)\n');
  }

  // Fetch existing employers to avoid duplicates
  const existingEmployers = await fetchExistingEmployers(oystehr);
  const existingByName = new Map<string, Organization>();
  for (const org of existingEmployers) {
    if (org.name) {
      existingByName.set(org.name.toLowerCase().trim(), org);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;
  let candidSyncCount = 0;
  let candidFailCount = 0;

  for (let i = 0; i < csvRows.length; i++) {
    const row = csvRows[i];
    console.log(`[${i + 1}/${csvRows.length}] ${row.company}`);

    // Check for existing employer by name
    const existing = existingByName.get(row.company.toLowerCase().trim());
    if (existing) {
      console.log(`   ⏭️  Already exists (Organization/${existing.id}) — skipping`);
      skippedCount++;
      continue;
    }

    // Build FHIR fields
    const categoryText = 'Occupational Medicine';
    const address = buildFhirAddress(row);
    const telecom = normalizeTelecom({
      phone: row.phone || undefined,
      email: row.email || undefined,
    });
    const notes = row.contact ? `Contact: ${row.contact}` : undefined;
    const extension = normalizeEmployerNotesExtension(notes);

    // Step 1: Create FHIR Organization
    let organization = await oystehr.fhir.create<Organization>({
      resourceType: 'Organization',
      active: true,
      name: row.company,
      type: buildEmployerType(categoryText),
      address,
      telecom,
      extension,
    });
    console.log(`   ✅ Created FHIR Organization/${organization.id}`);
    createdCount++;

    // Step 2: Sync to Candid (best-effort)
    if (candid) {
      const candidPayerId = await createCandidEmployerPayer(candid, row.company, categoryText, organization.address);
      if (candidPayerId) {
        // Step 3: Persist the Candid payer ID back into the Organization identifier
        organization = await oystehr.fhir.update<Organization>({
          ...organization,
          identifier: setOrUpdateCandidIdentifier(organization, candidPayerId),
        });
        console.log(`   ✅ Candid payer synced → ${candidPayerId}`);
        candidSyncCount++;
      } else {
        console.log(`   ⚠️  Candid sync failed — Organization created without Candid ID`);
        candidFailCount++;
      }

      // Small delay to avoid rate-limiting
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    // Track in the map so later CSV rows with the same name are deduped
    existingByName.set(row.company.toLowerCase().trim(), organization);
  }

  // Summary
  console.log(`\n📊 Import Summary:`);
  console.log(`   ➕ Created:       ${createdCount} employers`);
  console.log(`   ⏭️  Skipped:       ${skippedCount} (already existed)`);
  if (candid) {
    console.log(`   🔗 Candid synced: ${candidSyncCount}`);
    if (candidFailCount > 0) {
      console.log(`   ⚠️  Candid failed: ${candidFailCount}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});

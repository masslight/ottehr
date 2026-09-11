// Import billing service facilities from a CSV into FHIR Locations.
//
// CSV columns: Facility Name,NPI,CLIA,Address 1,Address 2,City,State,Zip,Zip4,Type
// (Type is the CMS place-of-service code, e.g. 20 = Urgent Care Facility.)
//
// Usage:
//   cd packages/zambdas
//   npm run import-service-facilities -- <csv-path> [--dry-run]
//
// Credentials come from OYSTEHR_PROJECT_ID / OYSTEHR_ACCESS_TOKEN env vars, or you
// will be prompted for them. The token must be an Oystehr developer/M2M access token
// with FHIR Location write access.

import * as readline from 'node:readline/promises';
import Oystehr from '@oystehr/sdk';
import { Location } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { SaveServiceFacilityInput, SaveServiceFacilityInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { applyServiceFacilityInput, mapServiceFacility } from '../billing/service-facility.helpers';
import { EXCLUDE_WORKING_COPIES_PARAMS } from '../billing/shared';

interface FacilityCsvRow {
  lineNumber: number;
  name: string;
  npi: string;
  clia: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  zip4: string;
  posCode: string;
}

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

function parseFacilitiesCsv(csvPath: string): FacilityCsvRow[] {
  console.log(`📄 Reading CSV from: ${csvPath}`);
  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    console.log('⚠️  CSV has no data rows');
    return [];
  }

  console.log(`📋 Header: ${lines[0]}`);

  const rows: FacilityCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[0] || '';
    if (!name) continue;

    rows.push({
      lineNumber: i + 1,
      name,
      npi: cols[1] || '',
      clia: cols[2] || '',
      addressLine1: cols[3] || '',
      addressLine2: cols[4] || '',
      city: cols[5] || '',
      state: (cols[6] || '').trim().toUpperCase(),
      zip: cols[7] || '',
      zip4: cols[8] || '',
      posCode: cols[9] || '',
    });
  }

  console.log(`✅ Parsed ${rows.length} facilities from CSV\n`);
  return rows;
}

function buildInput(row: FacilityCsvRow): SaveServiceFacilityInput | undefined {
  const zip = row.zip4 ? `${row.zip}-${row.zip4}` : row.zip;
  const candidate = {
    name: row.name,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2 || undefined,
    city: row.city,
    state: row.state,
    zip,
    npi: row.npi || undefined,
    clia: row.clia || undefined,
    posCode: row.posCode || undefined,
  };

  const result = SaveServiceFacilityInputSchema.safeParse(candidate);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    console.log(`   ❌ Line ${row.lineNumber} ("${row.name}") is invalid — ${problems}`);
    return undefined;
  }
  return result.data;
}

async function fetchExistingFacilities(oystehr: Oystehr): Promise<Location[]> {
  console.log('🔍 Fetching existing active service facilities...');
  const pageSize = 1000;
  const facilities: Location[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const bundle = await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        { name: 'status', value: 'active' },
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
    });
    const page = bundle.unbundle();
    facilities.push(...page);
    if (page.length < pageSize) break;
  }
  console.log(`   Found ${facilities.length} existing facilities\n`);
  return facilities;
}

async function promptForCredentials(): Promise<{ projectId: string; accessToken: string }> {
  let projectId = process.env.OYSTEHR_PROJECT_ID ?? '';
  let accessToken = process.env.OYSTEHR_ACCESS_TOKEN ?? '';
  if (projectId && accessToken) {
    console.log('🔑 Using credentials from OYSTEHR_PROJECT_ID / OYSTEHR_ACCESS_TOKEN\n');
    return { projectId, accessToken };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (!projectId) projectId = (await rl.question('Oystehr project ID: ')).trim();
    if (!accessToken) accessToken = (await rl.question('Oystehr access token: ')).trim();
  } finally {
    rl.close();
  }

  if (!projectId || !accessToken) {
    console.error('❌ Project ID and access token are both required');
    process.exit(1);
  }
  return { projectId, accessToken };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');
  const csvPath = args[0];

  if (!csvPath) {
    console.error('Usage: npm run import-service-facilities -- <csv-path> [--dry-run]');
    console.error('CSV columns: Facility Name,NPI,CLIA,Address 1,Address 2,City,State,Zip,Zip4,Type');
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsv)) {
    console.error(`❌ CSV file not found: ${resolvedCsv}`);
    process.exit(1);
  }

  const rows = parseFacilitiesCsv(resolvedCsv);
  if (rows.length === 0) return;

  const existingByName = new Map<string, Location>();
  const npiUsage = new Map<string, string>();
  let oystehr: Oystehr | undefined;

  if (dryRun) {
    console.log('🧪 Dry run — validating offline, no resources will be created\n');
  } else {
    const { projectId, accessToken } = await promptForCredentials();

    // workspaceTag scopes searches to billing resources and auto-tags created ones,
    // matching how the billing app zambdas read/write service facilities.
    oystehr = new Oystehr({
      accessToken,
      projectId,
      workspaceTag: BILLING_RESOURCE_TAG,
    });

    const existing = await fetchExistingFacilities(oystehr);
    for (const location of existing) {
      const item = mapServiceFacility(location);
      if (item.name.trim()) existingByName.set(item.name.trim().toLowerCase(), location);
      if (item.npi) npiUsage.set(item.npi, item.name);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}] ${row.name}`);

    const input = buildInput(row);
    if (!input) {
      invalidCount++;
      continue;
    }

    const duplicate = existingByName.get(input.name.toLowerCase());
    if (duplicate) {
      console.log(`   ⏭️  Already exists (Location/${duplicate.id}) — skipping`);
      skippedCount++;
      continue;
    }

    // The billing UI enforces one active facility per NPI; group NPIs shared across
    // facilities are flagged but still imported.
    if (input.npi && npiUsage.has(input.npi)) {
      console.log(`   ⚠️  NPI ${input.npi} is also used by "${npiUsage.get(input.npi)}"`);
    }

    if (dryRun || !oystehr) {
      console.log(`   🧪 Would create: ${JSON.stringify(input)}`);
    } else {
      const created = await oystehr.fhir.create<Location>(applyServiceFacilityInput(input));
      console.log(`   ✅ Created Location/${created.id}`);
    }

    existingByName.set(input.name.toLowerCase(), { resourceType: 'Location' });
    if (input.npi) npiUsage.set(input.npi, input.name);
    createdCount++;
  }

  console.log('\n──────── Summary ────────');
  console.log(`${dryRun ? 'Would create' : 'Created'}: ${createdCount}`);
  console.log(`Skipped (already exist): ${skippedCount}`);
  console.log(`Invalid rows: ${invalidCount}`);
  if (invalidCount > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('❌ Import failed:', error);
  process.exit(1);
});

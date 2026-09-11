// Import rendering provider Practitioners from a CSV into FHIR.
//
// CSV columns: Provider NPI,First Name,Last Name,Taxonomy Code,License Type
//
// Usage:
//   cd packages/zambdas
//   npm run import-rendering-providers -- <csv-path> [--dry-run]
//
// Credentials come from OYSTEHR_PROJECT_ID / OYSTEHR_ACCESS_TOKEN env vars, or you
// will be prompted for them. The token must be an Oystehr developer/M2M access token
// with FHIR Practitioner write access.

import * as readline from 'node:readline/promises';
import Oystehr from '@oystehr/sdk';
import { Organization, Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import { getNPI } from 'utils/lib/fhir/helpers';
import {
  CreateBillingProviderInput,
  CreateBillingProviderInputSchema,
} from 'utils/lib/types/data/billing/billing.schemas';
import { buildProvider } from '../billing/create-billing-provider';
import {
  EXCLUDE_WORKING_COPIES_PARAMS,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
} from '../billing/shared';

interface RenderingProviderCsvRow {
  lineNumber: number;
  npi: string;
  firstName: string;
  lastName: string;
  taxonomyCode: string;
  licenseType: string;
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

function parseRenderingProvidersCsv(csvPath: string): RenderingProviderCsvRow[] {
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

  const rows: RenderingProviderCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const firstName = cols[1] || '';
    const lastName = cols[2] || '';
    if (!firstName && !lastName) continue;

    rows.push({
      lineNumber: i + 1,
      npi: cols[0] || '',
      firstName,
      lastName,
      taxonomyCode: cols[3] || '',
      licenseType: cols[4] || '',
    });
  }

  console.log(`✅ Parsed ${rows.length} rendering providers from CSV\n`);
  return rows;
}

function buildInput(row: RenderingProviderCsvRow): CreateBillingProviderInput | undefined {
  const candidate = {
    kind: 'individual' as const,
    firstName: row.firstName,
    lastName: row.lastName,
    roles: ['rendering' as const],
    npi: row.npi || undefined,
    taxonomyCode: row.taxonomyCode || undefined,
    licenseType: row.licenseType || undefined,
  };

  const result = CreateBillingProviderInputSchema.safeParse(candidate);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    console.log(`   ❌ Line ${row.lineNumber} ("${row.firstName} ${row.lastName}") is invalid — ${problems}`);
    return undefined;
  }
  return result.data;
}

function fullNameKey(firstName: string, lastName: string): string {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}`;
}

// Any practitioner already tagged with a provider role (billing or rendering) counts as existing.
async function fetchExistingProviderPractitioners(oystehr: Oystehr): Promise<Practitioner[]> {
  console.log('🔍 Fetching existing provider practitioners...');
  const pageSize = 1000;
  const practitioners: Practitioner[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const bundle = await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        {
          name: '_tag',
          value: `${PROVIDER_ROLE_TAG}|${PROVIDER_ROLE_BILLING},${PROVIDER_ROLE_TAG}|${PROVIDER_ROLE_RENDERING}`,
        },
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
    });
    const page = bundle.unbundle();
    practitioners.push(...page);
    if (page.length < pageSize) break;
  }
  console.log(`   Found ${practitioners.length} existing provider practitioners\n`);
  return practitioners;
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
    console.error('Usage: npm run import-rendering-providers -- <csv-path> [--dry-run]');
    console.error('CSV columns: Provider NPI,First Name,Last Name,Taxonomy Code,License Type');
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsv)) {
    console.error(`❌ CSV file not found: ${resolvedCsv}`);
    process.exit(1);
  }

  const rows = parseRenderingProvidersCsv(resolvedCsv);
  if (rows.length === 0) return;

  const existingByNpi = new Map<string, Practitioner>();
  const existingByName = new Map<string, Practitioner>();
  let oystehr: Oystehr | undefined;

  if (dryRun) {
    console.log('🧪 Dry run — validating offline, no resources will be created\n');
  } else {
    const { projectId, accessToken } = await promptForCredentials();

    // workspaceTag scopes searches to billing resources and auto-tags created ones,
    // matching how the billing app zambdas read/write providers.
    oystehr = new Oystehr({
      accessToken,
      projectId,
      workspaceTag: BILLING_RESOURCE_TAG,
    });

    const existing = await fetchExistingProviderPractitioners(oystehr);
    for (const practitioner of existing) {
      const npi = getNPI(practitioner);
      if (npi) existingByNpi.set(npi, practitioner);
      const name = practitioner.name?.[0];
      // Join all given names to match how mapProvider/export-billing-providers render first names.
      const first = name?.given?.join(' ') ?? '';
      const last = name?.family ?? '';
      if (first || last) existingByName.set(fullNameKey(first, last), practitioner);
    }
  }

  let createdCount = 0;
  let skippedCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    console.log(`[${i + 1}/${rows.length}] ${row.firstName} ${row.lastName}`);

    const input = buildInput(row);
    if (!input || input.kind !== 'individual') {
      invalidCount++;
      continue;
    }

    const duplicate =
      (input.npi && existingByNpi.get(input.npi)) || existingByName.get(fullNameKey(input.firstName, input.lastName));
    if (duplicate) {
      console.log(`   ⏭️  Already exists (Practitioner/${duplicate.id}) — skipping`);
      skippedCount++;
      continue;
    }

    if (dryRun || !oystehr) {
      console.log(`   🧪 Would create: ${JSON.stringify(input)}`);
    } else {
      const created = await oystehr.fhir.create<Practitioner | Organization>(
        buildProvider({ ...input, secrets: null })
      );
      console.log(`   ✅ Created Practitioner/${created.id}`);
    }

    const placeholder: Practitioner = { resourceType: 'Practitioner' };
    if (input.npi) existingByNpi.set(input.npi, placeholder);
    existingByName.set(fullNameKey(input.firstName, input.lastName), placeholder);
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

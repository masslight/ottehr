// Import billing provider Organizations from a CSV into FHIR.
//
// CSV columns: Provider NPI,Organization Name,Tax ID,Taxonomy Code,Address 1,Address 2,City,State,Zip Code,Zip Plus Four Code
//
// Usage:
//   cd packages/zambdas
//   npm run import-billing-orgs -- <csv-path> [--dry-run]
//
// Credentials come from OYSTEHR_PROJECT_ID / OYSTEHR_ACCESS_TOKEN env vars, or you
// will be prompted for them. The token must be an Oystehr developer/M2M access token
// with FHIR Organization write access.

import * as readline from 'node:readline/promises';
import Oystehr from '@oystehr/sdk';
import { Organization, Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
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

interface BillingOrgCsvRow {
  lineNumber: number;
  npi: string;
  name: string;
  taxId: string;
  taxonomyCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  zip4: string;
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

function parseBillingOrgsCsv(csvPath: string): BillingOrgCsvRow[] {
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

  const rows: BillingOrgCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const name = cols[1] || '';
    if (!name) continue;

    rows.push({
      lineNumber: i + 1,
      npi: cols[0] || '',
      name,
      taxId: cols[2] || '',
      taxonomyCode: cols[3] || '',
      addressLine1: cols[4] || '',
      addressLine2: cols[5] || '',
      city: cols[6] || '',
      state: (cols[7] || '').trim().toUpperCase(),
      zip: cols[8] || '',
      zip4: cols[9] || '',
    });
  }

  console.log(`✅ Parsed ${rows.length} billing organizations from CSV\n`);
  return rows;
}

function buildInput(row: BillingOrgCsvRow): CreateBillingProviderInput | undefined {
  const postalCode = row.zip4 ? `${row.zip}-${row.zip4}` : row.zip || undefined;
  const hasAddress = Boolean(row.addressLine1 || row.city || row.state || postalCode);
  const candidate = {
    kind: 'organization' as const,
    name: row.name,
    roles: ['billing' as const],
    npi: row.npi || undefined,
    taxId: row.taxId || undefined,
    taxonomyCode: row.taxonomyCode || undefined,
    address: hasAddress
      ? {
          line1: row.addressLine1 || undefined,
          line2: row.addressLine2 || undefined,
          city: row.city || undefined,
          state: row.state || undefined,
          postalCode,
        }
      : undefined,
  };

  const result = CreateBillingProviderInputSchema.safeParse(candidate);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    console.log(`   ❌ Line ${row.lineNumber} ("${row.name}") is invalid — ${problems}`);
    return undefined;
  }
  return result.data;
}

// Any org already tagged with a provider role (billing or rendering) counts as existing.
async function fetchExistingProviderOrgs(oystehr: Oystehr): Promise<Organization[]> {
  console.log('🔍 Fetching existing billing provider organizations...');
  const pageSize = 1000;
  const organizations: Organization[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const bundle = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
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
    organizations.push(...page);
    if (page.length < pageSize) break;
  }
  console.log(`   Found ${organizations.length} existing provider organizations\n`);
  return organizations;
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
    console.error('Usage: npm run import-billing-orgs -- <csv-path> [--dry-run]');
    console.error(
      'CSV columns: Provider NPI,Organization Name,Tax ID,Taxonomy Code,Address 1,Address 2,City,State,Zip Code,Zip Plus Four Code'
    );
    process.exit(1);
  }

  const resolvedCsv = path.resolve(csvPath);
  if (!fs.existsSync(resolvedCsv)) {
    console.error(`❌ CSV file not found: ${resolvedCsv}`);
    process.exit(1);
  }

  const rows = parseBillingOrgsCsv(resolvedCsv);
  if (rows.length === 0) return;

  const existingByName = new Map<string, Organization>();
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

    const existing = await fetchExistingProviderOrgs(oystehr);
    for (const org of existing) {
      if (org.name?.trim()) existingByName.set(org.name.trim().toLowerCase(), org);
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
      console.log(`   ⏭️  Already exists (Organization/${duplicate.id}) — skipping`);
      skippedCount++;
      continue;
    }

    if (dryRun || !oystehr) {
      console.log(`   🧪 Would create: ${JSON.stringify(input)}`);
    } else {
      const created = await oystehr.fhir.create<Organization | Practitioner>(
        buildProvider({ ...input, secrets: null })
      );
      console.log(`   ✅ Created Organization/${created.id}`);
    }

    existingByName.set(input.name.toLowerCase(), { resourceType: 'Organization' });
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

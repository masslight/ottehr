// Export active billing provider Practitioners to a CSV in the rendering-providers import format:
//   Provider NPI,First Name,Last Name,Taxonomy Code,License Type
//
// Taxonomy is looked up in the CMS NPI Registry (primary taxonomy only); falls back to the
// taxonomy stored in FHIR when the registry has no match.
//
// Usage:
//   cd packages/zambdas
//   npm run export-billing-providers -- [output.csv]
//
// Credentials come from OYSTEHR_PROJECT_ID / OYSTEHR_ACCESS_TOKEN env vars, or you
// will be prompted for them.

import * as readline from 'node:readline/promises';
import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
import { BILLING_RESOURCE_TAG } from 'utils/lib/fhir/constants';
import {
  EXCLUDE_WORKING_COPIES_PARAMS,
  mapProvider,
  PROVIDER_ROLE_BILLING,
  PROVIDER_ROLE_RENDERING,
  PROVIDER_ROLE_TAG,
} from '../billing/shared';

const NPI_REGISTRY_URL = 'https://npiregistry.cms.hhs.gov/api/';

async function fetchActivePractitioners(oystehr: Oystehr): Promise<Practitioner[]> {
  console.log('🔍 Fetching active provider practitioners...');
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
        { name: 'active', value: 'true' },
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        ...EXCLUDE_WORKING_COPIES_PARAMS,
      ],
    });
    const page = bundle.unbundle();
    practitioners.push(...page);
    if (page.length < pageSize) break;
  }
  console.log(`   Found ${practitioners.length} active provider practitioners\n`);
  return practitioners;
}

// Returns the primary taxonomy code from the CMS NPI Registry, or undefined when unavailable.
async function lookupPrimaryTaxonomy(npi: string): Promise<string | undefined> {
  try {
    const url = `${NPI_REGISTRY_URL}?version=2.1&number=${encodeURIComponent(npi)}`;
    const response = await fetch(url);
    if (!response.ok) {
      console.log(`   ⚠️  NPI registry returned ${response.status} for ${npi}`);
      return undefined;
    }
    const data = (await response.json()) as {
      result_count?: number;
      results?: { taxonomies?: { code?: string; primary?: boolean }[] }[];
    };
    const taxonomies = data.results?.[0]?.taxonomies ?? [];
    if (taxonomies.length === 0) return undefined;
    return (taxonomies.find((t) => t.primary) ?? taxonomies[0]).code;
  } catch (error) {
    console.log(`   ⚠️  NPI registry lookup failed for ${npi}: ${(error as Error).message}`);
    return undefined;
  }
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
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
  const outputPath = path.resolve(process.argv[2] ?? 'active-providers-export.csv');

  const { projectId, accessToken } = await promptForCredentials();
  const oystehr = new Oystehr({
    accessToken,
    projectId,
    workspaceTag: BILLING_RESOURCE_TAG,
  });

  const practitioners = await fetchActivePractitioners(oystehr);
  const providers = practitioners
    .map(mapProvider)
    .filter((p) => p.kind === 'individual')
    .sort((a, b) => a.name.localeCompare(b.name));

  const lines = ['Provider NPI,First Name,Last Name,Taxonomy Code,License Type'];
  let registryHits = 0;
  let registryMisses = 0;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (provider.kind !== 'individual') continue;
    console.log(`[${i + 1}/${providers.length}] ${provider.name}`);

    let taxonomy = '';
    if (provider.npi) {
      const registryTaxonomy = await lookupPrimaryTaxonomy(provider.npi);
      if (registryTaxonomy) {
        taxonomy = registryTaxonomy;
        registryHits++;
        console.log(`   📇 NPI registry primary taxonomy: ${taxonomy}`);
      } else {
        registryMisses++;
      }
      // Be polite to the public registry API
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    if (!taxonomy && provider.taxonomyCode) {
      taxonomy = provider.taxonomyCode;
      console.log(`   💾 Using taxonomy stored in FHIR: ${taxonomy}`);
    }

    lines.push(
      [provider.npi, provider.firstName, provider.lastName, taxonomy, provider.licenseType ?? '']
        .map((value) => csvField(value ?? ''))
        .join(',')
    );
  }

  fs.writeFileSync(outputPath, lines.join('\n') + '\n', 'utf8');

  console.log('\n──────── Summary ────────');
  console.log(`Exported: ${lines.length - 1} providers`);
  console.log(`NPI registry taxonomy found: ${registryHits}`);
  console.log(`NPI registry misses (fell back to FHIR or blank): ${registryMisses}`);
  console.log(`📄 Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error('❌ Export failed:', error);
  process.exit(1);
});

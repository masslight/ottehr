import Oystehr from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RoleType } from 'utils';

const FHIR_IDENTIFIER_NPI = 'http://hl7.org/fhir/sid/us-npi';
const PRACTITIONER_QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';
const PROVIDER_TYPE_EXTENSION_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/provider-type';

const CSV_COLUMNS = [
  'First Name',
  'Last Name',
  'NPI',
  'DOB',
  'Employment Start Date',
  'Primary Taxonomy',
  'Other Taxonomy',
  'Licence Number',
  'License State',
  'Licence Type',
  'DEA Number',
  'DEA State',
  'PTAN',
  'Medicaid ID',
  'Medicaid ID State',
];

interface EnvConfig {
  PROJECT_ID: string;
  DEVELOPER_TOKEN: string;
  FHIR_API: string;
}

function loadEnvConfig(env: string): EnvConfig {
  const configPath = `../../config/.env/${env}.json`;

  if (!fs.existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const missing = ['PROJECT_ID', 'DEVELOPER_TOKEN', 'FHIR_API'].filter((key) => !raw[key]);
  if (missing.length > 0) {
    console.error(`❌ Missing required config values in ${configPath}: ${missing.join(', ')}`);
    process.exit(1);
  }

  return raw as EnvConfig;
}

const BATCH_SIZE = 50;

async function getProviderPractitionerIds(oystehr: Oystehr): Promise<string[]> {
  // Find the Provider role
  const roles = await oystehr.role.list();
  const providerRole = roles.find((r) => r.name === RoleType.Provider);
  if (!providerRole) {
    console.error('❌ No "Provider" role found in this environment.');
    process.exit(1);
  }
  console.log(`Found Provider role: ${providerRole.id}`);

  // Paginate through all members of the Provider role
  const members: { id: string; profile?: string }[] = [];
  let cursor: string | null = '';
  do {
    const response: Awaited<ReturnType<typeof oystehr.user.listV2>> = await oystehr.user.listV2({
      cursor,
      limit: 100,
      roleId: providerRole.id,
      sort: 'name',
    });
    members.push(...response.data);
    cursor = response.metadata.nextCursor;
  } while (cursor !== null);

  console.log(`Found ${members.length} users with Provider role.`);

  // Extract Practitioner IDs from the profile field (e.g. "Practitioner/abc-123")
  const practitionerIds = members
    .filter((m) => m.profile?.startsWith('Practitioner/'))
    .map((m) => m.profile!.split('/')[1]);

  return practitionerIds;
}

async function fetchPractitionersByIds(oystehr: Oystehr, ids: string[]): Promise<Practitioner[]> {
  if (ids.length === 0) return [];

  const all: Practitioner[] = [];

  // Fetch in batches since _id lists can be long
  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batch = ids.slice(i, i + BATCH_SIZE);
    const bundle = await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [{ name: '_id', value: batch.join(',') }],
    });
    const practitioners = bundle.unbundle().filter((r) => r.resourceType === 'Practitioner') as Practitioner[];
    all.push(...practitioners);
    console.log(`  Fetched ${all.length} practitioners so far...`);
  }

  return all;
}

function hasNPI(practitioner: Practitioner): boolean {
  return !!practitioner.identifier?.some((id) => id.system === FHIR_IDENTIFIER_NPI && id.value);
}

function getNPI(practitioner: Practitioner): string {
  return practitioner.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value ?? '';
}

interface NpiTaxonomy {
  primary: string;
  other: string;
}

const NPI_REGISTRY_BASE = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';

async function lookupNpiTaxonomies(npis: string[]): Promise<Map<string, NpiTaxonomy>> {
  const result = new Map<string, NpiTaxonomy>();

  for (const npi of npis) {
    try {
      const url = `${NPI_REGISTRY_BASE}&number=${encodeURIComponent(npi)}`;
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`  ⚠️  NPI Registry returned ${response.status} for NPI ${npi}`);
        continue;
      }
      const data = (await response.json()) as any;
      const results = data.results;
      if (!results || results.length === 0) {
        console.warn(`  ⚠️  No NPI Registry results for NPI ${npi}`);
        continue;
      }

      const taxonomies: any[] = results[0].taxonomies ?? [];
      const primaryTax = taxonomies.find((t: any) => t.primary === true);
      const otherTaxes = taxonomies.filter((t: any) => !t.primary);

      result.set(npi, {
        primary: primaryTax?.code ?? '',
        other: otherTaxes.map((t: any) => t.code).join('; '),
      });
    } catch (err) {
      console.warn(`  ⚠️  Error looking up NPI ${npi}:`, err);
    }
  }

  return result;
}

function extractProviderRow(practitioner: Practitioner, taxonomyMap: Map<string, NpiTaxonomy>): string[] {
  const name = practitioner.name?.[0];
  const firstName = name?.given?.join(' ') ?? '';
  const lastName = name?.family ?? '';

  // NPI
  const npi = practitioner.identifier?.find((id) => id.system === FHIR_IDENTIFIER_NPI)?.value ?? '';

  // DOB
  const dob = practitioner.birthDate ?? '';

  // Qualifications — first one is "primary", extract license details from it
  const qualifications = practitioner.qualification ?? [];

  // Provider Type from extension (used as Licence Type)
  const providerTypeExt = practitioner.extension?.find((e) => e.url === PROVIDER_TYPE_EXTENSION_URL);
  const licenceType = providerTypeExt?.valueCodeableConcept?.coding?.[0]?.code ?? '';

  // Extract license info from the first qualification's extension
  let licenceNumber = '';
  let licenseState = '';
  const primaryQual = qualifications[0];
  if (primaryQual) {
    const qualExt = primaryQual.extension?.find((e) => e.url === PRACTITIONER_QUALIFICATION_EXTENSION_URL);
    if (qualExt?.extension) {
      licenceNumber = qualExt.extension.find((e) => e.url === 'number')?.valueString ?? '';
      licenseState =
        qualExt.extension.find((e) => e.url === 'whereValid')?.valueCodeableConcept?.coding?.[0]?.code ?? '';
    }
  }

  // Taxonomy from NPI Registry
  const taxonomy = taxonomyMap.get(npi);
  const primaryTaxonomy = taxonomy?.primary ?? '';
  const otherTaxonomy = taxonomy?.other ?? '';

  // Employment Start Date — not currently stored, leave blank
  const employmentStartDate = '';

  // DEA — not currently stored, leave blank
  const deaNumber = '';
  const deaState = '';

  // PTAN — not currently stored, leave blank
  const ptan = '';

  // Medicaid — not currently stored, leave blank
  const medicaidId = '';
  const medicaidIdState = '';

  return [
    firstName,
    lastName,
    npi,
    dob,
    employmentStartDate,
    primaryTaxonomy,
    otherTaxonomy,
    licenceNumber,
    licenseState,
    licenceType,
    deaNumber,
    deaState,
    ptan,
    medicaidId,
    medicaidIdState,
  ];
}

function escapeCsvField(field: string): string {
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}

function buildCsv(practitioners: Practitioner[], taxonomyMap: Map<string, NpiTaxonomy>): string {
  const header = CSV_COLUMNS.map(escapeCsvField).join(',');
  const rows = practitioners.map((p) => extractProviderRow(p, taxonomyMap).map(escapeCsvField).join(','));
  return [header, ...rows].join('\n');
}

const CANDID_COLUMNS = [
  'npi',
  'renders_medical_services',
  'bills_medical_services',
  'tax_id',
  'taxonomy_code',
  'license_type',
  'address_1',
  'address_2',
  'city',
  'state',
  'zip_code',
  'zip_plus_four_code',
  'ptan',
  'ptan_state',
  'medicaid_id',
  'medicaid_id_state',
  'employment_start_date',
  'employment_term_date',
  'first_name',
  'last_name',
  'organization_name',
];

function extractCandidRow(practitioner: Practitioner, taxonomyMap: Map<string, NpiTaxonomy>): string[] {
  const name = practitioner.name?.[0];
  const firstName = name?.given?.join(' ') ?? '';
  const lastName = name?.family ?? '';
  const npi = getNPI(practitioner);

  const providerTypeExt = practitioner.extension?.find((e) => e.url === PROVIDER_TYPE_EXTENSION_URL);
  const licenseType = providerTypeExt?.valueCodeableConcept?.coding?.[0]?.code ?? '';

  const taxonomy = taxonomyMap.get(npi);
  const taxonomyCode = taxonomy?.primary ?? '';

  return [
    npi,
    'y', // renders_medical_services
    'n', // bills_medical_services
    '', // tax_id
    taxonomyCode,
    licenseType,
    '', // address_1
    '', // address_2
    '', // city
    '', // state
    '', // zip_code
    '', // zip_plus_four_code
    '', // ptan
    '', // ptan_state
    '', // medicaid_id
    '', // medicaid_id_state
    '', // employment_start_date
    '', // employment_term_date
    firstName,
    lastName,
    '', // organization_name
  ];
}

function buildCandidCsv(practitioners: Practitioner[], taxonomyMap: Map<string, NpiTaxonomy>): string {
  const header = CANDID_COLUMNS.map(escapeCsvField).join(',');
  const rows = practitioners.map((p) => extractCandidRow(p, taxonomyMap).map(escapeCsvField).join(','));
  return [header, ...rows].join('\n');
}

async function main(): Promise<void> {
  const env = process.argv[2];

  if (!env) {
    console.log('Usage: npm run export-rendering-providers <env>');
    console.log('  <env>  Environment name (e.g. local, staging, production)');
    process.exit(0);
  }

  console.log(`📤 Starting export-rendering-providers for environment: ${env}`);

  const config = loadEnvConfig(env);

  const oystehr = new Oystehr({
    accessToken: config.DEVELOPER_TOKEN,
    projectId: config.PROJECT_ID,
    fhirApiUrl: config.FHIR_API.replace(/\/r4/g, ''),
  });

  console.log('Finding users with Provider role...');
  const practitionerIds = await getProviderPractitionerIds(oystehr);

  if (practitionerIds.length === 0) {
    console.log('No provider practitioners found. Nothing to export.');
    return;
  }

  console.log(`Fetching ${practitionerIds.length} Practitioner resources...`);
  const allPractitioners = await fetchPractitionersByIds(oystehr, practitionerIds);

  const practitioners = allPractitioners.filter(hasNPI);
  console.log(`${practitioners.length} of ${allPractitioners.length} practitioners have an NPI.`);

  if (practitioners.length === 0) {
    console.log('No practitioners found. Nothing to export.');
    return;
  }

  const npis = practitioners.map(getNPI).filter(Boolean);
  console.log(`Looking up ${npis.length} NPIs in CMS NPI Registry...`);
  const taxonomyMap = await lookupNpiTaxonomies(npis);
  console.log(`Got taxonomy data for ${taxonomyMap.size} of ${npis.length} NPIs.`);

  const csv = buildCsv(practitioners, taxonomyMap);
  const outputPath = path.join(os.homedir(), 'Downloads', `rendering-providers-${env}.csv`);
  fs.writeFileSync(outputPath, csv, 'utf8');
  console.log(`📄 CSV written to ${outputPath}`);

  const candidCsv = buildCandidCsv(practitioners, taxonomyMap);
  const candidOutputPath = path.join(os.homedir(), 'Downloads', `rendering-providers-${env}-candid-import.csv`);
  fs.writeFileSync(candidOutputPath, candidCsv, 'utf8');
  console.log(`📄 Candid import CSV written to ${candidOutputPath}`);
}

main()
  .then(() => console.log('\n✅ Done.'))
  .catch((error) => {
    console.error(error);
    throw error;
  });

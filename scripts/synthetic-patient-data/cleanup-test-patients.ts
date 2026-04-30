/**
 * cleanup-test-patients.ts — delete test patients and their related resources.
 *
 * Finds Patients matching --email or --identifier and deletes them along with
 * everything that references them: Appointments, Encounters, Coverages,
 * RelatedPersons, QuestionnaireResponses, AllergyIntolerances,
 * MedicationStatements, Conditions, Observations, Communications.
 *
 * Defaults to dry-run. Requires --execute to actually delete.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-test-patients.ts \
 *     --email jane.doe.synth@example.com [--execute]
 *
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/cleanup-test-patients.ts \
 *     --identifier 'https://fhir.ottehr.com/sid/synthetic-patient-id|jane-doe-1990-05-15' [--execute]
 *
 * Env (required): AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE,
 * PROJECT_ID, PROJECT_API.
 */
import Oystehr from '@oystehr/sdk';
import type { Patient, Resource } from 'fhir/r4b';

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}

const email = getFlag('--email');
const identifier = getFlag('--identifier');
const isExecute = args.includes('--execute');

if (!email && !identifier) {
  console.error('Usage: tsx cleanup-test-patients.ts --email <email> | --identifier <system|value> [--execute]');
  process.exit(1);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function createOystehr(): Promise<Oystehr> {
  const tokenRes = await fetch(requireEnv('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: requireEnv('AUTH0_CLIENT'),
      client_secret: requireEnv('AUTH0_SECRET'),
      audience: requireEnv('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`Auth0 failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return new Oystehr({
    accessToken: access_token,
    projectId: requireEnv('PROJECT_ID'),
    services: { projectApiUrl: requireEnv('PROJECT_API') },
  });
}

// Resource types that point to a Patient, with the search param to use.
// Order: clinical data first, then visit infrastructure, Patient last.
const RELATED_TYPES: Array<{ resourceType: string; param: string }> = [
  { resourceType: 'AllergyIntolerance', param: 'patient' },
  { resourceType: 'MedicationStatement', param: 'subject' },
  { resourceType: 'Condition', param: 'subject' },
  { resourceType: 'Observation', param: 'subject' },
  { resourceType: 'Communication', param: 'subject' },
  { resourceType: 'QuestionnaireResponse', param: 'subject' },
  { resourceType: 'Coverage', param: 'beneficiary' },
  { resourceType: 'RelatedPerson', param: 'patient' },
  { resourceType: 'Encounter', param: 'subject' },
  { resourceType: 'Appointment', param: 'actor' },
];

async function findRelatedResources(oystehr: Oystehr, patientId: string): Promise<Resource[]> {
  const all: Resource[] = [];
  for (const { resourceType, param } of RELATED_TYPES) {
    try {
      const result = await oystehr.fhir.search({
        resourceType: resourceType as Parameters<typeof oystehr.fhir.search>[0]['resourceType'],
        params: [
          { name: param, value: `Patient/${patientId}` },
          { name: '_count', value: '500' },
        ],
      });
      all.push(...result.unbundle());
    } catch (err) {
      console.warn(
        `  warn: search ${resourceType}?${param}=Patient/${patientId} failed: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }
  return all;
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${requireEnv('PROJECT_ID')}`);
  console.log(`Match: ${email ? `email="${email}"` : `identifier="${identifier}"`}`);
  console.log('');

  const oystehr = await createOystehr();

  // Find target Patients
  const params: Array<{ name: string; value: string }> = [{ name: '_count', value: '100' }];
  if (email) params.push({ name: 'email', value: email });
  if (identifier) params.push({ name: 'identifier', value: identifier });
  const patientResult = await oystehr.fhir.search<Patient>({ resourceType: 'Patient', params });
  const patients = patientResult.unbundle();
  console.log(`Found ${patients.length} matching Patients.`);
  if (patients.length === 0) return;

  let totalDeleted = 0;
  let totalFailed = 0;

  for (const patient of patients) {
    if (!patient.id) continue;
    console.log('');
    console.log(`── Patient ${patient.id}`);
    const related = await findRelatedResources(oystehr, patient.id);
    const byType: Record<string, number> = {};
    for (const r of related) byType[r.resourceType] = (byType[r.resourceType] ?? 0) + 1;
    for (const [t, n] of Object.entries(byType)) console.log(`  ${t}: ${n}`);

    if (!isExecute) {
      console.log(`  (dry-run — would delete ${related.length} related resource(s) + the Patient)`);
      continue;
    }

    // Delete related first
    for (const r of related) {
      try {
        await oystehr.fhir.delete({ resourceType: r.resourceType as 'Patient', id: r.id! });
        totalDeleted += 1;
      } catch (err) {
        console.warn(`  ✗ delete ${r.resourceType}/${r.id} failed: ${err instanceof Error ? err.message : err}`);
        totalFailed += 1;
      }
    }
    // Then the Patient
    try {
      await oystehr.fhir.delete({ resourceType: 'Patient', id: patient.id });
      totalDeleted += 1;
      console.log(`  ✓ deleted Patient ${patient.id} + ${related.length} related`);
    } catch (err) {
      console.warn(`  ✗ delete Patient/${patient.id} failed: ${err instanceof Error ? err.message : err}`);
      totalFailed += 1;
    }
  }

  console.log('');
  console.log(`-- summary --`);
  console.log(`Patients matched: ${patients.length}`);
  console.log(`Resources deleted: ${totalDeleted}`);
  console.log(`Failures: ${totalFailed}`);
  if (!isExecute) console.log('Dry-run only. Re-run with --execute to actually delete.');
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});

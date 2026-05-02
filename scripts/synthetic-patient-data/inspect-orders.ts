/**
 * inspect-orders.ts — quick inspector for ServiceRequest / MedicationAdministration /
 * MedicationStatement attached to a specific Encounter. Useful to verify what the
 * synthesizer actually wrote (vs what got silently dropped/filtered out by the EHR).
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/inspect-orders.ts <encounterId>
 */
import Oystehr from '@oystehr/sdk';

const encounterId = process.argv[2];
if (!encounterId) {
  console.error('Usage: tsx inspect-orders.ts <encounterId>');
  process.exit(1);
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

async function main(): Promise<void> {
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

  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: requireEnv('PROJECT_ID'),
    services: { projectApiUrl: requireEnv('PROJECT_API') },
  });

  console.log(`Inspecting encounter ${encounterId}\n`);

  console.log('=== ServiceRequest (radiology + in-house labs) ===');
  const sr = (
    await oystehr.fhir.search({
      resourceType: 'ServiceRequest',
      params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  for (const r of sr) {
    const x = r as any;
    console.log(`  id=${x.id}`);
    console.log(`    status=${x.status} intent=${x.intent}`);
    console.log(`    category=${JSON.stringify(x.category)}`);
    console.log(`    code.text=${x.code?.text}`);
    console.log(`    meta.tag=${JSON.stringify(x.meta?.tag)}`);
  }

  console.log('\n=== MedicationAdministration (by encounter context) ===');
  const ma = (
    await oystehr.fhir.search({
      resourceType: 'MedicationAdministration',
      params: [{ name: 'context', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  for (const r of ma) {
    const x = r as any;
    console.log(`  id=${x.id}`);
    console.log(`    status=${x.status}`);
    console.log(`    meta.tag=${JSON.stringify(x.meta?.tag)}`);
    console.log(`    context=${JSON.stringify(x.context)}`);
    console.log(`    medicationReference=${JSON.stringify(x.medicationReference)}`);
  }

  console.log('\n=== MedicationRequest (by encounter) ===');
  const mr = (
    await oystehr.fhir.search({
      resourceType: 'MedicationRequest',
      params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  for (const r of mr) {
    const x = r as any;
    console.log(`  id=${x.id}`);
    console.log(`    status=${x.status}`);
    console.log(`    meta.tag=${JSON.stringify(x.meta?.tag)}`);
    console.log(`    encounter=${JSON.stringify(x.encounter)}`);
    console.log(`    contained med=${JSON.stringify(x.contained?.[0]?.code)}`);
  }

  console.log('\n=== MedicationStatement ===');
  const ms = (
    await oystehr.fhir.search({
      resourceType: 'MedicationStatement',
      params: [{ name: 'context', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  for (const r of ms) {
    const x = r as any;
    console.log(`  id=${x.id}`);
    console.log(`    status=${x.status}`);
    console.log(`    meta.tag=${JSON.stringify(x.meta?.tag)}`);
  }

  console.log('\n=== Lookup specific reported IDs ===');
  for (const id of ['2386f35a-c120-432f-80b0-58d151501fdc']) {
    try {
      const r = (await oystehr.fhir.get({ resourceType: 'ServiceRequest', id })) as any;
      console.log(`  ServiceRequest/${id}`);
      console.log(`    status=${r.status} intent=${r.intent}`);
      console.log(`    category=${JSON.stringify(r.category)}`);
      console.log(`    code=${JSON.stringify(r.code)}`);
      console.log(`    encounter=${JSON.stringify(r.encounter)}`);
      console.log(`    meta.tag=${JSON.stringify(r.meta?.tag)}`);
      console.log(`    extension=${JSON.stringify(r.extension)}`);
    } catch {
      console.log(`  not found: ${id}`);
    }
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

/**
 * patch-medication-erx.ts — patch in-house formulary Medications to add a
 * MediSpan dispensable-drug-id coding so the create-update-medication-order
 * zambda can transition orders to "administered" status (which creates a
 * MedicationStatement that requires the ERX coding).
 *
 * The synthetic synth project uses dummy ERX codes derived from the medication
 * name — they're for demo plumbing only, not for real e-prescribing.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/patch-medication-erx.ts [--execute]
 *
 * Defaults to dry-run.
 */
import Oystehr from '@oystehr/sdk';
import type { Medication } from 'fhir/r4b';

const isExecute = process.argv.includes('--execute');

const ERX_SYSTEM = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';
const NAME_SYSTEM = 'virtual-medication-identifier-name-system';
const TYPE_SYSTEM = 'virtual-medication-type';
const INVENTORY_TYPE = 'virtual-medication-inventory';

function requireEnv(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env var: ${n}`);
  return v;
}

function nameOf(m: Medication): string | undefined {
  return m.identifier?.find((i) => i.system === NAME_SYSTEM)?.value;
}

function isInventory(m: Medication): boolean {
  return m.identifier?.some((i) => i.system === TYPE_SYSTEM && i.value === INVENTORY_TYPE) ?? false;
}

function hasErx(m: Medication): boolean {
  return m.code?.coding?.some((c) => c.system === ERX_SYSTEM) ?? false;
}

// Stable dummy code derived from name so re-runs don't churn version IDs.
function dummyErxCode(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return `synthetic-${h.toString(36)}`;
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

  const meds = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: '_count', value: '500' }],
    })
  ).unbundle();

  const inventory = meds.filter(isInventory);
  console.log(`Found ${meds.length} Medications (${inventory.length} inventory items)`);

  let toPatch = 0;
  let skipped = 0;
  for (const m of inventory) {
    if (hasErx(m)) {
      skipped += 1;
      continue;
    }
    const name = nameOf(m) ?? m.code?.text ?? m.id ?? 'unknown';
    toPatch += 1;
    if (!isExecute) {
      console.log(`  +  ${name} (${m.id})`);
      continue;
    }
    const erxCode = dummyErxCode(name);
    const newCoding = [...(m.code?.coding ?? []), { system: ERX_SYSTEM, code: erxCode, display: name }];
    const updated: Medication = {
      ...m,
      code: { ...(m.code ?? {}), coding: newCoding },
    };
    try {
      await oystehr.fhir.update<Medication>(updated);
      console.log(`  ✓ ${name} → erx=${erxCode}`);
    } catch (err) {
      console.warn(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('');
  console.log(`-- summary --`);
  console.log(`Patched: ${toPatch}`);
  console.log(`Skipped (already have ERX): ${skipped}`);
  if (!isExecute) console.log('Dry-run only. Re-run with --execute.');
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

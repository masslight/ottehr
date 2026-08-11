/**
 * One-off bootstrap: build medication-history quick-pick example JSONs by
 * looking up each medication's eRx id via `oystehr.erx.searchMedications`.
 *
 * Each spec specifies the EXACT eRx form ("Oral Tablet", "HFA Inhalation
 * Aerosol Solution", etc.) and strength so the picker can pull the right
 * variant out of the dozens eRx returns per drug name.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-medication-history-examples.ts
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-medication-history-examples.ts --execute
 */
import Oystehr from '@oystehr/sdk';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const isExecute = process.argv.includes('--execute');
const OUT_DIR = resolve('scripts/synthetic-quick-picks/examples/medication-history');

type MedSpec = {
  slug: string;
  displayName: string; // shown to providers in the picker
  searchTerm: string; // first word(s) of the drug name for the eRx search
  preferForm: string; // exact eRx form to match (e.g., "Oral Tablet")
  strength: string; // exact eRx strength to match (e.g., "10 MG")
};

const MEDS: MedSpec[] = [
  // Cardiovascular
  {
    slug: 'lisinopril-10mg',
    displayName: 'Lisinopril 10 mg',
    searchTerm: 'lisinopril',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  {
    slug: 'atorvastatin-20mg',
    displayName: 'Atorvastatin 20 mg',
    searchTerm: 'atorvastatin',
    preferForm: 'Oral Tablet',
    strength: '20 MG',
  },
  {
    slug: 'metoprolol-50mg',
    displayName: 'Metoprolol tartrate 50 mg',
    searchTerm: 'metoprolol',
    preferForm: 'Oral Tablet',
    strength: '50 MG',
  },
  {
    slug: 'amlodipine-5mg',
    displayName: 'Amlodipine 5 mg',
    searchTerm: 'amlodipine',
    preferForm: 'Oral Tablet',
    strength: '5 MG',
  },
  {
    slug: 'losartan-50mg',
    displayName: 'Losartan 50 mg',
    searchTerm: 'losartan',
    preferForm: 'Oral Tablet',
    strength: '50 MG',
  },
  {
    slug: 'hctz-25mg',
    displayName: 'Hydrochlorothiazide 25 mg',
    searchTerm: 'hydrochlorothiazide',
    preferForm: 'Oral Tablet',
    strength: '25 MG',
  },
  {
    slug: 'aspirin-81mg',
    displayName: 'Aspirin 81 mg (low-dose)',
    searchTerm: 'aspirin',
    preferForm: 'Oral Tablet Chewable',
    strength: '81 MG',
  },
  // apixaban-5mg removed — not in this eRx dataset
  {
    slug: 'warfarin-5mg',
    displayName: 'Warfarin 5 mg',
    searchTerm: 'warfarin',
    preferForm: 'Oral Tablet',
    strength: '5 MG',
  },
  // Diabetes
  {
    slug: 'metformin-500mg',
    displayName: 'Metformin 500 mg',
    searchTerm: 'metformin',
    preferForm: 'Oral Tablet',
    strength: '500 MG',
  },
  {
    slug: 'metformin-1000mg',
    displayName: 'Metformin 1000 mg',
    searchTerm: 'metformin',
    preferForm: 'Oral Tablet',
    strength: '1000 MG',
  },
  {
    slug: 'glipizide-5mg',
    displayName: 'Glipizide 5 mg',
    searchTerm: 'glipizide',
    preferForm: 'Oral Tablet',
    strength: '5 MG',
  },
  // Respiratory
  {
    slug: 'albuterol-hfa',
    displayName: 'Albuterol HFA inhaler',
    searchTerm: 'albuterol',
    preferForm: 'HFA Inhalation Aerosol Solution',
    strength: '108 (90 Base) MCG/ACT',
  },
  // fluticasone-inh-110mcg removed — eRx only has fluticasone-salmeterol combo, not pure fluticasone inhaler
  {
    slug: 'montelukast-10mg',
    displayName: 'Montelukast 10 mg',
    searchTerm: 'montelukast',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  // GI
  {
    slug: 'omeprazole-20mg',
    displayName: 'Omeprazole 20 mg',
    searchTerm: 'omeprazole',
    preferForm: 'Oral Capsule Delayed Release',
    strength: '20 MG',
  },
  {
    slug: 'pantoprazole-40mg',
    displayName: 'Pantoprazole 40 mg',
    searchTerm: 'pantoprazole',
    preferForm: 'Oral Tablet Delayed Release',
    strength: '40 MG',
  },
  {
    slug: 'famotidine-20mg',
    displayName: 'Famotidine 20 mg',
    searchTerm: 'famotidine',
    preferForm: 'Oral Tablet',
    strength: '20 MG',
  },
  {
    slug: 'ondansetron-4mg-odt',
    displayName: 'Ondansetron 4 mg ODT',
    searchTerm: 'ondansetron',
    preferForm: 'Oral Tablet Disintegrating',
    strength: '4 MG',
  },
  // Pain
  {
    slug: 'ibuprofen-600mg',
    displayName: 'Ibuprofen 600 mg',
    searchTerm: 'ibuprofen',
    preferForm: 'Oral Tablet',
    strength: '600 MG',
  },
  {
    slug: 'acetaminophen-500mg',
    displayName: 'Acetaminophen 500 mg',
    searchTerm: 'acetaminophen',
    preferForm: 'Oral Tablet',
    strength: '500 MG',
  },
  {
    slug: 'naproxen-500mg',
    displayName: 'Naproxen 500 mg',
    searchTerm: 'naproxen',
    preferForm: 'Oral Tablet',
    strength: '500 MG',
  },
  {
    slug: 'gabapentin-300mg',
    displayName: 'Gabapentin 300 mg',
    searchTerm: 'gabapentin',
    preferForm: 'Oral Capsule',
    strength: '300 MG',
  },
  // Mental health
  {
    slug: 'sertraline-50mg',
    displayName: 'Sertraline 50 mg',
    searchTerm: 'sertraline',
    preferForm: 'Oral Tablet',
    strength: '50 MG',
  },
  {
    slug: 'escitalopram-10mg',
    displayName: 'Escitalopram 10 mg',
    searchTerm: 'escitalopram',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  {
    slug: 'fluoxetine-20mg',
    displayName: 'Fluoxetine 20 mg',
    searchTerm: 'fluoxetine',
    preferForm: 'Oral Capsule',
    strength: '20 MG',
  },
  {
    slug: 'alprazolam-0.5mg',
    displayName: 'Alprazolam 0.5 mg',
    searchTerm: 'alprazolam',
    preferForm: 'Oral Tablet',
    strength: '0.5 MG',
  },
  // Endocrine
  {
    slug: 'levothyroxine-75mcg',
    displayName: 'Levothyroxine 75 mcg',
    searchTerm: 'levothyroxine',
    preferForm: 'Oral Tablet',
    strength: '75 MCG',
  },
  // Allergy
  {
    slug: 'loratadine-10mg',
    displayName: 'Loratadine 10 mg',
    searchTerm: 'loratadine',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  {
    slug: 'cetirizine-10mg',
    displayName: 'Cetirizine 10 mg',
    searchTerm: 'cetirizine',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  {
    slug: 'fluticasone-nasal-50mcg',
    displayName: 'Fluticasone nasal spray 50 mcg',
    searchTerm: 'fluticasone',
    preferForm: 'Nasal Suspension',
    strength: '50 MCG/ACT',
  },
  // Other common chronic meds
  {
    slug: 'prednisone-10mg',
    displayName: 'Prednisone 10 mg',
    searchTerm: 'prednisone',
    preferForm: 'Oral Tablet',
    strength: '10 MG',
  },
  {
    slug: 'vitamin-d-1000iu',
    displayName: 'Vitamin D3 1000 IU',
    searchTerm: 'Vitamin D3',
    preferForm: 'Oral Capsule',
    strength: '25 MCG (1000 UT)',
  },
];

async function mintToken(): Promise<string> {
  const r = await fetch(process.env.AUTH0_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  return ((await r.json()) as { access_token: string }).access_token;
}

function pickBestMatch(
  results: { id: number; name: string; strength: string; isObsolete: boolean }[],
  spec: MedSpec
): { id: number; name: string; strength: string } | undefined {
  // Filter: non-obsolete, name contains preferForm (case-insensitive),
  // name STARTS with searchTerm (so combos like "Lisinopril-HCTZ" don't match
  // a "lisinopril" search), strength matches case-insensitive.
  const term = spec.searchTerm.toLowerCase();
  const form = spec.preferForm.toLowerCase();
  const strength = spec.strength.toLowerCase();
  const candidates = results
    .filter((r) => !r.isObsolete)
    .filter((r) => r.name.toLowerCase().startsWith(term))
    .filter((r) => r.name.toLowerCase().includes(form))
    .filter((r) => r.strength.toLowerCase() === strength);
  return candidates[0];
}

async function main(): Promise<void> {
  const oystehr = new Oystehr({
    accessToken: await mintToken(),
    projectId: process.env.PROJECT_ID!,
    services: { projectApiUrl: process.env.PROJECT_API! },
  });

  console.log(`Mode: ${isExecute ? 'EXECUTE (will write JSONs)' : 'DRY RUN'}`);
  console.log(`Project: ${process.env.PROJECT_ID}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  const resolved: { spec: MedSpec; pick: ReturnType<typeof pickBestMatch>; alternatives: number }[] = [];
  for (const spec of MEDS) {
    try {
      const results = (await oystehr.erx.searchMedications({ name: spec.searchTerm })) as any[];
      const pick = pickBestMatch(results, spec);
      resolved.push({ spec, pick, alternatives: results.length });
      const pickStr = pick ? `id=${pick.id}  name="${pick.name}"  strength="${pick.strength}"` : '<NO MATCH>';
      console.log(`  ${spec.slug.padEnd(30)} → ${pickStr}  (${results.length} eRx results)`);
    } catch (e: any) {
      console.log(`  ${spec.slug.padEnd(30)} → ERROR: ${e?.message ?? e}`);
      resolved.push({ spec, pick: undefined, alternatives: 0 });
    }
  }

  const missing = resolved.filter((r) => !r.pick);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} meds had no eRx match — they will be SKIPPED:`);
    for (const m of missing)
      console.log(
        `  ${m.spec.slug} (search="${m.spec.searchTerm}" form="${m.spec.preferForm}" strength="${m.spec.strength}")`
      );
  }

  if (!isExecute) {
    console.log(`\n[DRY RUN] Pass --execute to write ${resolved.length - missing.length} JSON files.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const { spec, pick } of resolved) {
    if (!pick) continue;
    const obj = { name: spec.displayName, strength: pick.strength, medicationId: pick.id };
    writeFileSync(`${OUT_DIR}/${spec.slug}.json`, JSON.stringify(obj, null, 2) + '\n');
    written++;
  }
  console.log(`\nWrote ${written} JSON files.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

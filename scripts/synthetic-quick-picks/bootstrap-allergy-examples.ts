/**
 * One-off bootstrap: build allergy quick-pick example JSONs by looking up each
 * allergen's eRx id via `oystehr.erx.searchAllergens({ name })`.
 *
 * Why a separate script: the AllergyQuickPickData payload requires an integer
 * `allergyId` from the eRx system (without it, the EHR's "apply pick" can't
 * create a properly-coded AllergenIntolerance). This script does the lookup
 * once, picks a single best match per allergen, and writes the resulting
 * `{name, allergyId}` JSONs into `examples/allergies/`. The standard
 * `synthesize-quick-picks.ts --type allergy --all-examples --execute` then
 * applies them like any other category.
 *
 * Usage:
 *   # Print eRx matches for each allergen (verify before writing files)
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-allergy-examples.ts
 *
 *   # Write examples/allergies/<slug>.json files
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-allergy-examples.ts --execute
 */
import Oystehr from '@oystehr/sdk';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const isExecute = process.argv.includes('--execute');
const OUT_DIR = resolve('scripts/synthetic-quick-picks/examples/allergies');

// (slug used for filename, displayName shown to providers, searchTerm for eRx)
// preferTypes is an ordered list of acceptable types; the picker walks them
// from most-preferred to least and only falls past a type if no result of
// that type matches.
type AllergenSpec = { slug: string; displayName: string; searchTerm: string; preferTypes?: string[] };

const ALLERGENS: AllergenSpec[] = [
  // Drug allergies — prefer "AllergenClass" type (the broad category) over specific brand drugs
  {
    slug: 'penicillin',
    displayName: 'Penicillin',
    searchTerm: 'Penicillins',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'sulfa',
    displayName: 'Sulfa drugs',
    searchTerm: 'Sulfonamide',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'cephalosporins',
    displayName: 'Cephalosporins',
    searchTerm: 'Cephalosporins',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'nsaids',
    displayName: 'NSAIDs',
    searchTerm: 'NSAIDs',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'aspirin',
    displayName: 'Aspirin',
    searchTerm: 'Aspirin',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'opiates',
    displayName: 'Opiates (codeine, morphine)',
    searchTerm: 'Morphine and Codeine',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'statins',
    displayName: 'Statins',
    searchTerm: 'Statins',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'iodine-contrast',
    displayName: 'Iodine / contrast media',
    searchTerm: 'Iodinated Contrast Media',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  {
    slug: 'erythromycin',
    displayName: 'Erythromycin',
    searchTerm: 'Macrolides',
    preferTypes: ['AllergenClass', 'ScreenableIngredient'],
  },
  // Food + environmental — type FoodAndEnvironmentalAllergens (single-tag class)
  { slug: 'peanuts', displayName: 'Peanuts', searchTerm: 'Peanut', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  {
    slug: 'tree-nuts',
    displayName: 'Tree nuts',
    searchTerm: 'Tree Nuts',
    preferTypes: ['FoodAndEnvironmentalAllergens'],
  },
  {
    slug: 'shellfish',
    displayName: 'Shellfish',
    searchTerm: 'shellfish',
    preferTypes: ['FoodAndEnvironmentalAllergens'],
  },
  { slug: 'fish', displayName: 'Fish', searchTerm: 'Finfish', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'eggs', displayName: 'Eggs', searchTerm: 'Eggs (Hen)', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'milk', displayName: 'Milk / dairy', searchTerm: 'Milk', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'soy', displayName: 'Soy', searchTerm: 'Soybean', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'wheat', displayName: 'Wheat', searchTerm: 'Wheat', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'sesame', displayName: 'Sesame', searchTerm: 'Sesame', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'pollen', displayName: 'Pollen', searchTerm: 'Pollen', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  {
    slug: 'dust-mites',
    displayName: 'Dust mites',
    searchTerm: 'Dust Mites',
    preferTypes: ['FoodAndEnvironmentalAllergens'],
  },
  { slug: 'cat-dander', displayName: 'Cat dander', searchTerm: 'Cats', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'dog-dander', displayName: 'Dog dander', searchTerm: 'Dogs', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'mold', displayName: 'Mold', searchTerm: 'Mold', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'bee-venom', displayName: 'Bee venom', searchTerm: 'Bee', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  { slug: 'latex', displayName: 'Latex', searchTerm: 'Latex', preferTypes: ['FoodAndEnvironmentalAllergens'] },
  // NKDA — special "no known allergy" entry
  {
    slug: 'nkda',
    displayName: 'No known drug allergies (NKDA)',
    searchTerm: 'No Known Drug Allergy',
    preferTypes: ['NoKnownAllergy', 'ScreenableIngredient'],
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
  results: { id: number; name: string; type: string }[],
  spec: AllergenSpec
): { id: number; name: string; type: string } | undefined {
  if (results.length === 0) return undefined;
  const target = spec.searchTerm.toLowerCase();
  const types = spec.preferTypes ?? [];
  // Walk preferTypes in order; for each type, look for the best match. Only
  // fall through to the next type if the current type has no acceptable hit.
  for (const t of types.length ? types : [undefined]) {
    const candidates = t ? results.filter((r) => r.type === t) : results;
    if (candidates.length === 0) continue;
    // 1. Exact name match
    const exact = candidates.find((r) => r.name.toLowerCase() === target);
    if (exact) return exact;
    // 2. Word-boundary match: name starts with the search term, or contains
    //    the search term as a whole word (separated by spaces/punctuation).
    //    This prevents "Egg" from matching "Eggplant" or "Bee" matching "Beef".
    const wordRe = new RegExp(`(^|[^a-z])${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i');
    const wordMatch = candidates.find((r) => wordRe.test(r.name));
    if (wordMatch) return wordMatch;
    // No acceptable match in this type — fall through to next preferType
  }
  // Refuse to pick if no type yielded a clean match.
  return undefined;
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

  const resolved: {
    spec: AllergenSpec;
    pick: { id: number; name: string; type: string } | undefined;
    alternatives: number;
  }[] = [];
  for (const spec of ALLERGENS) {
    try {
      const results = await oystehr.erx.searchAllergens({ name: spec.searchTerm });
      const pick = pickBestMatch(results, spec);
      resolved.push({ spec, pick, alternatives: results.length });
      const pickStr = pick ? `id=${pick.id}  name="${pick.name}"  type=${pick.type}` : '<NO MATCH>';
      console.log(`  ${spec.slug.padEnd(22)} → ${pickStr}  (${results.length} eRx results)`);
    } catch (e: any) {
      console.log(`  ${spec.slug.padEnd(22)} → ERROR: ${e?.message ?? e}`);
      resolved.push({ spec, pick: undefined, alternatives: 0 });
    }
  }

  const missing = resolved.filter((r) => !r.pick);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} allergens had no eRx match — they will be SKIPPED (won't write JSON):`);
    for (const m of missing) console.log(`  ${m.spec.slug} (searched "${m.spec.searchTerm}")`);
  }

  if (!isExecute) {
    console.log(`\n[DRY RUN] Pass --execute to write ${resolved.length - missing.length} JSON files to ${OUT_DIR}.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const { spec, pick } of resolved) {
    if (!pick) continue;
    const obj = { name: spec.displayName, allergyId: pick.id };
    writeFileSync(`${OUT_DIR}/${spec.slug}.json`, JSON.stringify(obj, null, 2) + '\n');
    written++;
  }
  console.log(`\nWrote ${written} JSON files.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * One-off bootstrap: build immunization quick-pick example JSONs. Each spec names its vaccine by CDC CVX
 * code; the vaccine comes from the vaccine list (CVX_VACCINES), so no project lookup is needed. Each spec
 * also embeds the CMS-published CPT code for that vaccine's administration.
 *
 * Usage:
 *   NODE_OPTIONS='--preserve-symlinks' npx tsx scripts/synthetic-quick-picks/bootstrap-immunization-examples.ts
 *   NODE_OPTIONS='--preserve-symlinks' npx tsx scripts/synthetic-quick-picks/bootstrap-immunization-examples.ts --execute
 */
import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';

const isExecute = process.argv.includes('--execute');
const OUT_DIR = resolve('scripts/synthetic-quick-picks/examples/immunizations');

type VaccineSpec = {
  slug: string;
  displayName: string;
  dose: string;
  units: string;
  route: string;
  // The vaccine: its CVX code in the vaccine list.
  cvx: string;
  cptCode: string;
  cptDisplay: string;
  instructions?: string;
};

const VACCINES: VaccineSpec[] = [
  {
    slug: 'tdap-adult',
    displayName: 'Tdap (adult / adolescent ≥7 yo)',
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    cvx: '115',
    cptCode: '90715',
    cptDisplay: 'Tdap vaccine, IM, ≥7 yo',
    instructions: 'Single 0.5 mL IM dose to deltoid. Standard adult Tdap booster.',
  },
  {
    slug: 'dtap-pediatric',
    displayName: 'DTaP (pediatric, <7 yo)',
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    cvx: '20',
    cptCode: '90700',
    cptDisplay: 'DTaP vaccine, IM, <7 yo',
    instructions: 'Single 0.5 mL IM dose. Series: 2, 4, 6, 15-18 mo, 4-6 yr.',
  },
  {
    slug: 'td-booster',
    displayName: 'Td booster (≥7 yo)',
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    cvx: '113',
    cptCode: '90714',
    cptDisplay: 'Td vaccine, preservative-free, IM, ≥7 yo',
    instructions: 'Single 0.5 mL IM dose. Use for tetanus booster when Tdap not indicated.',
  },
];

function main(): void {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  type Picked = { id: string; name: string };
  // A quick pick's vaccine id is the vaccine's CVX code.
  const findVaccine = (cvx: string): Picked | undefined => {
    const vaccine = getCvxVaccine(cvx);
    return vaccine ? { id: vaccine.cvx, name: vaccine.name } : undefined;
  };

  type Resolved = { spec: VaccineSpec; pick: Picked | undefined };
  const resolved: Resolved[] = [];
  for (const spec of VACCINES) {
    const pick = findVaccine(spec.cvx);
    resolved.push({ spec, pick });
    console.log(`  ${spec.slug.padEnd(20)} → ${pick ? `CVX ${pick.id}  "${pick.name}"` : '<NO MATCH>'}`);
  }

  const missing = resolved.filter((r) => !r.pick);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} vaccines are not in the vaccine list — SKIPPED:`);
    for (const m of missing) console.log(`  ${m.spec.slug} (CVX ${m.spec.cvx})`);
  }

  if (!isExecute) {
    console.log(`\n[DRY RUN] Pass --execute to write ${resolved.length - missing.length} JSON files.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Clear stale JSONs from prior runs so the output dir reflects exactly what this bootstrap resolved.
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) unlinkSync(`${OUT_DIR}/${f}`);
  let written = 0;
  for (const { spec, pick } of resolved) {
    if (!pick) continue;
    const obj = {
      name: spec.displayName,
      vaccine: { id: pick.id, name: pick.name },
      dose: spec.dose,
      units: spec.units,
      route: spec.route,
      cvx: spec.cvx,
      cptCodes: [{ code: spec.cptCode, display: spec.cptDisplay }],
      ...(spec.instructions ? { instructions: spec.instructions } : {}),
    };
    writeFileSync(`${OUT_DIR}/${spec.slug}.json`, JSON.stringify(obj, null, 2) + '\n');
    written++;
  }
  console.log(`\nWrote ${written} JSON files.`);
}

main();

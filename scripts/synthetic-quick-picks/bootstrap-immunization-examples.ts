/**
 * One-off bootstrap: build immunization quick-pick example JSONs by looking
 * up each vaccine's `Medication` FHIR id on the target project. Vaccine
 * Medication resources are tagged with identifier
 * `virtual-medication-type|virtual-vaccine-inventory`.
 *
 * Each spec also embeds the CDC public CVX code and the CMS-published CPT
 * code for that vaccine's administration — neither requires a project lookup.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-immunization-examples.ts
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-immunization-examples.ts --execute
 */
import Oystehr from '@oystehr/sdk';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const isExecute = process.argv.includes('--execute');
const OUT_DIR = resolve('scripts/synthetic-quick-picks/examples/immunizations');

type VaccineSpec = {
  slug: string;
  displayName: string;
  // The substring to match in the vaccine Medication's name identifier.
  // Match is case-insensitive substring.
  matchVaccineName: string;
  dose: string;
  units: string;
  route: string;
  cvx: string;
  cptCode: string;
  cptDisplay: string;
  instructions?: string;
};

const VACCINES: VaccineSpec[] = [
  {
    slug: 'tdap-adult',
    displayName: 'Tdap (adult / adolescent ≥7 yo)',
    matchVaccineName: 'Tdap',
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
    matchVaccineName: 'Dtap',
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
    matchVaccineName: 'Td (Tetanus',
    dose: '0.5',
    units: 'ml',
    route: '78421000',
    cvx: '138',
    cptCode: '90714',
    cptDisplay: 'Td vaccine, preservative-free, IM, ≥7 yo',
    instructions: 'Single 0.5 mL IM dose. Use for tetanus booster when Tdap not indicated.',
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

async function main(): Promise<void> {
  const oystehr = new Oystehr({
    accessToken: await mintToken(),
    projectId: process.env.PROJECT_ID!,
    services: { projectApiUrl: process.env.PROJECT_API! },
  });

  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${process.env.PROJECT_ID}`);
  console.log(`Output dir: ${OUT_DIR}\n`);

  // Pull all vaccine Medications on the target project.
  const allVaccines = (
    await oystehr.fhir.search<any>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: 'virtual-medication-type|virtual-vaccine-inventory' },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();
  console.log(`Vaccines on project: ${allVaccines.length}`);

  // For each spec, find a Medication whose name identifier matches.
  type Picked = { id: string; name: string };
  const findVaccine = (matchName: string): Picked | undefined => {
    const target = matchName.toLowerCase();
    const named = (allVaccines as any[])
      .map((m) => {
        const nameId = (m.identifier ?? []).find((i: any) => i.system?.includes('identifier-name-system'));
        return nameId?.value ? { id: m.id as string, name: nameId.value as string } : undefined;
      })
      .filter((x): x is Picked => !!x);
    // Exact match wins; substring fallback for partial matchVaccineName entries.
    const exact = named.find((m) => m.name.toLowerCase() === target);
    if (exact) return exact;
    return named.find((m) => m.name.toLowerCase().includes(target));
  };

  type Resolved = { spec: VaccineSpec; pick: Picked | undefined };
  const resolved: Resolved[] = [];
  for (const spec of VACCINES) {
    const pick = findVaccine(spec.matchVaccineName);
    resolved.push({ spec, pick });
    console.log(`  ${spec.slug.padEnd(20)} → ${pick ? `Medication/${pick.id}  "${pick.name}"` : '<NO MATCH>'}`);
  }

  const missing = resolved.filter((r) => !r.pick);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} vaccines had no matching Medication on the project — SKIPPED:`);
    for (const m of missing) console.log(`  ${m.spec.slug} (looking for "${m.spec.matchVaccineName}")`);
  }

  if (!isExecute) {
    console.log(`\n[DRY RUN] Pass --execute to write ${resolved.length - missing.length} JSON files.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Clear stale JSONs from prior runs so the output dir reflects exactly what
  // this bootstrap resolved against the current project.
  const { readdirSync, unlinkSync } = await import('fs');
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

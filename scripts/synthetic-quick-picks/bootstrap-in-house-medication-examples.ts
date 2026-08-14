/**
 * One-off bootstrap: build in-house medication quick-pick example JSONs by
 * looking up each medication's `Medication` FHIR id on the target project.
 * In-house Medication resources are tagged with identifier
 * `virtual-medication-type|virtual-medication-inventory`.
 *
 * Each spec embeds the typical admin defaults (dose, units, route, CPT) for
 * the most common urgent-care administration of that medication. Provider
 * can adjust at use time.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-in-house-medication-examples.ts
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-quick-picks/bootstrap-in-house-medication-examples.ts --execute
 */
import Oystehr from '@oystehr/sdk';
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const isExecute = process.argv.includes('--execute');
const OUT_DIR = resolve('scripts/synthetic-quick-picks/examples/in-house-medications');

type IHMSpec = {
  slug: string;
  displayName: string;
  // Substring (case-insensitive) of the in-house medication name identifier.
  matchMedName: string;
  dose: number;
  units: string;
  route: string;
  cptCode?: string;
  cptDisplay?: string;
  instructions?: string;
};

// Defaults reflect typical urgent-care doses for common adult/peds scenarios.
// Provider always confirms / adjusts at use time.
const MEDS: IHMSpec[] = [
  {
    slug: 'albuterol-neb-2.5mg',
    displayName: 'Albuterol nebulizer 2.5 mg',
    matchMedName: 'Albuterol',
    dose: 2.5,
    units: 'mg',
    route: '447694001',
    cptCode: '94640',
    cptDisplay: 'Pressurized or nonpressurized inhalation treatment for acute airway obstruction',
    instructions: '2.5 mg in 3 mL NS via nebulizer over 10–15 min. May repeat per symptoms.',
  },
  {
    slug: 'ventolin-hfa-90mcg',
    displayName: 'Ventolin HFA 2 puffs',
    matchMedName: 'Ventolin HFA',
    dose: 2,
    units: 'application',
    route: '447694001',
    cptCode: '94664',
    cptDisplay: 'Demonstration and/or evaluation of patient utilization of an aerosol generator',
    instructions: '2 puffs (90 mcg/puff) inhaled with spacer, repeat in 4–6 h PRN.',
  },
  {
    slug: 'acetaminophen-tabs-650mg',
    displayName: 'Acetaminophen 650 mg PO (tabs)',
    matchMedName: 'Acetaminophen (Tabs)',
    dose: 650,
    units: 'mg',
    route: '26643006',
    instructions: '650 mg PO once for pain or fever.',
  },
  {
    slug: 'acetaminophen-liquid-160mg',
    displayName: 'Acetaminophen liquid 160 mg PO (peds)',
    matchMedName: 'Acetaminophen (Liquid)',
    dose: 160,
    units: 'mg',
    route: '26643006',
    instructions: 'Pediatric weight-based dose, 10–15 mg/kg PO. 160 mg = 5 mL of 32 mg/mL.',
  },
  {
    slug: 'acetaminophen-supp-80mg',
    displayName: 'Acetaminophen 80 mg suppository (peds)',
    matchMedName: 'Acetaminophen (80mg Suppository)',
    dose: 80,
    units: 'mg',
    route: '37161004',
    instructions: 'Pediatric: 80 mg PR if vomiting / unable to tolerate PO.',
  },
  {
    slug: 'acetaminophen-supp-120mg',
    displayName: 'Acetaminophen 120 mg suppository (peds)',
    matchMedName: 'Acetaminophen (120mg Suppository)',
    dose: 120,
    units: 'mg',
    route: '37161004',
    instructions: 'Pediatric: 120 mg PR if vomiting / unable to tolerate PO.',
  },
  {
    slug: 'acetaminophen-supp-325mg',
    displayName: 'Acetaminophen 325 mg suppository (adult)',
    matchMedName: 'Acetaminophen (325mg Suppository)',
    dose: 325,
    units: 'mg',
    route: '37161004',
    instructions: 'Adult: 325 mg PR if vomiting / unable to tolerate PO.',
  },
  {
    slug: 'ibuprofen-400mg-po',
    displayName: 'Ibuprofen 400 mg PO',
    matchMedName: 'Ibuprofen 400mg Tablet PO',
    dose: 400,
    units: 'mg',
    route: '26643006',
    instructions: '400 mg PO once for pain or fever. Avoid in CKD, peptic ulcer, pregnancy.',
  },
  {
    slug: 'lidocaine-1pct-injection',
    displayName: 'Lidocaine 1% local infiltration',
    matchMedName: 'Lidocaine HCl (Local Anesth.)',
    dose: 1,
    units: 'unit',
    route: '34206005',
    instructions:
      'Local infiltration for procedural anesthesia (lac repair, I&D, FB removal). Max 4.5 mg/kg without epi.',
  },
  {
    slug: 'amoxicillin-500mg-po',
    displayName: 'Amoxicillin 500 mg PO',
    matchMedName: 'Amoxicillin',
    dose: 500,
    units: 'mg',
    route: '26643006',
    instructions:
      'In-office observed dose for first-line coverage (otitis, strep, sinusitis). Outpatient course follows.',
  },
  {
    slug: 'amoxicillin-clavulanate-875mg-po',
    displayName: 'Amoxicillin-Clavulanate 875 mg PO',
    matchMedName: 'Amoxicillin Clavulanate',
    dose: 875,
    units: 'mg',
    route: '26643006',
    instructions: 'In-office observed dose for animal/human bite, sinusitis with risk factors, complicated otitis.',
  },
  {
    slug: 'activated-charcoal-50g-po',
    displayName: 'Activated charcoal 50 g PO',
    matchMedName: 'Activated Charcoal',
    dose: 50,
    units: 'g',
    route: '26643006',
    instructions:
      'Adult: 50 g PO mixed in water for select acute oral toxic ingestions presenting <1 h. Confirm indication with toxicology.',
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

  const allMeds = (
    await oystehr.fhir.search<any>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: 'virtual-medication-type|virtual-medication-inventory' },
        { name: '_count', value: '200' },
      ],
    })
  ).unbundle();
  console.log(`In-house meds on project: ${allMeds.length}`);

  type Picked = { id: string; name: string };
  const findMed = (matchName: string): Picked | undefined => {
    const target = matchName.toLowerCase();
    const named = (allMeds as any[])
      .map((m) => {
        const nameId = (m.identifier ?? []).find((i: any) => i.system?.includes('identifier-name-system'));
        return nameId?.value ? { id: m.id as string, name: nameId.value as string } : undefined;
      })
      .filter((x): x is Picked => !!x);
    // 1. Exact match wins (so "Amoxicillin" matches "Amoxicillin", not "Amoxicillin Clavulanate")
    const exact = named.find((m) => m.name.toLowerCase() === target);
    if (exact) return exact;
    // 2. Substring fallback for cases where matchMedName is intentionally a fragment
    //    of the canonical name (e.g., "Lidocaine HCl (Local Anesth.)" matches the
    //    longer "Lidocaine HCl (Local Anesth.) Injection Kit (1 %)").
    return named.find((m) => m.name.toLowerCase().includes(target));
  };

  type Resolved = { spec: IHMSpec; pick: Picked | undefined };
  const resolved: Resolved[] = [];
  for (const spec of MEDS) {
    const pick = findMed(spec.matchMedName);
    resolved.push({ spec, pick });
    console.log(`  ${spec.slug.padEnd(36)} → ${pick ? `Medication/${pick.id}  "${pick.name}"` : '<NO MATCH>'}`);
  }

  const missing = resolved.filter((r) => !r.pick);
  if (missing.length) {
    console.log(`\n⚠ ${missing.length} meds had no matching Medication on the project — SKIPPED:`);
    for (const m of missing) console.log(`  ${m.spec.slug} (looking for "${m.spec.matchMedName}")`);
  }

  if (!isExecute) {
    console.log(`\n[DRY RUN] Pass --execute to write ${resolved.length - missing.length} JSON files.`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  // Clear stale JSONs from prior runs so the output dir reflects exactly what
  // this bootstrap resolved. Without this, applying the populator to a project
  // that lacks a med (e.g. ibuprofen on demo) would re-apply the previous
  // project's JSON with the wrong medicationId.
  const { readdirSync, unlinkSync } = await import('fs');
  for (const f of readdirSync(OUT_DIR)) if (f.endsWith('.json')) unlinkSync(`${OUT_DIR}/${f}`);
  let written = 0;
  for (const { spec, pick } of resolved) {
    if (!pick) continue;
    const obj: Record<string, unknown> = {
      name: spec.displayName,
      medicationId: pick.id,
      medicationName: pick.name,
      dose: spec.dose,
      units: spec.units,
      route: spec.route,
    };
    if (spec.cptCode && spec.cptDisplay) obj.cptCodes = [{ code: spec.cptCode, display: spec.cptDisplay }];
    if (spec.instructions) obj.instructions = spec.instructions;
    writeFileSync(`${OUT_DIR}/${spec.slug}.json`, JSON.stringify(obj, null, 2) + '\n');
    written++;
  }
  console.log(`\nWrote ${written} JSON files.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

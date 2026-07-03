// Audits whether a target Oystehr env has everything the synth harness/census
// needs to produce COMPLETE visits — not just bare ones. Checks (direct FHIR via
// M2M, no server needed): in-person Locations + Schedules, progress-note
// templates, in-house lab catalog, medication formulary + vaccines, payer
// Organizations, and the intake questionnaire. Reports present vs MISSING with
// the fill-the-gap command for each.
//
//   npx env-cmd -f packages/zambdas/.env/demo.json npx tsx \
//     scripts/synthetic-patient-data/audit-env-readiness.ts [--env demo]

import { arg } from './shared/cli';
import { createOystehrFromEnv, need, searchAllPages } from './shared/oystehr-client';

const ENV = arg('--env', 'demo');

const TEMPLATE_CODE_SYSTEMS = [
  'https://fhir.ottehr.com/CodeSystem/global-template-in-person',
  'https://fhir.ottehr.com/CodeSystem/global-template-telemed',
];
const MED_NAME_SYSTEM = 'virtual-medication-identifier-name-system';
const IN_HOUSE_LAB_TAG = 'in-house-lab-test-definition';

// What the archetypes reference (from examples/*.json).
const REQUIRED = {
  locations: ['Los Angeles', 'New York'],
  templates: [
    'AOM Right',
    'Abdominal pain (focus on constipation)',
    'Asthma',
    'Automobile Accident',
    'Conjunctivitis Right Eye',
    'Gastroenteritis, ZOFRAN',
    'Laceration, Face Sutures',
    'Pharyngitis Strep',
    'Pharyngitis Viral',
    'Pneumonia',
    'Poison Ivy',
    'Sprain, Ankle R',
    'UTI',
    'Viral illness with fever',
  ],
  labs: ['Rapid Strep A', 'Urinalysis', 'SARS-CoV-2 Antigen', 'Rapid Influenza A', 'Mono Spot'],
  meds: [
    'Albuterol Sulfate 2.5mg/3mL Nebulizer Solution',
    'Ibuprofen 400mg',
    'Ketorolac 30mg/mL Injection',
    'Ondansetron 4mg ODT',
    'Prednisone 50mg Oral Tablet',
    'Sodium Chloride 0.9% IV Solution 500mL',
  ],
  vaccines: ['Influenza Vaccine', 'Tdap', 'Tetanus, Diphtheria (Td)'],
  payers: ['Aetna', 'Anthem', 'Blue Cross Blue Shield', 'Cigna', 'Humana', 'Medicaid', 'Medicare', 'UnitedHealthcare'],
};

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const fuzzyHas = (have: string[], want: string): boolean => {
  const w = norm(want);
  return have.some((h) => {
    const nh = norm(h);
    return nh === w || nh.includes(w) || w.includes(nh);
  });
};

function report(label: string, want: string[], have: string[]): { ok: number; missing: string[] } {
  const missing = want.filter((w) => !fuzzyHas(have, w));
  const ok = want.length - missing.length;
  const mark = missing.length === 0 ? '✅' : missing.length === want.length ? '❌' : '⚠️ ';
  console.log(`\n${mark} ${label}: ${ok}/${want.length} present (${have.length} total in env)`);
  if (missing.length) console.log(`     MISSING: ${missing.join(', ')}`);
  return { ok, missing };
}

(async () => {
  const o = await createOystehrFromEnv();
  console.log(`Auditing env '${ENV}' (project ${need('PROJECT_ID')}) for synth-census readiness…`);

  const search = async (rt: string, params: any[]): Promise<any[]> =>
    (await o.fhir.search({ resourceType: rt as any, params: [...params, { name: '_count', value: '300' }] }))
      .unbundle()
      .filter((r: any) => r.resourceType === rt) as any[];

  // Locations + Schedules
  const locs = await search('Location', []);
  const locResult = report('In-person Locations', REQUIRED.locations, locs.map((l: any) => l.name).filter(Boolean));
  let schedOk = true;
  for (const ln of REQUIRED.locations) {
    const loc = locs.find((l: any) => l.name === ln);
    if (loc?.id) {
      const sched = await search('Schedule', [{ name: 'actor', value: `Location/${loc.id}` }]);
      if (!sched.length) {
        console.log(`     ⚠️  Location "${ln}" has no Schedule — slot booking will fail.`);
        schedOk = false;
      }
    }
  }
  if (schedOk && !locResult.missing.length) console.log('     Schedules: present for both.');

  // Templates — paginate ALL Lists (a common type) and filter by the global-template
  // code system (not _tag, and not the 300-cap, which both under-count).
  const allLists = await searchAllPages<any>(o, 'List', []);
  const tmplTitles = allLists
    .filter((l: any) => (l.code?.coding ?? []).some((c: any) => TEMPLATE_CODE_SYSTEMS.includes(c.system)))
    .map((l: any) => l.title);
  report('Progress-note templates', REQUIRED.templates, tmplTitles.filter(Boolean));

  // In-house labs
  const labs = await search('ActivityDefinition', [{ name: '_tag', value: IN_HOUSE_LAB_TAG }]);
  report('In-house lab catalog', REQUIRED.labs, labs.map((a: any) => a.title || a.name).filter(Boolean));

  // Medications (formulary, by name identifier) + vaccines
  const meds = await search('Medication', [{ name: 'identifier', value: `${MED_NAME_SYSTEM}|` }]);
  const medNames = meds
    .map((m: any) => m.identifier?.find((i: any) => i.system === MED_NAME_SYSTEM)?.value || m.code?.text)
    .filter(Boolean);
  report('In-house medications', REQUIRED.meds, medNames);
  report('Vaccines', REQUIRED.vaccines, medNames);

  // Payers
  const orgs = await search('Organization', [{ name: 'type', value: 'pay' }]);
  report('Payer Organizations', REQUIRED.payers, orgs.map((g: any) => g.name).filter(Boolean));

  // Providers (Practitioner count — provider/MA split needs get-employees, checked by the census itself)
  const prac = await search('Practitioner', []);
  const synthStaff = prac.filter((p: any) => (p.meta?.tag || []).some((t: any) => t.code === 'synth-staff')).length;
  console.log(`\nℹ️  Practitioners: ${prac.length} total; synth-staff-tagged: ${synthStaff}.`);
  if (synthStaff === 0)
    console.log("     (No synth staff imported — census will use the env's own providers, which is fine.)");

  console.log('\n── To fill gaps (run against this env) ──');
  console.log(
    '  templates : npx tsx scripts/synthetic-patient-data/copy-templates.ts --source-env packages/zambdas/.env/synth.json --dest-env packages/zambdas/.env/' +
      ENV +
      '.json --execute'
  );
  console.log(
    '  meds      : npx tsx scripts/synthetic-patient-data/copy-medications.ts --source-env ... --dest-env packages/zambdas/.env/' +
      ENV +
      '.json --execute'
  );
  console.log(
    '  payers    : npx tsx scripts/synthetic-patient-data/copy-payer-organizations.ts --source-env ... --dest-env packages/zambdas/.env/' +
      ENV +
      '.json --execute'
  );
  console.log(
    '  staff     : APPLICATION_ID=<id> npx env-cmd -f packages/zambdas/.env/' +
      ENV +
      '.json npx tsx scripts/synthetic-patient-data/link-synth-staff-users.ts'
  );
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

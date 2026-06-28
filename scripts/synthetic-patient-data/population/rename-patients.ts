// Post-build name fix: PATCHes Patient.name on the population patients to
// globally-unique, diverse names. Far faster than re-running visits — one
// single-field PATCH per patient. Use it to repair patients created by an early
// build before the name pools were expanded (duplicate full names, repeated
// last names) WITHOUT deleting/re-running anything.
//
// Targets only POPULATION patients (telecom email like "<first>.<last>.<seq>@example.com",
// set by run-population.ts) — never jane-doe/maya/other synth test patients.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx rename-patients.ts --dry
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx rename-patients.ts
//
// Caveat: visit-note PDFs already generated keep the old baked-in name (cosmetic,
// regenerable). The canonical Patient.name (EHR patient list, tracking board,
// ad-hoc reports) is fixed.

import { SYNTHETIC_PATIENT_ID_SYSTEM as SYNTH_ID } from '../shared/constants';
import { createOystehrFromEnv } from '../shared/oystehr-client';
import { FIRST_NAMES_F, FIRST_NAMES_M, LAST_NAMES } from './archetypes';

const DRY = process.argv.includes('--dry');
const POP_EMAIL = /\.\d+@example\.com$/i;

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
const uniq = (a: string[]): string[] => [...new Set(a)];
const F = uniq(FIRST_NAMES_F);
const M = uniq(FIRST_NAMES_M);
const L = uniq(LAST_NAMES);

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(77001);
const pick = <T>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];

const emailOf = (p: any): string => (p.telecom || []).find((t: any) => t.system === 'email')?.value || '';
// Infer sex for first-name pool: prefer FHIR gender, else keep whatever pool the
// existing given name came from is irrelevant — gender drives the new name.
const isFemale = (p: any): boolean => (p.gender ? p.gender === 'female' : rng() < 0.5);

(async () => {
  const o = await createOystehrFromEnv();

  // Page through every synth-tagged patient.
  const all: any[] = [];
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Patient',
      params: [
        { name: 'identifier', value: `${SYNTH_ID}|` },
        { name: '_count', value: '500' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const pts = b.unbundle().filter((r: any) => r.resourceType === 'Patient') as any[];
    if (!pts.length) break;
    all.push(...pts);
    offset += pts.length;
    if (pts.length < 500) break;
  }
  const pop = all.filter((p) => POP_EMAIL.test(emailOf(p)));
  const nonPop = all.filter((p) => !POP_EMAIL.test(emailOf(p)));

  // Reserve non-population names so we never collide with jane-doe/maya/etc.
  const used = new Set<string>();
  for (const p of nonPop) {
    const n = p.name?.[0];
    if (n) used.add(`${slug((n.given || []).join(' '))}|${slug(n.family || '')}`);
  }

  console.log(
    `Synth patients: ${all.length} | population (renaming): ${pop.length} | preserved: ${nonPop.length}${
      DRY ? '  [DRY]' : ''
    }`
  );
  if (!pop.length) {
    console.log('No population patients matched the email marker — check run-population materialize email format.');
    return;
  }

  let renamed = 0;
  const samples: string[] = [];
  for (const p of pop) {
    const female = isFemale(p);
    let first = '';
    let last = '';
    let tries = 0;
    do {
      first = pick(female ? F : M);
      last = pick(L);
      tries++;
    } while (used.has(`${slug(first)}|${slug(last)}`) && tries < 300);
    used.add(`${slug(first)}|${slug(last)}`);

    const oldName = `${(p.name?.[0]?.given || []).join(' ')} ${p.name?.[0]?.family || ''}`.trim();
    if (samples.length < 10) samples.push(`${oldName.padEnd(24)} → ${first} ${last}`);

    if (!DRY) {
      // Update every name-derived field together (atomic full-resource update):
      //   • name[0]            family/given
      //   • telecom email      "<first>.<last>.<seq>@example.com" (keep the .seq marker)
      //   • synthetic-id ident "<first>-<last>-<dob>" (the harness dedup key)
      p.name = [{ ...(p.name?.[0] || {}), use: p.name?.[0]?.use || 'official', family: last, given: [first] }];

      const seqMatch = emailOf(p).match(/\.(\d+)@example\.com$/i);
      const seqPart = seqMatch ? `.${seqMatch[1]}` : '';
      p.telecom = (p.telecom || []).map((tc: any) =>
        tc.system === 'email' ? { ...tc, value: `${slug(first)}.${slug(last)}${seqPart}@example.com` } : tc
      );

      const dob = p.birthDate || '';
      p.identifier = (p.identifier || []).map((id: any) =>
        id.system === SYNTH_ID ? { ...id, value: `${slug(first)}-${slug(last)}-${dob}` } : id
      );

      try {
        await o.fhir.update(p);
        renamed++;
        if (renamed % 100 === 0) console.log(`  …${renamed}/${pop.length}`);
      } catch (e: any) {
        console.log(`  ✗ ${p.id}: ${e?.message ?? e}`);
      }
    }
  }
  console.log('\nSample renames:');
  for (const s of samples) console.log('  ' + s);
  console.log(DRY ? `\n[dry] would rename ${pop.length} patients.` : `\nRenamed ${renamed}/${pop.length} patients.`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

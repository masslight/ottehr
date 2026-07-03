// One-off repair: the synth provider Practitioners were created with a bare `qualification`
// ({ code: { coding } } and no `extension`). The EHR's get-user zambda assumes every
// qualification is a state license and reads `qualification.extension[0].extension[1]...`,
// so the employee detail page 500s with "Failed to get User: {}".
//
// This rebuilds each synth-staff provider's qualification into the proper license shape
// (matching makeQualificationForPractitioner) so the detail page loads. FHIR-only edit.
//   npx env-cmd -f packages/zambdas/.env/synth.json \
//   npx tsx scripts/synthetic-patient-data/fix-synth-staff-qualifications.ts
import { Practitioner, PractitionerQualification } from 'fhir/r4b';
import { createOystehrFromEnv } from './shared/oystehr-client';

const STAFF_MARKER_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff';
const LOCATION_SYSTEM = 'https://fhir.ottehr.com/sid/synth-staff-location';

const QUALIFICATION_EXTENSION_URL =
  'http://hl7.org/fhir/us/davinci-pdex-plan-net/StructureDefinition/practitioner-qualification';
const QUALIFICATION_CODE_SYSTEM = 'http://terminology.hl7.org/CodeSystem/v2-0360|2.7';
const QUALIFICATION_STATE_SYSTEM = 'http://hl7.org/fhir/us/core/ValueSet/us-core-usps-state';

const STATE_FOR: Record<string, string> = { 'Los Angeles': 'CA', 'New York': 'NY' };

function properQualification(code: string, state: string): PractitionerQualification {
  return {
    code: { coding: [{ system: QUALIFICATION_CODE_SYSTEM, code }], text: 'Qualification code' },
    extension: [
      {
        url: QUALIFICATION_EXTENSION_URL,
        extension: [
          { url: 'status', valueCode: 'active' },
          {
            url: 'whereValid',
            valueCodeableConcept: { coding: [{ code: state, system: QUALIFICATION_STATE_SYSTEM }] },
          },
        ],
      },
    ],
  };
}

async function main(): Promise<void> {
  const oystehr = await createOystehrFromEnv();

  const bundle = await oystehr.fhir.search<Practitioner>({
    resourceType: 'Practitioner',
    params: [{ name: '_tag', value: `${STAFF_MARKER_SYSTEM}|synth-staff` }],
  });
  const practitioners = bundle.unbundle().filter((r) => r.resourceType === 'Practitioner') as Practitioner[];
  console.log(`Found ${practitioners.length} synth-staff Practitioners.`);

  let fixed = 0;
  let skipped = 0;
  for (const p of practitioners) {
    const quals = p.qualification ?? [];
    // Only providers have a credential qualification; MAs/front-desk have none.
    const needsFix = quals.some((q) => !q.extension || q.extension.length === 0);
    if (!needsFix) {
      skipped++;
      continue;
    }
    const location = p.meta?.tag?.find((tg) => tg.system === LOCATION_SYSTEM)?.code ?? 'Los Angeles';
    const state = STATE_FOR[location] ?? 'CA';
    p.qualification = quals.map((q) => {
      const code = q.code?.coding?.[0]?.code;
      if (!code || (q.extension && q.extension.length > 0)) return q;
      return properQualification(code, state);
    });
    await oystehr.fhir.update(p);
    fixed++;
    const name = p.name?.[0];
    console.log(`  fixed ${name?.given?.join(' ')} ${name?.family} (${state})`);
  }
  console.log(`\nDone — fixed ${fixed}, already-ok ${skipped}.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

// Additively completes the chart on the hip-fracture visits — the only
// no-template archetype, so they were created with NO diagnosis Condition, exam,
// ROS, or prescription (and the dx-keyed Rx/ROS backfills skipped them). This
// adds, via save-chart-data + a direct eRx MedicationRequest:
//   • diagnosis (S72.142A, left intertrochanteric femur fracture)
//   • a focused exam (general normal + abnormal LEFT hip via extremities-comment)
//   • a focused MSK review of systems
//   • medical decision making narrative
//   • an acetaminophen prescription
// No regeneration. Idempotent: skips encounters that already have a diagnosis.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx backfill-hipfracture-exam.ts [--dry]

import { createOystehrFromToken, mintAccessToken, need } from '../shared/oystehr-client';

const DRY = process.argv.includes('--dry');
const ZAMBDA = process.env.ZAMBDA_API || 'http://localhost:3000/local';
const DRUG_SYS = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';

const NORMAL_EXAM = [
  'alert',
  'active',
  'in-no-acute-distress',
  'well-hydrated',
  'normocephalic',
  'atraumatic',
  'right-eye-conjunctiva-non-injected-no-discharge',
  'left-eye-conjunctiva-non-injected-no-discharge',
  'lids-and-lashes-normal',
  'right-tm-pearly-with-good-light-reflex-preserved-landmarks',
  'left-tm-pearly-with-good-light-reflex-preserved-landmarks',
  'no-effusion',
  'normal-canals',
  'normal-external-ear',
  'moist-mucous-membranes',
  'oropharynx-clear-with-no-erythema-lesions-or-exudate',
  'uvula-midline',
  'normal-appearance-of-neck',
  'no-rash',
  'warm-and-dry',
  'regular-rate-and-rhythm-with-no-murmur',
  'extremities-are-warm-and-well-perfused',
  'good-air-movement-throughout-lung-fields',
  'no-signs-of-respiratory-distress',
  'chest-is-clear-to-auscultation-bilaterally',
  'soft',
  'nondistended',
  'nontender',
  'normal-mental-status',
  'normal-tone',
];
const HIP_NOTE =
  'Left hip shortened and externally rotated; tender to palpation over the greater trochanter; unable to bear weight; range of motion limited by pain. Distal pulses 2+ (DP/PT), sensation intact, foot warm and well perfused.';
const ROS_FIELDS = [
  'ros-msk-joint-pain-reports',
  'ros-msk-joint-swelling-reports',
  'ros-msk-limited-rom-reports',
  'ros-msk-gait-difficulty-reports',
  'ros-neuro-numbness-denies',
  'ros-neuro-weakness-denies',
  'ros-constitutional-fever-denies',
];
const MDM =
  'Elderly patient on warfarin presenting after a mechanical fall with a clinically deformed, shortened, externally rotated left lower extremity and inability to bear weight. Radiograph confirms a displaced left intertrochanteric femur fracture. Neurovascularly intact distally. Orthopedic surgery consulted; warfarin held and reversal addressed; admitted/transferred for operative repair. Analgesia provided. Aspiration and DVT precautions reviewed. Risks discussed with patient and family.';

(async () => {
  const at = await mintAccessToken();
  const o = createOystehrFromToken(at);

  // Find hip-fracture appointments by the archetype's distinctive reason text → encounters.
  const encs: Array<{ encId: string; patientRef?: string; provRef?: string; date?: string }> = [];
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Appointment',
      params: [
        { name: 'date', value: 'ge2025-06-01' },
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const appts = b.unbundle().filter((r: any) => r.resourceType === 'Appointment') as any[];
    if (!appts.length) break;
    for (const a of appts) {
      const reason = (a.description || a.reasonCode?.[0]?.text || '').toLowerCase();
      if (reason.includes('icy steps') || (reason.includes('hip') && reason.includes('unable to bear weight'))) {
        const encBundle = await o.fhir.search({
          resourceType: 'Encounter',
          params: [{ name: 'appointment', value: `Appointment/${a.id}` }],
        });
        const enc = encBundle.unbundle().find((r: any) => r.resourceType === 'Encounter') as any;
        if (enc?.id) {
          const provRef = enc.participant
            ?.map((p: any) => p.individual?.reference)
            .find((r: string) => r?.startsWith('Practitioner/'));
          encs.push({ encId: enc.id, patientRef: enc.subject?.reference, provRef, date: enc.period?.start || a.start });
        }
      }
    }
    offset += appts.length;
    if (appts.length < 1000) break;
  }
  console.log(`Hip-fracture encounters: ${encs.length}${DRY ? '  [DRY]' : ''}`);
  if (DRY) {
    console.log(
      `Would add: dx S72.142A, ${NORMAL_EXAM.length + 1} exam findings, ${
        ROS_FIELDS.length
      } ROS, MDM, + acetaminophen Rx.`
    );
    return;
  }

  let done = 0;
  let skipped = 0;
  let n = 0;
  for (const { encId, patientRef, provRef, date } of encs) {
    n++;
    try {
      // Idempotency: skip if a diagnosis already exists.
      const existing = (
        await o.fhir.search({
          resourceType: 'Condition',
          params: [
            { name: 'encounter', value: `Encounter/${encId}` },
            { name: '_tag', value: 'diagnosis' },
            { name: '_count', value: '1' },
          ],
        })
      ).unbundle();
      if (existing.length) {
        skipped++;
        continue;
      }
      const body = {
        encounterId: encId,
        diagnosis: [
          {
            code: 'S72.142A',
            display: 'Displaced intertrochanteric fracture of left femur, initial encounter',
            isPrimary: true,
          },
        ],
        examObservations: [
          ...NORMAL_EXAM.map((field) => ({ field, value: true })),
          { field: 'extremities-comment', value: true, note: HIP_NOTE },
        ],
        rosObservations: ROS_FIELDS.map((field) => ({ field, value: true })),
        medicalDecision: { text: MDM },
      };
      const res = await fetch(`${ZAMBDA}/zambda/save-chart-data/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${at}`,
          'x-zapehr-project-id': need('PROJECT_ID'),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        console.log(`  ✗ ${encId}: save-chart-data ${res.status} ${(await res.text()).slice(0, 120)}`);
        continue;
      }
      // Acetaminophen prescription (direct eRx-tagged MedicationRequest).
      await o.fhir.create({
        resourceType: 'MedicationRequest',
        status: 'active',
        intent: 'order',
        meta: { tag: [{ code: 'erx-medication' }] },
        ...(patientRef ? { subject: { reference: patientRef } } : {}),
        encounter: { reference: `Encounter/${encId}` },
        ...(date ? { authoredOn: date } : {}),
        ...(provRef ? { requester: { reference: provRef } } : {}),
        medicationCodeableConcept: {
          coding: [{ system: DRUG_SYS, display: 'acetaminophen 500 mg tablet' }],
          text: 'acetaminophen 500 mg tablet',
        },
        dosageInstruction: [
          {
            text: '2 tabs PO q6h PRN pain',
            patientInstruction: 'Take 2 tablets by mouth every 6 hours as needed for pain (max 3 g/day)',
          },
        ],
      } as any);
      done++;
      if (n % 20 === 0) console.log(`  …${n}/${encs.length} (done ${done})`);
    } catch (e: any) {
      console.log(`  ✗ ${encId}: ${e?.message ?? e}`);
    }
  }
  console.log(`\nDone. Completed ${done} hip-fracture charts; skipped ${skipped}.`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

// Additively backfills realistic discharge prescriptions onto existing visits.
// For each encounter's primary diagnosis (Condition tagged `diagnosis`, ICD-10),
// maps to standard UC discharge meds and creates eRx-tagged MedicationRequest(s)
// — the same resource get-erx-orders/the chart prescriptions section read.
// No vendor needed. Idempotent: skips any encounter that already has an eRx.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx backfill-prescriptions.ts --dry
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx backfill-prescriptions.ts [--concurrency 8]

import Oystehr from '@oystehr/sdk';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};
const DRY = process.argv.includes('--dry');
const CONCURRENCY = parseInt(arg('--concurrency', '8'), 10);
const DRUG_SYS = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';
const DIAGNOSIS_TAG = 'diagnosis';
const ERX_TAG = 'erx-medication';

interface Rx {
  name: string;
  sig: string;
}
// ICD-10 prefix → standard discharge prescription(s). Clinically typical UC
// scripts; viral/supportive complaints intentionally get symptomatic-only or
// none (not every visit warrants a script).
const RX_BY_PREFIX: Array<{ prefix: string[]; rx: Rx[] }> = [
  {
    prefix: ['J02.0'],
    rx: [{ name: 'amoxicillin 500 mg capsule', sig: 'Take 1 capsule by mouth twice daily for 10 days' }],
  }, // strep
  {
    prefix: ['H66', 'H65'],
    rx: [
      {
        name: 'amoxicillin 500 mg capsule',
        sig: 'Take 1 capsule (or weight-based suspension) by mouth twice daily for 10 days',
      },
    ],
  }, // otitis media
  {
    prefix: ['H60'],
    rx: [
      {
        name: 'ciprofloxacin-dexamethasone otic suspension',
        sig: 'Instill 4 drops into the affected ear twice daily for 7 days',
      },
    ],
  }, // otitis externa
  {
    prefix: ['A08', 'A09', 'K52'],
    rx: [{ name: 'ondansetron 4 mg ODT', sig: 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea' }],
  }, // gastroenteritis
  {
    prefix: ['L23', 'L24', 'L25', 'L30'],
    rx: [
      {
        name: 'prednisone 20 mg tablet',
        sig: 'Take 2 tablets by mouth daily for 5 days, then 1 tablet daily for 5 days',
      },
      { name: 'triamcinolone 0.1% cream', sig: 'Apply a thin layer to affected skin twice daily' },
    ],
  }, // contact dermatitis / poison ivy
  {
    prefix: ['L03'],
    rx: [{ name: 'cephalexin 500 mg capsule', sig: 'Take 1 capsule by mouth four times daily for 7 days' }],
  }, // cellulitis
  {
    prefix: ['N30', 'N39.0', 'N34'],
    rx: [{ name: 'nitrofurantoin 100 mg capsule', sig: 'Take 1 capsule by mouth twice daily for 5 days' }],
  }, // UTI / cystitis
  {
    prefix: ['N10', 'N12'],
    rx: [{ name: 'ciprofloxacin 500 mg tablet', sig: 'Take 1 tablet by mouth twice daily for 7 days' }],
  }, // pyelonephritis
  {
    prefix: ['J45'],
    rx: [
      { name: 'prednisone 20 mg tablet', sig: 'Take 2 tablets by mouth daily for 5 days' },
      { name: 'albuterol HFA 90 mcg inhaler', sig: 'Inhale 2 puffs every 4-6 hours as needed for shortness of breath' },
    ],
  }, // asthma
  {
    prefix: ['J44'],
    rx: [
      { name: 'prednisone 40 mg tablet', sig: 'Take 1 tablet by mouth daily for 5 days' },
      { name: 'azithromycin 250 mg tablet', sig: 'Take 2 tablets on day 1, then 1 tablet daily for 4 days' },
      { name: 'albuterol HFA 90 mcg inhaler', sig: 'Inhale 2 puffs every 4-6 hours as needed' },
    ],
  }, // COPD exac
  {
    prefix: ['J18', 'J15', 'J13', 'J16'],
    rx: [{ name: 'amoxicillin 875 mg tablet', sig: 'Take 1 tablet by mouth twice daily for 7 days' }],
  }, // pneumonia
  {
    prefix: ['J20'],
    rx: [{ name: 'benzonatate 100 mg capsule', sig: 'Take 1 capsule by mouth three times daily as needed for cough' }],
  }, // bronchitis
  {
    prefix: ['J01'],
    rx: [{ name: 'amoxicillin-clavulanate 875-125 mg tablet', sig: 'Take 1 tablet by mouth twice daily for 7 days' }],
  }, // sinusitis (bacterial)
  {
    prefix: ['H10.0', 'H10.3', 'H10.5'],
    rx: [
      {
        name: 'erythromycin 0.5% ophthalmic ointment',
        sig: 'Apply a thin ribbon to the affected eye(s) four times daily for 5 days',
      },
    ],
  }, // bacterial conjunctivitis
  {
    prefix: ['S93', 'S83', 'S63', 'M25.5', 'S16', 'M54', 'S39'],
    rx: [
      {
        name: 'ibuprofen 600 mg tablet',
        sig: 'Take 1 tablet by mouth every 6 hours as needed for pain (take with food)',
      },
    ],
  }, // sprain / strain / MSK
  {
    prefix: ['S52', 'S82', 'S62', 'S42', 'S72'],
    rx: [
      {
        name: 'acetaminophen 500 mg tablet',
        sig: 'Take 2 tablets by mouth every 6 hours as needed for pain (max 3 g/day)',
      },
    ],
  }, // fracture pain
  {
    prefix: ['S61', 'S51', 'S41', 'S01', 'S81'],
    rx: [{ name: 'ibuprofen 600 mg tablet', sig: 'Take 1 tablet by mouth every 6 hours as needed for pain' }],
  }, // lacerations
  {
    prefix: ['S06'],
    rx: [
      {
        name: 'acetaminophen 500 mg tablet',
        sig: 'Take 2 tablets by mouth every 6 hours as needed for headache (avoid NSAIDs)',
      },
    ],
  }, // concussion
  {
    prefix: ['K80', 'K81', 'N20', 'R10'],
    rx: [
      { name: 'ondansetron 4 mg ODT', sig: 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea' },
      {
        name: 'ketorolac 10 mg tablet',
        sig: 'Take 1 tablet by mouth every 6 hours as needed for pain for up to 5 days',
      },
    ],
  }, // biliary/renal colic
  {
    prefix: ['G43', 'R51'],
    rx: [
      {
        name: 'sumatriptan 50 mg tablet',
        sig: 'Take 1 tablet at onset of migraine; may repeat once after 2 hours (max 200 mg/day)',
      },
    ],
  }, // migraine
  {
    prefix: ['T78', 'L50'],
    rx: [
      { name: 'cetirizine 10 mg tablet', sig: 'Take 1 tablet by mouth once daily' },
      { name: 'prednisone 20 mg tablet', sig: 'Take 2 tablets by mouth daily for 3 days' },
    ],
  }, // allergic reaction / urticaria
  {
    prefix: ['K04', 'K08'],
    rx: [
      { name: 'amoxicillin 500 mg capsule', sig: 'Take 1 capsule by mouth three times daily for 7 days' },
      { name: 'ibuprofen 600 mg tablet', sig: 'Take 1 tablet by mouth every 6 hours as needed for pain' },
    ],
  }, // dental abscess
  {
    prefix: ['S05', 'T15', 'H16'],
    rx: [
      {
        name: 'erythromycin 0.5% ophthalmic ointment',
        sig: 'Apply a thin ribbon to the affected eye four times daily for 3 days',
      },
    ],
  }, // corneal abrasion / FB
  {
    prefix: ['E86', 'R11'],
    rx: [{ name: 'ondansetron 4 mg ODT', sig: 'Dissolve 1 tablet on the tongue every 8 hours as needed for nausea' }],
  }, // dehydration
];
// Viral/self-limited (no script): J06, J00, J02.9, B27, U07, J10, J11, R05, H10.1(allergic handled), B34
const NO_RX_PREFIX = ['J06', 'J00', 'J02.9', 'B27', 'U07', 'J10', 'J11', 'B34', 'R05'];

function rxFor(code: string): Rx[] {
  if (NO_RX_PREFIX.some((p) => code.startsWith(p))) return [];
  // longest-prefix match wins
  let best: { len: number; rx: Rx[] } | null = null;
  for (const entry of RX_BY_PREFIX) {
    for (const p of entry.prefix) {
      if (code.startsWith(p) && (!best || p.length > best.len)) best = { len: p.length, rx: entry.rx };
    }
  }
  return best?.rx ?? [];
}

(async () => {
  const tok = await (
    await fetch(need('AUTH0_ENDPOINT'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT,
        client_secret: process.env.AUTH0_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  const o = new Oystehr({
    accessToken: (tok as any).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  // Collect primary diagnosis per encounter.
  const encDx = new Map<string, { code: string; patientRef?: string }>();
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Condition',
      params: [
        { name: '_tag', value: DIAGNOSIS_TAG },
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const cs = b.unbundle().filter((r: any) => r.resourceType === 'Condition') as any[];
    if (!cs.length) break;
    for (const c of cs) {
      const encId = c.encounter?.reference?.split('/')?.[1];
      const code = c.code?.coding?.[0]?.code;
      if (!encId || !code) continue;
      if (!encDx.has(encId)) encDx.set(encId, { code, patientRef: c.subject?.reference }); // first = primary
    }
    offset += cs.length;
    if (cs.length < 1000) break;
  }
  console.log(`Encounters with a diagnosis: ${encDx.size}`);

  // Plan
  const planByDrug: Record<string, number> = {};
  let wouldRx = 0;
  let noMap = 0;
  for (const [, { code }] of encDx) {
    const rx = rxFor(code);
    if (!rx.length) {
      noMap++;
      continue;
    }
    wouldRx++;
    for (const r of rx) planByDrug[r.name] = (planByDrug[r.name] ?? 0) + 1;
  }
  console.log(`Encounters that map to ≥1 Rx: ${wouldRx} | no Rx (viral/unmapped): ${noMap}`);
  console.log('Rx that would be written (by drug):');
  for (const [d, n] of Object.entries(planByDrug).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${d}`);
  if (DRY) {
    console.log('\n[dry] nothing created.');
    return;
  }

  // Execute with bounded concurrency. Idempotent: skip encounters that already have an eRx.
  const entries = [...encDx.entries()].filter(([, { code }]) => rxFor(code).length);
  let created = 0;
  let skipped = 0;
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < entries.length) {
      const [encId, { code, patientRef }] = entries[i++];
      try {
        const existing = (
          await o.fhir.search({
            resourceType: 'MedicationRequest',
            params: [
              { name: 'encounter', value: `Encounter/${encId}` },
              { name: '_tag', value: ERX_TAG },
              { name: '_count', value: '1' },
            ],
          })
        ).unbundle();
        if (existing.length) {
          skipped++;
          continue;
        }
        const enc: any = await o.fhir.get({ resourceType: 'Encounter', id: encId });
        const subj = patientRef || enc.subject?.reference;
        const provRef = enc.participant
          ?.map((p: any) => p.individual?.reference)
          .find((r: string) => r?.startsWith('Practitioner/'));
        const authoredOn = enc.period?.start || enc.statusHistory?.[0]?.period?.start;
        for (const r of rxFor(code)) {
          await o.fhir.create({
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            meta: { tag: [{ code: ERX_TAG }] },
            ...(subj ? { subject: { reference: subj } } : {}),
            encounter: { reference: `Encounter/${encId}` },
            ...(authoredOn ? { authoredOn } : {}),
            ...(provRef ? { requester: { reference: provRef } } : {}),
            medicationCodeableConcept: { coding: [{ system: DRUG_SYS, display: r.name }], text: r.name },
            dosageInstruction: [{ text: r.sig, patientInstruction: r.sig }],
          } as any);
          created++;
        }
      } catch (e: any) {
        console.log(`  ✗ ${encId}: ${e?.message ?? e}`);
      }
      if ((created + skipped) % 200 === 0)
        console.log(`  …${i}/${entries.length} (created ${created}, skipped ${skipped})`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  console.log(`\nDone. Created ${created} prescriptions; skipped ${skipped} encounters (already had eRx).`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

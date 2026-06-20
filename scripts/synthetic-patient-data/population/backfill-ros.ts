// Backfills a realistic STRUCTURED Review of Systems onto existing visits.
// ROS in Ottehr is structured checkbox findings (rosObservations), NOT free text
// — free-text `ros` renders nowhere. Each diagnosis maps to per-system findings:
// positives (`<item>-reports`) + pertinent negatives (`<item>-denies`), written
// via save-chart-data `rosObservations`. Field keys come from
// packages/utils/lib/ottehr-config/review-of-systems/in-person.config.ts.
// Also deletes any leftover free-text `ros`-tagged Conditions from the earlier
// (ineffective) approach. Idempotent: skips encounters that already have
// structured ROS observations.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx backfill-ros.ts --dry
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx backfill-ros.ts [--concurrency 8]

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
const ZAMBDA = process.env.ZAMBDA_API || 'http://localhost:3000/local';
const ROS_OBS_TAG = 'ros-observation-field';

// diagnosis prefix → { reports: positive item-keys, denies: pertinent-negative item-keys }
interface RosSpec {
  reports: string[];
  denies: string[];
}
const D = (reports: string[], denies: string[]): RosSpec => ({ reports, denies });
const ROS_BY_PREFIX: Array<{ prefix: string[]; spec: RosSpec }> = [
  {
    prefix: ['J02.0', 'J02.8'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-fatigue',
        'ros-ent-sore-throat',
        'ros-ent-difficulty-swallowing',
      ],
      ['ros-respiratory-cough', 'ros-respiratory-shortness-of-breath', 'ros-gi-nausea', 'ros-ent-rhinorrhea']
    ),
  },
  {
    prefix: ['B27'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-fatigue',
        'ros-ent-sore-throat',
        'ros-ent-throat-swelling',
        'ros-heme-swollen-nodes',
      ],
      ['ros-respiratory-cough', 'ros-respiratory-shortness-of-breath']
    ),
  },
  {
    prefix: ['J06', 'J00', 'J02.9', 'B34', 'R05'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-fatigue',
        'ros-ent-nasal-congestion',
        'ros-ent-rhinorrhea',
        'ros-ent-sore-throat',
        'ros-respiratory-cough',
      ],
      ['ros-respiratory-shortness-of-breath', 'ros-gi-vomiting', 'ros-ent-ear-pain']
    ),
  },
  {
    prefix: ['U07', 'J10', 'J11'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-chills',
        'ros-constitutional-fatigue',
        'ros-ent-sore-throat',
        'ros-ent-nasal-congestion',
        'ros-respiratory-cough',
        'ros-msk-muscle-aches',
      ],
      ['ros-respiratory-shortness-of-breath', 'ros-gi-diarrhea']
    ),
  },
  {
    prefix: ['H66', 'H65'],
    spec: D(
      ['ros-constitutional-fever', 'ros-ent-ear-pain', 'ros-ent-ear-fullness'],
      ['ros-ent-sore-throat', 'ros-ent-rhinorrhea', 'ros-respiratory-cough', 'ros-ent-hearing-loss']
    ),
  },
  {
    prefix: ['H60'],
    spec: D(
      ['ros-ent-ear-pain', 'ros-ent-ear-drainage'],
      ['ros-constitutional-fever', 'ros-ent-hearing-loss', 'ros-ent-sore-throat']
    ),
  },
  {
    prefix: ['A08', 'A09', 'K52'],
    spec: D(
      [
        'ros-constitutional-fatigue',
        'ros-gi-nausea',
        'ros-gi-vomiting',
        'ros-gi-diarrhea',
        'ros-gi-abdominal-pain',
        'ros-gi-bloating',
      ],
      ['ros-gi-blood-in-stool', 'ros-gu-dysuria', 'ros-constitutional-fever']
    ),
  },
  {
    prefix: ['L23', 'L24', 'L25', 'L30'],
    spec: D(
      ['ros-skin-rash', 'ros-skin-itching', 'ros-skin-redness'],
      ['ros-constitutional-fever', 'ros-respiratory-shortness-of-breath', 'ros-skin-wounds']
    ),
  },
  {
    prefix: ['L03'],
    spec: D(
      ['ros-constitutional-fever', 'ros-skin-redness', 'ros-skin-swelling', 'ros-skin-color-changes'],
      ['ros-respiratory-shortness-of-breath', 'ros-skin-wounds']
    ),
  },
  {
    prefix: ['T78', 'L50'],
    spec: D(
      ['ros-skin-rash', 'ros-skin-itching', 'ros-skin-swelling'],
      ['ros-respiratory-shortness-of-breath', 'ros-ent-throat-swelling', 'ros-constitutional-fever']
    ),
  },
  {
    prefix: ['N30', 'N39.0', 'N34'],
    spec: D(
      ['ros-gu-dysuria', 'ros-gu-frequency', 'ros-gu-urgency', 'ros-gu-pelvic-pain'],
      ['ros-gu-flank-pain', 'ros-gu-hematuria', 'ros-gu-vaginal-discharge', 'ros-constitutional-fever']
    ),
  },
  {
    prefix: ['N10', 'N12'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-chills',
        'ros-gu-dysuria',
        'ros-gu-frequency',
        'ros-gu-flank-pain',
        'ros-gi-nausea',
      ],
      ['ros-gu-hematuria']
    ),
  },
  {
    prefix: ['J45'],
    spec: D(
      [
        'ros-respiratory-cough',
        'ros-respiratory-shortness-of-breath',
        'ros-respiratory-wheezing',
        'ros-respiratory-chest-tightness',
      ],
      ['ros-constitutional-fever', 'ros-respiratory-hemoptysis', 'ros-cardiovascular-chest-pain']
    ),
  },
  {
    prefix: ['J44'],
    spec: D(
      [
        'ros-constitutional-fatigue',
        'ros-respiratory-cough',
        'ros-respiratory-shortness-of-breath',
        'ros-respiratory-wheezing',
        'ros-respiratory-sputum',
      ],
      ['ros-respiratory-hemoptysis', 'ros-cardiovascular-chest-pain']
    ),
  },
  {
    prefix: ['J18', 'J15', 'J13', 'J16'],
    spec: D(
      [
        'ros-constitutional-fever',
        'ros-constitutional-chills',
        'ros-constitutional-fatigue',
        'ros-respiratory-cough',
        'ros-respiratory-shortness-of-breath',
        'ros-respiratory-sputum',
      ],
      ['ros-respiratory-hemoptysis']
    ),
  },
  {
    prefix: ['J20'],
    spec: D(
      [
        'ros-respiratory-cough',
        'ros-respiratory-chest-tightness',
        'ros-respiratory-sputum',
        'ros-constitutional-fatigue',
      ],
      ['ros-constitutional-fever', 'ros-respiratory-hemoptysis', 'ros-respiratory-shortness-of-breath']
    ),
  },
  {
    prefix: ['J01'],
    spec: D(
      ['ros-constitutional-fever', 'ros-ent-nasal-congestion', 'ros-ent-sinus-pain', 'ros-ent-post-nasal-drip'],
      ['ros-respiratory-shortness-of-breath', 'ros-eyes-vision-changes']
    ),
  },
  {
    prefix: ['H10'],
    spec: D(
      ['ros-eyes-redness', 'ros-eyes-discharge', 'ros-eyes-itching'],
      ['ros-eyes-vision-changes', 'ros-eyes-photophobia', 'ros-eyes-eye-pain']
    ),
  },
  {
    prefix: ['S05', 'T15', 'H16'],
    spec: D(['ros-eyes-eye-pain', 'ros-eyes-redness', 'ros-eyes-photophobia'], ['ros-eyes-vision-changes']),
  },
  {
    prefix: ['S93', 'S83', 'S63', 'S43', 'M54', 'M25', 'M72', 'M94', 'S39'],
    spec: D(
      ['ros-msk-joint-pain', 'ros-msk-joint-swelling', 'ros-msk-limited-rom'],
      ['ros-neuro-numbness', 'ros-neuro-tingling', 'ros-neuro-weakness', 'ros-constitutional-fever']
    ),
  },
  {
    prefix: ['S52', 'S82', 'S62', 'S42', 'S72', 'S92'],
    spec: D(
      ['ros-msk-joint-pain', 'ros-msk-joint-swelling', 'ros-msk-limited-rom', 'ros-msk-gait-difficulty'],
      ['ros-neuro-numbness', 'ros-skin-wounds']
    ),
  },
  {
    prefix: ['S61', 'S51', 'S41', 'S01', 'S81', 'S31'],
    spec: D(['ros-skin-wounds'], ['ros-neuro-numbness', 'ros-constitutional-fever', 'ros-neuro-weakness']),
  },
  {
    prefix: ['S06'],
    spec: D(
      ['ros-neuro-headache', 'ros-neuro-dizziness', 'ros-neuro-confusion', 'ros-eyes-photophobia'],
      ['ros-neuro-seizures', 'ros-neuro-weakness', 'ros-neuro-numbness', 'ros-gi-vomiting']
    ),
  },
  {
    prefix: ['K80', 'K81'],
    spec: D(
      ['ros-gi-abdominal-pain', 'ros-gi-nausea', 'ros-gi-vomiting'],
      ['ros-constitutional-fever', 'ros-gi-blood-in-stool']
    ),
  },
  {
    prefix: ['N20', 'N23', 'R10'],
    spec: D(
      ['ros-gi-abdominal-pain', 'ros-gi-nausea', 'ros-gu-flank-pain'],
      ['ros-constitutional-fever', 'ros-gu-dysuria']
    ),
  },
  {
    prefix: ['G43', 'R51'],
    spec: D(
      ['ros-neuro-headache', 'ros-eyes-photophobia', 'ros-gi-nausea'],
      ['ros-neuro-weakness', 'ros-neuro-numbness', 'ros-neuro-confusion']
    ),
  },
  {
    prefix: ['K04', 'K08'],
    spec: D(['ros-ent-oral-sores', 'ros-constitutional-fever'], ['ros-ent-sore-throat', 'ros-ent-ear-pain']),
  },
  {
    prefix: ['E86', 'R11'],
    spec: D(
      ['ros-constitutional-fatigue', 'ros-constitutional-poor-appetite', 'ros-gi-nausea', 'ros-gi-vomiting'],
      ['ros-gi-blood-in-stool']
    ),
  },
  {
    prefix: ['S00', 'S09', 'S10', 'S13', 'S16', 'S19', 'S20', 'S23', 'S29', 'S33', 'T07'],
    spec: D(
      ['ros-msk-neck-pain', 'ros-msk-back-pain', 'ros-msk-muscle-aches'],
      ['ros-neuro-numbness', 'ros-neuro-weakness', 'ros-neuro-confusion', 'ros-constitutional-fever']
    ),
  },
];
const GENERIC: RosSpec = D(
  [],
  [
    'ros-constitutional-fever',
    'ros-ent-sore-throat',
    'ros-respiratory-cough',
    'ros-respiratory-shortness-of-breath',
    'ros-gi-nausea',
    'ros-gi-abdominal-pain',
    'ros-gu-dysuria',
    'ros-neuro-headache',
    'ros-skin-rash',
  ]
);

function specFor(code: string): RosSpec {
  let best: { len: number; spec: RosSpec } | null = null;
  for (const e of ROS_BY_PREFIX)
    for (const p of e.prefix)
      if (code.startsWith(p) && (!best || p.length > best.len)) best = { len: p.length, spec: e.spec };
  return best?.spec ?? GENERIC;
}
function rosObservations(code: string): Array<{ field: string; value: boolean }> {
  const s = specFor(code);
  return [
    ...s.reports.map((f) => ({ field: `${f}-reports`, value: true })),
    ...s.denies.map((f) => ({ field: `${f}-denies`, value: true })),
  ];
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
  const at = (tok as any).access_token;
  const o = new Oystehr({
    accessToken: at,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const encDx = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const b = await o.fhir.search({
      resourceType: 'Condition',
      params: [
        { name: '_tag', value: 'diagnosis' },
        { name: '_count', value: '1000' },
        { name: '_offset', value: String(offset) },
      ],
    });
    const cs = b.unbundle().filter((r: any) => r.resourceType === 'Condition') as any[];
    if (!cs.length) break;
    for (const c of cs) {
      const encId = c.encounter?.reference?.split('/')?.[1];
      const code = c.code?.coding?.[0]?.code;
      if (encId && code && !encDx.has(encId)) encDx.set(encId, code);
    }
    offset += cs.length;
    if (cs.length < 1000) break;
  }
  console.log(`Encounters with a diagnosis: ${encDx.size}${DRY ? '  [DRY]' : ''}`);
  if (DRY) {
    const seen = new Set<string>();
    for (const [, code] of encDx) {
      if (seen.size >= 8) break;
      if (seen.has(code)) continue;
      seen.add(code);
      console.log(
        `  ${code.padEnd(10)} → ${rosObservations(code)
          .map((r) => r.field.replace('ros-', ''))
          .join(', ')}`
      );
    }
    const generic = [...encDx.values()].filter((c) => specFor(c) === GENERIC).length;
    console.log(`Mapped specific: ${encDx.size - generic} | generic: ${generic}`);
    return;
  }

  const entries = [...encDx.entries()];
  let wrote = 0;
  let skipped = 0;
  let freed = 0;
  let i = 0;
  const worker = async (): Promise<void> => {
    while (i < entries.length) {
      const [encId, code] = entries[i++];
      try {
        // Remove leftover free-text ros Conditions (ineffective approach).
        const stale = (
          await o.fhir.search({
            resourceType: 'Condition',
            params: [
              { name: 'encounter', value: `Encounter/${encId}` },
              { name: '_tag', value: 'ros' },
              { name: '_count', value: '10' },
            ],
          })
        ).unbundle() as any[];
        for (const c of stale) {
          if (c.id) {
            await o.fhir.delete({ resourceType: 'Condition', id: c.id }).catch(() => {});
            freed++;
          }
        }
        // Idempotency: skip if structured ROS observations already present.
        const existing = (
          await o.fhir.search({
            resourceType: 'Observation',
            params: [
              { name: 'encounter', value: `Encounter/${encId}` },
              { name: '_tag', value: ROS_OBS_TAG },
              { name: '_count', value: '1' },
            ],
          })
        ).unbundle();
        if (existing.length) {
          skipped++;
          continue;
        }
        const res = await fetch(`${ZAMBDA}/zambda/save-chart-data/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${at}`,
            'x-zapehr-project-id': need('PROJECT_ID'),
          },
          body: JSON.stringify({ encounterId: encId, rosObservations: rosObservations(code) }),
        });
        if (res.ok) wrote++;
        else console.log(`  ✗ ${encId}: ${res.status} ${(await res.text()).slice(0, 100)}`);
      } catch (e: any) {
        console.log(`  ✗ ${encId}: ${e?.message ?? e}`);
      }
      if ((wrote + skipped) % 200 === 0)
        console.log(`  …${i}/${entries.length} (wrote ${wrote}, skipped ${skipped}, freed ${freed})`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));
  console.log(
    `\nDone. Wrote structured ROS on ${wrote} encounters; skipped ${skipped}; removed ${freed} stale free-text ROS.`
  );
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

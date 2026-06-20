// Backfills condition-appropriate IN-HOUSE LAB orders WITH ENTERED RESULTS onto
// existing visits, and completes any order-only (pending) labs. Results match the
// note: confirming tests come back POSITIVE for the diagnosis, rule-out tests
// come back NEGATIVE (e.g. viral pharyngitis → strep negative). Drives the real
// lifecycle: create-in-house-lab-order → collect-in-house-lab-specimen →
// handle-in-house-lab-results, so each lands as a FINAL DiagnosticReport.
//
// PORTABLE across environments: the test catalog is resolved per-encounter from
// the target project (get-create-in-house-lab-order-resources), tests are matched
// by fuzzy name, and a needed-but-absent test is logged and skipped (never
// crashes). Result values are derived generically from each test's own
// valueSet/abnormalValues — no hardcoded observation IDs. Requirements in the
// target project: the in-house-lab feature enabled + the relevant test
// ActivityDefinitions present (Urinalysis, Rapid Strep A, COVID-19 Antigen,
// Rapid Influenza A, Monospot test). Run under the matching env so the local
// zambda server points at that project:
//
//   ENV=<env> npm run apps:start:no-apply   # server must target the same project
//   npx env-cmd -f packages/zambdas/.env/<env>.json \
//     npx tsx scripts/synthetic-patient-data/population/backfill-labs.ts --dry
//   ... backfill-labs.ts [--concurrency 4] [--limit N]

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
const LIMIT = parseInt(arg('--limit', '0'), 10);
const CONCURRENCY = parseInt(arg('--concurrency', '4'), 10);
const ZAMBDA = process.env.ZAMBDA_API || 'http://localhost:3000/local';

type Intent = 'positive' | 'negative';
// A lab spec: which catalog test (by fuzzy name aliases), the result intent, and
// for grouped tests (UA) which components to flag abnormal when positive.
interface LabSpec {
  key: string;
  aliases: string[]; // matched case-insensitively as substrings against catalog names
  intent: Intent;
  abnormalComponents?: string[]; // component-name substrings to flag when positive (grouped tests)
}
const STREP = (intent: Intent): LabSpec => ({ key: 'strep', aliases: ['rapid strep', 'strep a'], intent });
const UA = (): LabSpec => ({
  key: 'ua',
  aliases: ['urinalysis'],
  intent: 'positive',
  abnormalComponents: ['leukocyte', 'nitrite', 'blood'],
});
const COVID = (intent: Intent): LabSpec => ({
  key: 'covid',
  aliases: ['covid-19 antigen', 'covid antigen', 'covid'],
  intent,
});
const FLU = (intent: Intent): LabSpec => ({
  key: 'flu',
  aliases: ['rapid influenza a', 'influenza a', 'flu a'],
  intent,
});
const MONO = (intent: Intent): LabSpec => ({ key: 'mono', aliases: ['monospot', 'mono spot'], intent });

// ICD-10 prefix → labs to order. Positive for confirming tests, negative for rule-outs.
const LABS_BY_PREFIX: Array<{ prefix: string[]; labs: LabSpec[] }> = [
  { prefix: ['J02.0'], labs: [STREP('positive')] }, // strep pharyngitis → strep +
  { prefix: ['J02.8', 'J02.9'], labs: [STREP('negative')] }, // other/viral pharyngitis → strep − (rule out)
  { prefix: ['N30', 'N39.0', 'N34'], labs: [UA()] }, // cystitis/UTI → UA +
  { prefix: ['N10', 'N12'], labs: [UA()] }, // pyelonephritis → UA +
  { prefix: ['U07.1'], labs: [COVID('positive')] }, // COVID → antigen +
  { prefix: ['J10', 'J11'], labs: [FLU('positive')] }, // influenza → rapid flu +
  { prefix: ['B27'], labs: [MONO('positive')] }, // mono → monospot +
  { prefix: ['J06', 'J00', 'B34'], labs: [COVID('negative')] }, // viral URI/illness → COVID − (ruled out)
];
function labsFor(code: string): LabSpec[] {
  let best: { len: number; labs: LabSpec[] } | null = null;
  for (const e of LABS_BY_PREFIX)
    for (const p of e.prefix)
      if (code.startsWith(p) && (!best || p.length > best.len)) best = { len: p.length, labs: e.labs };
  return best?.labs ?? [];
}

const hdr = (at: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${at}`,
  'x-zapehr-project-id': need('PROJECT_ID'),
});
const zpost = async (
  at: string,
  name: string,
  body: unknown
): Promise<{ ok: boolean; status: number; json: any; text: string }> => {
  const r = await fetch(`${ZAMBDA}/zambda/${name}/execute`, {
    method: 'POST',
    headers: hdr(at),
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { ok: r.ok, status: r.status, json, text };
};

// Build the ResultEntryInput { [observationDefinitionId]: codeString } for a test.
function buildResult(testItem: any, spec: LabSpec): Record<string, string> {
  const comps: any[] = testItem.components?.components || [];
  const single = comps.length === 1;
  const data: Record<string, string> = {};
  for (const c of comps) {
    const abn: string[] = (c.abnormalValues || []).map((v: any) => v.code);
    const vs: string[] = (c.valueSet || []).map((v: any) => v.code);
    const normalCode = vs.find((code) => !abn.includes(code)) ?? c.nullOption?.code ?? '';
    if (c.dataType === 'CodeableConcept') {
      const isHeadline =
        single || (spec.abnormalComponents ?? []).some((n) => (c.componentName || '').toLowerCase().includes(n));
      data[c.observationDefinitionId] =
        spec.intent === 'positive' && isHeadline ? abn[abn.length - 1] ?? abn[0] ?? normalCode : normalCode;
    } else if (c.dataType === 'Quantity') {
      const r = c.normalRange;
      const mid =
        r && typeof r.low?.value === 'number' && typeof r.high?.value === 'number'
          ? (r.low.value + r.high.value) / 2
          : /gravity/i.test(c.componentName)
          ? 1.015
          : /ph/i.test(c.componentName)
          ? 6.0
          : 0;
      data[c.observationDefinitionId] = String(mid);
    } else {
      data[c.observationDefinitionId] = c.nullOption?.code ?? '';
    }
  }
  return data;
}

const tally: Record<string, number> = {};
const note = (k: string): void => {
  tally[k] = (tally[k] || 0) + 1;
};

async function processEncounter(o: Oystehr, at: string, encId: string, code: string, cond: any): Promise<void> {
  const specs = labsFor(code);
  if (!specs.length) return;
  const enc: any = await o.fhir.get({ resourceType: 'Encounter', id: encId });
  const provRef = enc.participant
    ?.map((p: any) => p.individual?.reference)
    .find((r: string) => r?.startsWith('Practitioner/'));
  const provId = provRef?.split('/')[1];
  const collectionDate =
    enc.period?.start || enc.statusHistory?.[0]?.period?.start || cond.recordedDate || '2026-01-01T12:00:00Z';

  // Catalog for this encounter (target project's actual tests).
  const cat = await zpost(at, 'get-create-in-house-lab-order-resources', { encounterId: encId });
  if (!cat.ok) {
    note('catalog-fail');
    return;
  }
  const catalogLabs: any[] = (cat.json.output || cat.json).labs || (cat.json.output || cat.json).testItems || [];

  // Existing lab ServiceRequests on the encounter (to dedupe/complete).
  const existingSR = (
    await o.fhir.search({
      resourceType: 'ServiceRequest',
      params: [
        { name: 'encounter', value: `Encounter/${encId}` },
        { name: '_count', value: '50' },
      ],
    })
  ).unbundle() as any[];
  const isLabSR = (s: any): boolean =>
    !!(s.code?.text || s.code?.coding?.[0]?.display) &&
    !(s.meta?.tag || []).some((t: any) =>
      ['disposition-follow-up', 'sub-follow-up', 'procedure', 'radiology'].includes(t.code)
    );

  for (const spec of specs) {
    // Prefer the earliest-listed alias (most specific, e.g. "rapid influenza a"
    // over "flu a") so test selection is deterministic across runs/projects.
    let testItem: any;
    for (const a of spec.aliases) {
      testItem = catalogLabs.find((l: any) => (l.name || '').toLowerCase().includes(a));
      if (testItem) break;
    }
    if (!testItem) {
      note(`missing-in-catalog:${spec.key}`);
      continue;
    }
    const testName = testItem.name;

    // Already finalized for this test? Match existing orders by the SAME alias
    // set used to pick the catalog test (NOT just aliases[0]) — otherwise an
    // order created under a different alias (e.g. "Flu A" vs "Rapid Influenza A")
    // is missed and a duplicate is created.
    const srName = (s: any): string => (s.code?.text || s.code?.coding?.[0]?.display || '').toLowerCase();
    const matchingSR = existingSR.filter(
      (s) => isLabSR(s) && (srName(s) === testName.toLowerCase() || spec.aliases.some((a) => srName(s).includes(a)))
    );
    let srId: string | undefined;
    let alreadyFinal = false;
    for (const s of matchingSR) {
      const drs = (
        await o.fhir.search({
          resourceType: 'DiagnosticReport',
          params: [
            { name: 'based-on', value: `ServiceRequest/${s.id}` },
            { name: '_count', value: '1' },
          ],
        })
      ).unbundle();
      if (drs.length) {
        alreadyFinal = true;
        break;
      }
      srId = s.id; // pending order we can complete
    }
    if (alreadyFinal) {
      note(`skip-final:${spec.key}`);
      continue;
    }
    if (DRY) {
      note(`would:${spec.key}:${spec.intent}`);
      continue;
    }

    const dx = [{ code: cond.code.coding[0].code, display: cond.code.coding[0].display, isPrimary: true }];
    if (!srId) {
      const ord = await zpost(at, 'create-in-house-lab-order', {
        encounterId: encId,
        testItems: [testItem],
        diagnosesAll: dx,
        diagnosesNew: dx,
        notes: '',
      });
      if (!ord.ok) {
        note(`order-fail:${spec.key}`);
        console.log(`  ✗ ${encId} order ${spec.key}: ${ord.text.slice(0, 120)}`);
        continue;
      }
      srId = (ord.json.output?.serviceRequestIds ?? ord.json.serviceRequestIds ?? [])[0];
    }
    if (!srId) {
      note(`no-sr:${spec.key}`);
      continue;
    }

    const col = await zpost(at, 'collect-in-house-lab-specimen', {
      encounterId: encId,
      serviceRequestId: srId,
      data: { specimen: { source: testName, collectionDate, collectedBy: { id: provId, name: 'Provider' } } },
    });
    // An order created by the original build is already collected (create+collect,
    // no results) — collect then 400s "already been completed". That's fine: the
    // specimen exists, so proceed straight to result entry. Only a genuine collect
    // failure (not the already-collected case) aborts this test.
    const alreadyCollected = !col.ok && /already been completed|already collected/i.test(col.text);
    if (!col.ok && !alreadyCollected) {
      note(`collect-fail:${spec.key}`);
      console.log(`  ✗ ${encId} collect ${spec.key}: ${col.text.slice(0, 120)}`);
      continue;
    }

    const data = buildResult(testItem, spec);
    const r = await zpost(at, 'handle-in-house-lab-results', { serviceRequestId: srId, data });
    if (!r.ok) {
      note(`result-fail:${spec.key}`);
      console.log(`  ✗ ${encId} result ${spec.key}: ${r.text.slice(0, 120)}`);
      continue;
    }
    note(`done:${spec.key}:${spec.intent}`);
  }
}

async function main(): Promise<void> {
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

  // All encounter diagnoses → primary code (first per encounter).
  const encDx = new Map<string, any>();
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
      const encId = c.encounter?.reference?.split('/')[1];
      if (encId && c.code?.coding?.[0]?.code && !encDx.has(encId)) encDx.set(encId, c);
    }
    offset += cs.length;
    if (cs.length < 1000) break;
  }
  const targets = [...encDx.entries()].filter(([, c]) => labsFor(c.code.coding[0].code).length);
  const slice = LIMIT ? targets.slice(0, LIMIT) : targets;
  console.log(`Encounters needing labs: ${targets.length}; processing: ${slice.length}${DRY ? '  [DRY]' : ''}`);

  let idx = 0;
  const worker = async (): Promise<void> => {
    while (idx < slice.length) {
      const [encId, cond] = slice[idx++];
      try {
        await processEncounter(o, at, encId, cond.code.coding[0].code, cond);
      } catch (e: any) {
        note('exception');
        console.log(`  ✗ ${encId}: ${e?.message ?? e}`);
      }
      const total = Object.entries(tally)
        .filter(([k]) => k.startsWith('done') || k.startsWith('would'))
        .reduce((s, [, n]) => s + n, 0);
      if (total && total % 100 === 0) console.log(`  …${idx}/${slice.length}`);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker()));

  console.log('\nSummary:');
  for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${k}`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

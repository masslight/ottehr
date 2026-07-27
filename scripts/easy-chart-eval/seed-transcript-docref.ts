/**
 * seed-transcript-docref.ts — create a visit-transcript DocumentReference on an
 * encounter, mimicking exactly what the ambient-scribe / HPI-chatbot backend
 * writes (packages/zambdas/src/shared/ai.ts createDocumentReference), so the
 * easy-chart transcript-priming UI has something to show without recording audio.
 *
 * The get-chart-data mapper only requires type.coding[0].code === '11488-4'
 * (Consult note) for the doc to land in chartData.aiChat.documents; description
 * decides the source icon (audio vs chat).
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx <this file> <encounterId> --file <transcript.txt> [--source audio|chat] \
 *       [--practitioner <id|auto>] [--precompute] [--execute]
 *
 * --practitioner (audio only; default 'auto') stamps the provider extension the
 * backend writes so the EHR shows the recording provider instead of "Unknown".
 * 'auto' resolves the Practitioner from the encounter's participants; an explicit
 * id is used as Practitioner/<id>. Ignored for chat (the real chat path writes no
 * extension and the UI labels chat docs "AI Chat").
 *
 * --precompute additionally runs the easy-chart planner on the transcript (via the
 * LOCAL zambda server — start it with `npm run zambdas:start`; AI credentials stay
 * server-side) and stamps the resulting plan on the DocumentReference the same way
 * the recording pipeline does, so the client's precomputed-plan cache path can be
 * exercised. Planner failure only warns — the doc is still created without the plan.
 */
import { readFileSync } from 'node:fs';
import Oystehr from '@oystehr/sdk';
import {
  buildEasyChartNoteContext,
  buildEasyChartStateSummary,
  EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL,
  EASY_CHART_PRECOMPUTED_PLAN_VERSION,
  EasyChartPlannerStep,
  EasyChartTokenUsage,
  GetChartDataResponse,
  progressNoteChartDataRequestedFields,
  PUBLIC_EXTENSION_BASE_URL,
} from 'utils';

const args = process.argv.slice(2);
const encounterId = args.find((a) => !a.startsWith('--'));
const fileIdx = args.indexOf('--file');
const filePath = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
const sourceIdx = args.indexOf('--source');
const source = sourceIdx >= 0 ? args[sourceIdx + 1] : 'audio';
const practitionerIdx = args.indexOf('--practitioner');
const practitioner = practitionerIdx >= 0 ? args[practitionerIdx + 1] : 'auto';
const isPrecompute = args.includes('--precompute');
const isExecute = args.includes('--execute');

if (!encounterId || !filePath || !['audio', 'chat'].includes(source) || !practitioner) {
  console.error(
    'Usage: tsx seed-transcript-docref.ts <encounterId> --file <transcript.txt> [--source audio|chat] [--practitioner <id|auto>] [--precompute] [--execute]'
  );
  process.exit(1);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

const DESCRIPTION = source === 'audio' ? 'Summary of visit from audio recording' : 'Summary of visit from chat';

// Same origin the sibling synth scripts target: the local zambda server mounts every route under
// /local (see packages/zambdas/src/local-server/index.ts).
const ZAMBDA_API = process.env.ZAMBDA_API ?? 'http://localhost:3000/local';

// Mirrors packages/zambdas/src/shared/easy-chart/precompute.ts through the REAL zambdas: the same
// two-fetch chart merge (chartState is the cache-equality key, so it must byte-match what the
// client builds at generate time), the same planner input, the same extension payload.
async function precomputePlanExtension(
  oystehr: Oystehr,
  transcript: string
): Promise<{ url: string; valueString: string }> {
  const exec = async (id: string, body: Record<string, unknown>): Promise<unknown> => {
    const res = (await oystehr.zambda.execute({ id, ...body })) as { output?: unknown };
    return res.output ?? res;
  };
  const [noteFields, fullChart] = (await Promise.all([
    exec('get-chart-data', {
      encounterId,
      requestedFields: { ...progressNoteChartDataRequestedFields, vitalsObservations: {} },
    }),
    exec('get-chart-data', { encounterId }),
  ])) as [GetChartDataResponse, GetChartDataResponse];
  const chartData = { ...fullChart, ...noteFields };
  // Lab orders are omitted like the server-side precompute: if the client has orders at generate
  // time its chartState differs and the cache correctly misses.
  const chartState = buildEasyChartStateSummary(chartData, []);
  const noteContext = buildEasyChartNoteContext(chartData);
  const plan = (await exec('easy-chart-planner', {
    narrative: transcript,
    noteContext,
    chartState,
    encounterId,
    incremental: false,
  })) as { steps?: EasyChartPlannerStep[]; usage?: EasyChartTokenUsage };
  const steps = plan.steps ?? [];
  console.log(`precomputed plan: ${steps.length} steps`);
  return {
    url: EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL,
    valueString: JSON.stringify({ v: EASY_CHART_PRECOMPUTED_PLAN_VERSION, chartState, steps, usage: plan.usage }),
  };
}

async function main(): Promise<void> {
  const transcript = readFileSync(filePath!, 'utf8');
  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
      grant_type: 'client_credentials',
    }),
  });
  if (!tokenRes.ok) throw new Error(`auth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API'), zambdaApiUrl: ZAMBDA_API },
  });

  const enc = (await oystehr.fhir.get({ resourceType: 'Encounter', id: encounterId! })) as {
    subject?: { reference?: string };
    participant?: { individual?: { reference?: string }; type?: { coding?: { code?: string }[] }[] }[];
  };
  const patientRef = enc.subject?.reference;
  if (!patientRef) throw new Error('Encounter has no subject');

  let providerRef: string | undefined;
  if (source === 'audio') {
    if (practitioner === 'auto') {
      const practitionerParticipants = (enc.participant ?? []).filter(
        (p) => p.individual?.reference?.startsWith('Practitioner/')
      );
      const attender = practitionerParticipants.find(
        (p) => p.type?.some((t) => t.coding?.some((c) => c.code === 'ATND'))
      );
      providerRef = (attender ?? practitionerParticipants[0])?.individual?.reference;
      if (!providerRef) {
        console.warn(
          'WARNING: no Practitioner participant found on encounter — creating doc without provider extension'
        );
      }
    } else {
      providerRef = `Practitioner/${practitioner}`;
    }
  }

  console.log(
    `Encounter ${encounterId} → ${patientRef}; source=${source}; provider=${providerRef ?? 'none'}; transcript ${
      transcript.length
    } chars`
  );

  // Planner failure must not fail seeding: warn and create the doc without the plan extension.
  let planExtension: { url: string; valueString: string } | undefined;
  if (isPrecompute && isExecute) {
    try {
      planExtension = await precomputePlanExtension(oystehr, transcript);
    } catch (e) {
      console.warn(
        `WARNING: plan precompute failed — creating doc without the plan extension (is the local zambda server running at ${ZAMBDA_API}?):`,
        e
      );
    }
  } else if (isPrecompute) {
    console.log('(dry-run — would precompute a planner plan and stamp it on the doc)');
  }

  const extensions = [
    ...(providerRef
      ? [{ url: `${PUBLIC_EXTENSION_BASE_URL}/provider`, valueReference: { reference: providerRef } }]
      : []),
    ...(planExtension ? [planExtension] : []),
  ];
  const docRef = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }] },
    category: [{ coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summarization of episode note' }] }],
    description: DESCRIPTION,
    ...(extensions.length > 0 ? { extension: extensions } : {}),
    subject: { reference: patientRef },
    date: new Date().toISOString(),
    content: [
      {
        attachment: {
          contentType: 'text/plain',
          title: 'Transcript',
          // same bytes as the server's btoa(unescape(encodeURIComponent(s)))
          data: Buffer.from(transcript, 'utf8').toString('base64'),
        },
      },
    ],
    context: { encounter: [{ reference: `Encounter/${encounterId}` }] },
  };

  if (!isExecute) {
    console.log('(dry-run — pass --execute to create)');
    return;
  }
  const created = (await oystehr.fhir.create(docRef as never)) as { id?: string };
  console.log(`Created DocumentReference/${created.id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

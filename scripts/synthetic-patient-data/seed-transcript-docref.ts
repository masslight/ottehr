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
 *     npx tsx <this file> <encounterId> --file <transcript.txt> [--source audio|chat] [--execute]
 */
import { readFileSync } from 'node:fs';
import Oystehr from '@oystehr/sdk';

const args = process.argv.slice(2);
const encounterId = args.find((a) => !a.startsWith('--'));
const fileIdx = args.indexOf('--file');
const filePath = fileIdx >= 0 ? args[fileIdx + 1] : undefined;
const sourceIdx = args.indexOf('--source');
const source = sourceIdx >= 0 ? args[sourceIdx + 1] : 'audio';
const isExecute = args.includes('--execute');

if (!encounterId || !filePath || !['audio', 'chat'].includes(source)) {
  console.error(
    'Usage: tsx seed-transcript-docref.ts <encounterId> --file <transcript.txt> [--source audio|chat] [--execute]'
  );
  process.exit(1);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

const DESCRIPTION = source === 'audio' ? 'Summary of visit from audio recording' : 'Summary of visit from chat';

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
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const enc = (await oystehr.fhir.get({ resourceType: 'Encounter', id: encounterId! })) as {
    subject?: { reference?: string };
  };
  const patientRef = enc.subject?.reference;
  if (!patientRef) throw new Error('Encounter has no subject');
  console.log(`Encounter ${encounterId} → ${patientRef}; source=${source}; transcript ${transcript.length} chars`);

  const docRef = {
    resourceType: 'DocumentReference',
    status: 'current',
    type: { coding: [{ system: 'http://loinc.org', code: '11488-4', display: 'Consult note' }] },
    category: [{ coding: [{ system: 'http://loinc.org', code: '34133-9', display: 'Summarization of episode note' }] }],
    description: DESCRIPTION,
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

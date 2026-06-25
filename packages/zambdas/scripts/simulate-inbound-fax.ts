// Simulate an inbound fax end-to-end, the way the real pipeline works:
//   1. Upload a PDF to Z3 (stands in for what the fax provider's webhook stores).
//   2. Create a Communication (medium=FAXWRIT, status=completed) with the PDF attachment.
//   3. POST it to the LOCAL handle-inbound-fax subscription handler, which creates the
//      match-inbound-fax Task + provider notifications — exactly what the FHIR subscription does.
// Usage: tsx scripts/simulate-inbound-fax.ts <pdfPath> [secrets=.env/zambda-secrets-synth.json]
import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { DateTime } from 'luxon';
import { getAuth0Token } from '../src/shared/getAuth0Token';
import { createPresignedUrl, uploadObjectToZ3 } from '../src/shared/z3Utils';

const SENDER_FAX = '+15035551234';
const LOCAL_ZAMBDA = 'http://localhost:3000/local/zambda/handle-inbound-fax/execute-public';

function countPdfPages(buf: Buffer): number {
  const matches = buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g);
  return matches?.length || 1;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const pdfPath = args.find((a) => !a.startsWith('secrets=')) ?? '';
  const secretsArg = args.find((a) => a.startsWith('secrets='))?.split('=')[1] ?? '.env/zambda-secrets-synth.json';
  if (!pdfPath) throw new Error('Provide a PDF path');
  const secrets = JSON.parse(readFileSync(secretsArg, 'utf-8'));
  const pdfBytes = readFileSync(pdfPath);
  const pageCount = countPdfPages(pdfBytes);
  const fileName = pdfPath.split('/').pop() ?? 'fax.pdf';

  const token = await getAuth0Token(secrets);
  const projectId: string = secrets.PROJECT_ID;
  const projectApi: string = secrets.PROJECT_API;
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: secrets.FHIR_API.replace(/\/r4/g, ''),
    projectApiUrl: projectApi,
  });

  // 1. Upload the PDF to Z3 (visit-notes bucket, inbound-fax-demo path).
  const stamp = DateTime.utc().toFormat('yyyy-MM-dd-x');
  const z3Url = `${projectApi}/z3/${projectId}-visit-notes/inbound-fax-demo/${stamp}-${fileName}`;
  console.log('Uploading PDF →', z3Url);
  const uploadUrl = await createPresignedUrl(token, z3Url, 'upload');
  await uploadObjectToZ3(Uint8Array.from(pdfBytes), uploadUrl);
  console.log('  upload OK');

  // 2. Create the Communication that represents the received fax.
  const nowIso = DateTime.utc().toISO()!;
  const communication = await oystehr.fhir.create<Communication>({
    resourceType: 'Communication',
    status: 'completed',
    medium: [
      {
        coding: [
          { system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationMode', code: 'FAXWRIT', display: 'telefax' },
        ],
      },
    ],
    sent: nowIso,
    received: nowIso,
    contained: [{ resourceType: 'Device', id: 'sender-device', identifier: [{ value: SENDER_FAX }] }],
    sender: { reference: '#sender-device' },
    payload: [{ contentAttachment: { contentType: 'application/pdf', title: fileName, url: z3Url } }],
    extension: [{ url: 'https://extensions.fhir.oystehr.com/fax-pages', valueInteger: pageCount }],
  });
  console.log(`Created Communication/${communication.id} (sender ${SENDER_FAX}, ${pageCount} pages)`);

  // 3. Fire the subscription handler locally → it creates the match-inbound-fax Task + notifications.
  const resp = await fetch(LOCAL_ZAMBDA, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(communication),
  });
  const text = await resp.text();
  console.log(`handle-inbound-fax → HTTP ${resp.status}: ${text.slice(0, 300)}`);

  console.log('\n✅ Done. Open the match page:');
  console.log(`   http://localhost:4002/inbound-fax/${communication.id}/match`);
  console.log('   (or find it under the Tasks tab as "Inbound fax from …")');
}

main().catch((e) => {
  console.error('Failed:', e);
  process.exit(1);
});

import Oystehr from '@oystehr/sdk';

const patientId = process.argv[2];
const encounterId = process.argv[3];
if (!patientId) {
  console.error('Usage: tsx inspect-docs.ts <patientId> [encounterId]');
  process.exit(1);
}

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function main(): Promise<void> {
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
  if (!tokenRes.ok) throw new Error(`Auth0 failed: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  console.log(`=== DocumentReference for Patient/${patientId} ===`);
  const docs = (
    await oystehr.fhir.search({
      resourceType: 'DocumentReference',
      params: [{ name: 'subject', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  console.log(`count: ${docs.length}`);
  for (const d of docs as any[]) {
    console.log(`  id=${d.id}`);
    console.log(`    status=${d.status} docStatus=${d.docStatus}`);
    console.log(`    type=${JSON.stringify(d.type?.coding)}`);
    console.log(`    category=${JSON.stringify(d.category)}`);
    const att = d.content?.[0]?.attachment;
    console.log(`    attachment.url=${att?.url}`);
    console.log(`    attachment.contentType=${att?.contentType}`);
    console.log(`    attachment.title=${att?.title}`);
    console.log(`    context.encounter=${JSON.stringify(d.context?.encounter)}`);
  }

  console.log(`\n=== List for Patient/${patientId} ===`);
  const lists = (
    await oystehr.fhir.search({
      resourceType: 'List',
      params: [{ name: 'subject', value: `Patient/${patientId}` }],
    })
  ).unbundle();
  console.log(`count: ${lists.length}`);
  for (const l of lists as any[]) {
    console.log(`  id=${l.id} status=${l.status} mode=${l.mode}`);
    console.log(`    title=${l.title}`);
    console.log(`    code=${JSON.stringify(l.code?.coding)}`);
    console.log(`    entries=${(l.entry ?? []).length}`);
    for (const e of l.entry ?? []) {
      console.log(`      → ${e.item?.reference}`);
    }
  }

  if (encounterId) {
    console.log(`\n=== Tasks for QR-driven harvest (search by code/status) ===`);
    const tasks = (
      await oystehr.fhir.search({
        resourceType: 'Task',
        params: [
          { name: 'patient', value: `Patient/${patientId}` },
          { name: '_count', value: '50' },
        ],
      })
    ).unbundle();
    console.log(`count: ${tasks.length}`);
    for (const t of tasks as any[]) {
      console.log(`  id=${t.id} status=${t.status} statusReason=${t.statusReason?.code ?? ''}`);
      console.log(`    code=${JSON.stringify(t.code?.coding)}`);
      console.log(`    focus=${t.focus?.reference}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

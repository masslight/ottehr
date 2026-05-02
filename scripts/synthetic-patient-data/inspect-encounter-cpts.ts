import Oystehr from '@oystehr/sdk';
const encounterId = process.argv[2];
async function main(): Promise<void> {
  const tokenRes = await fetch(process.env.AUTH0_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: process.env.PROJECT_ID!,
    services: { projectApiUrl: process.env.PROJECT_API! },
  });
  const procs = (
    await oystehr.fhir.search({
      resourceType: 'Procedure',
      params: [{ name: 'encounter', value: `Encounter/${encounterId}` }],
    })
  ).unbundle();
  console.log(`Procedures on Encounter/${encounterId}: ${procs.length}`);
  for (const p of procs as any[]) {
    const code = p.code?.coding?.[0];
    const cat = p.category?.coding?.[0];
    console.log(
      `  id=${p.id} code=${code?.system}|${code?.code} (${code?.display}) cat=${cat?.code} status=${p.status}`
    );
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

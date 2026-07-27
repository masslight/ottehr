import Oystehr from '@oystehr/sdk';

function need(n: string): string {
  const v = process.env[n];
  if (!v) throw new Error(`Missing env: ${n}`);
  return v;
}

async function run(): Promise<void> {
  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: need('AUTH0_CLIENT'),
      client_secret: need('AUTH0_SECRET'),
      audience: need('AUTH0_AUDIENCE'),
    }),
  });
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });
  const bundle = await oystehr.fhir.search<any>({
    resourceType: 'DocumentReference',
    params: [{ name: 'encounter', value: `Encounter/${process.argv[2]}` }],
  });
  for (const dr of bundle.unbundle()) {
    const hasPlan = (dr.extension ?? []).some(
      (e: any) => e.url === 'https://extensions.fhir.zapehr.com/easy-chart-precomputed-plan'
    );
    console.log(
      `${dr.id}  status=${dr.status}  desc="${dr.description}"  created=${
        dr.date ?? dr.meta?.lastUpdated
      }  plan=${hasPlan}`
    );
  }
}

void run().catch((e) => {
  console.error(e);
  process.exit(1);
});

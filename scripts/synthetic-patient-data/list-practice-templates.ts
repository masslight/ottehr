import Oystehr from '@oystehr/sdk';

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
  if (!tokenRes.ok) throw new Error(`auth: ${tokenRes.status}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });
  const res = await (oystehr as any).zambda.execute({ id: 'list-templates', includeVersionData: false });
  const templates = res?.output?.templates ?? res?.templates ?? [];
  console.log(`Templates: ${templates.length}`);
  for (const t of templates) {
    console.log(`  ${t.id ?? '?'}\t${t.title ?? '?'}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

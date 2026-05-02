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
  const projectId = process.env.PROJECT_ID!;

  // Fee schedule applicable for our payer + appointment date + location.
  const payerOrgId = '0a2811e6-e21e-49c9-a51b-de85778c6ba3'; // TN BCBS
  const locationId = '1d34acf7-88d2-4e48-9739-6883eced1b20'; // New York
  const dateOfService = '2026-05-01';

  for (const id of ['find-applicable-fee-schedule', 'find-applicable-charge-master']) {
    const res = await fetch(`http://localhost:3000/local/zambda/${id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${access_token}`,
        'x-zapehr-project-id': projectId,
      },
      body: JSON.stringify({ payerOrganizationId: payerOrgId, dateOfService, locationId }),
    });
    const txt = await res.text();
    console.log(`\n=== ${id} ===\nstatus: ${res.status}\nbody: ${txt.slice(0, 2000)}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

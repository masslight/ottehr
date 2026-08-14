import { mintAccessToken, need } from './shared/oystehr-client';
import { zambdaPost } from './shared/zambda';

async function main(): Promise<void> {
  const accessToken = await mintAccessToken();
  const ctx = { zambdaApi: 'http://localhost:3000/local', accessToken, projectId: need('PROJECT_ID') };

  // Fee schedule applicable for our payer + appointment date + location.
  const payerOrgId = '0a2811e6-e21e-49c9-a51b-de85778c6ba3'; // TN BCBS
  const locationId = '1d34acf7-88d2-4e48-9739-6883eced1b20'; // New York
  const dateOfService = '2026-05-01';

  for (const id of ['find-applicable-fee-schedule', 'find-applicable-charge-master']) {
    const res = await zambdaPost(ctx, id, { payerOrganizationId: payerOrgId, dateOfService, locationId });
    const txt = await res.text();
    console.log(`\n=== ${id} ===\nstatus: ${res.status}\nbody: ${txt.slice(0, 2000)}`);
  }
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});

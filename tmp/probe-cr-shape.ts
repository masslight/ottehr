/* eslint-disable no-console */
// Read-only probe of urgikids ClaimResponse shape: insurer display, contained resources, DOS fields.
import { readFileSync } from 'fs';

async function main(): Promise<void> {
  const secrets = JSON.parse(readFileSync('packages/zambdas/.env/urgikids-production.json', 'utf8'));
  const tokenRes = await fetch(`${secrets.AUTH0_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: secrets.AUTH0_CLIENT,
      client_secret: secrets.AUTH0_SECRET,
      audience: secrets.AUTH0_AUDIENCE,
    }),
  });
  const { access_token } = await tokenRes.json();
  const get = async (path: string): Promise<any> =>
    (await fetch(`${secrets.FHIR_API}/${path}`, { headers: { Authorization: `Bearer ${access_token}` } })).json();

  const bundle = await get('ClaimResponse?_count=40&_sort=-_lastUpdated');
  let inspected = 0;
  for (const entry of bundle.entry ?? []) {
    const cr = entry.resource;
    if (inspected >= 8) break;
    inspected++;
    const containedTypes = (cr.contained ?? []).map((r: any) => r.resourceType);
    const containedClaim = (cr.contained ?? []).find((r: any) => r.resourceType === 'Claim');
    console.log({
      id: cr.id?.slice(0, 8),
      outcome: cr.outcome,
      requestRef: cr.request?.reference?.slice(0, 30),
      requestIdentifier: cr.request?.identifier?.value?.slice(0, 20),
      insurerDisplay: cr.insurer?.display,
      insurerRef: cr.insurer?.reference?.slice(0, 50),
      containedTypes,
      containedClaimCreated: containedClaim?.created,
      containedClaimItemDates: (containedClaim?.item ?? [])
        .slice(0, 2)
        .map((i: any) => i.servicedPeriod?.start ?? i.servicedDate),
    });
  }
}

main().catch((e) => console.log('ERROR:', e?.message));

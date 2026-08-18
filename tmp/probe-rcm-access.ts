/* eslint-disable no-console */
// Read-only probe: can each project's M2M token read the RCM payer directory?
import { readFileSync } from 'fs';

async function tokenFor(file: string): Promise<{ token: string; label: string }> {
  const secrets = JSON.parse(readFileSync(`packages/zambdas/.env/${file}`, 'utf8'));
  const res = await fetch(`${secrets.AUTH0_ENDPOINT}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: secrets.AUTH0_CLIENT,
      client_secret: secrets.AUTH0_SECRET,
      audience: secrets.AUTH0_AUDIENCE,
    }),
  });
  const { access_token } = await res.json();
  return { token: access_token, label: file };
}

async function main(): Promise<void> {
  for (const file of ['urgikids-production.json', 'zambda-secrets-local.json']) {
    const { token, label } = await tokenFor(file);
    const res = await fetch('https://rcm-api.zapehr.com/v1/payer/99726', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.text();
    console.log(label, '->', res.status, body.slice(0, 160));
  }
}

main().catch((e) => console.log('ERROR:', e?.message));

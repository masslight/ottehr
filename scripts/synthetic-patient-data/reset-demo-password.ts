// Set the password for demo@ottehr.com in the project the M2M creds target.
// The password is read from the NEW_PASSWORD env var (never hard-coded), so it stays in your shell.
// Run: NEW_PASSWORD='...' npx env-cmd -f packages/zambdas/.env/synth.json npx tsx scripts/synthetic-patient-data/reset-demo-password.ts
import Oystehr from '@oystehr/sdk';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};

async function main(): Promise<void> {
  const newPassword = process.env.NEW_PASSWORD ?? '';
  if (!newPassword) throw new Error('Set the NEW_PASSWORD env var to the password you want.');

  const tokenRes = await fetch(need('AUTH0_ENDPOINT'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  const token = (await tokenRes.json()) as { access_token: string };

  const oystehr = new Oystehr({
    accessToken: token.access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const user = (await oystehr.user.list()).find((u) => (u.email || '').toLowerCase() === 'demo@ottehr.com');
  if (!user) throw new Error('demo@ottehr.com not found in this project.');

  await oystehr.user.changePassword({ id: user.id, password: newPassword });
  console.log(`Password updated for demo@ottehr.com (${user.id}).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

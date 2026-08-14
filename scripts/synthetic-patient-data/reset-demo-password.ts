// Set the password for demo@ottehr.com in the project the M2M creds target.
// The password is read from the NEW_PASSWORD env var (never hard-coded), so it stays in your shell.
// Run: NEW_PASSWORD='...' npx env-cmd -f packages/zambdas/.env/synth.json npx tsx scripts/synthetic-patient-data/reset-demo-password.ts
import { createOystehrFromEnv } from './shared/oystehr-client';

async function main(): Promise<void> {
  const newPassword = process.env.NEW_PASSWORD ?? '';
  if (!newPassword) throw new Error('Set the NEW_PASSWORD env var to the password you want.');

  const oystehr = await createOystehrFromEnv();

  const user = (await oystehr.user.list()).find((u) => (u.email || '').toLowerCase() === 'demo@ottehr.com');
  if (!user) throw new Error('demo@ottehr.com not found in this project.');

  await oystehr.user.changePassword({ id: user.id, password: newPassword });
  console.log(`Password updated for demo@ottehr.com (${user.id}).`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

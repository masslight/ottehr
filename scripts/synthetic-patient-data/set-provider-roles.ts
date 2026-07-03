// Grants the Provider IAM role to the synth provider employees in a target env,
// so they count as providers (get-employees isProvider=true) and the census can
// attribute visits to them. Created employees default to Staff only; this is the
// follow-up that the EHR's edit-employee form does via the `update-user` zambda.
//
// Runs through the LOCAL zambda server (boot an ephemeral one first — see the
// inline server boot in the companion shell, or pass --zambda-api). update-user
// authenticates with the env's privileged zambda-secrets M2M (same token the
// census already uses to read role membership), so no browser/IAM-token needed.
//
//   npx env-cmd -f packages/zambdas/.env/demo.json npx tsx \
//     scripts/synthetic-patient-data/set-provider-roles.ts --zambda-api http://localhost:3010/local
//
// Matches synth: providers carry the Provider role only (credential → providerType).

import { arg } from './shared/cli';
import { mintAccessToken, need } from './shared/oystehr-client';
import { type ZambdaCtx, zambdaPost } from './shared/zambda';

const ZAMBDA_API = arg('--zambda-api', process.env.ZAMBDA_API || 'http://localhost:3000/local');

// The 12 synth providers (must match the names created via the Add-Employee UI /
// link-synth-staff-users). credential → providerType (MD/DO/NP/PA).
const PROVIDERS: Array<[first: string, last: string, type: 'MD' | 'DO' | 'NP' | 'PA']> = [
  ['Maria', 'Alvarez', 'MD'],
  ['James', 'Okafor', 'DO'],
  ['Priya', 'Nair', 'NP'],
  ['Daniel', 'Cohen', 'MD'],
  ['Sofia', 'Ramirez', 'PA'],
  ['Wei', 'Chen', 'MD'],
  ['Aisha', 'Patel', 'MD'],
  ['Liam', "O'Brien", 'MD'],
  ['Grace', 'Kim', 'NP'],
  ['Marcus', 'Webb', 'DO'],
  ['Elena', 'Petrova', 'PA'],
  ['Samuel', 'Adeyemi', 'MD'],
];

const norm = (s: string): string => (s ?? '').trim().toLowerCase();

async function getEmployees(ctx: ZambdaCtx): Promise<any[]> {
  const res = await zambdaPost(ctx, 'get-employees', {});
  if (!res.ok) throw new Error(`get-employees failed: ${res.status} ${await res.text()}`);
  const j: any = await res.json();
  return j.output?.employees ?? j.employees ?? [];
}

(async () => {
  const ctx: ZambdaCtx = {
    zambdaApi: ZAMBDA_API,
    accessToken: await mintAccessToken(),
    projectId: need('PROJECT_ID'),
  };

  const employees = await getEmployees(ctx);
  const byName = new Map<string, any>();
  for (const e of employees) byName.set(`${norm(e.firstName)} ${norm(e.lastName)}`, e);

  console.log(`Granting Provider role to ${PROVIDERS.length} providers via ${ZAMBDA_API} …\n`);
  let updated = 0;
  let already = 0;
  let missing = 0;
  for (const [first, last, providerType] of PROVIDERS) {
    const emp = byName.get(`${norm(first)} ${norm(last)}`);
    if (!emp) {
      console.log(`  ✗ ${first} ${last}: not found in this env (create the employee first)`);
      missing++;
      continue;
    }
    if (emp.isProvider) {
      console.log(`  • ${first} ${last}: already a provider`);
      already++;
      continue;
    }
    const res = await zambdaPost(ctx, 'update-user', {
      userId: emp.id,
      firstName: first,
      lastName: last,
      selectedRoles: ['Provider'],
      providerType,
    });
    if (!res.ok) {
      console.log(`  ✗ ${first} ${last}: update-user ${res.status} ${(await res.text()).slice(0, 200)}`);
      continue;
    }
    console.log(`  ✓ ${first} ${last} (${providerType}) → Provider`);
    updated++;
  }

  // Verify by re-reading.
  const after = await getEmployees(ctx);
  const afterByName = new Map(after.map((e: any) => [`${norm(e.firstName)} ${norm(e.lastName)}`, e]));
  const confirmed = PROVIDERS.filter(([f, l]) => afterByName.get(`${norm(f)} ${norm(l)}`)?.isProvider).length;
  const providerTotal = after.filter((e: any) => e.isProvider).length;
  console.log(`\nDone — updated ${updated}, already-provider ${already}, missing ${missing}.`);
  console.log(
    `Verified ${confirmed}/${PROVIDERS.length} synth providers now isProvider; env has ${providerTotal} providers total.`
  );
  if (confirmed < PROVIDERS.length - missing) process.exit(1);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

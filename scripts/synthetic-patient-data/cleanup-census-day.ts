// Deletes one day's synth-census batch: finds the Appointments tagged with the
// census run-date, derives their Patients, and wipes each patient's full visit
// graph via the tested cleanup-synth-patient pipeline. Use this to re-run a day
// that generated badly (the census generator is idempotent and will otherwise
// skip a day that already has its visits).
//
//   npx env-cmd -f packages/zambdas/.env/demo.json npx tsx \
//     scripts/synthetic-patient-data/cleanup-census-day.ts [--date YYYY-MM-DD] [--execute]
//
// Dry-run by default (lists what it would delete). --date defaults to today (ET).

import Oystehr from '@oystehr/sdk';
import { spawnSync } from 'child_process';
import { DateTime } from 'luxon';
import { resolve } from 'path';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const arg = (name: string, dflt: string): string => {
  const i = process.argv.indexOf(name);
  return i !== -1 && i < process.argv.length - 1 ? process.argv[i + 1] : dflt;
};
const TZ = 'America/New_York';
const RUN_DATE_SYSTEM = 'https://fhir.ottehr.com/sid/synth-cron-run-date';
const DATE = arg('--date', DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd'));
const EXECUTE = process.argv.includes('--execute');
const CLEANUP = resolve(__dirname, 'cleanup-synth-patient.ts');

(async () => {
  const tk = await (
    await fetch(need('AUTH0_ENDPOINT'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.AUTH0_CLIENT,
        client_secret: process.env.AUTH0_SECRET,
        audience: process.env.AUTH0_AUDIENCE,
        grant_type: 'client_credentials',
      }),
    })
  ).json();
  const o = new Oystehr({
    accessToken: (tk as any).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  const appts = (
    await o.fhir.search({
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: `${RUN_DATE_SYSTEM}|${DATE}` },
        { name: '_count', value: '300' },
      ],
    })
  )
    .unbundle()
    .filter((r: any) => r.resourceType === 'Appointment') as any[];

  const patientIds = [
    ...new Set(
      appts
        .flatMap((a: any) => a.participant ?? [])
        .map((p: any) => p.actor?.reference)
        .filter((ref: string | undefined) => ref?.startsWith('Patient/'))
        .map((ref: string) => ref.split('/')[1])
    ),
  ];

  console.log(`Census batch for ${DATE}: ${appts.length} appointment(s), ${patientIds.length} patient(s).`);
  if (!patientIds.length) {
    console.log('Nothing to delete.');
    return;
  }
  if (!EXECUTE) {
    console.log('DRY RUN — patients that would be wiped:');
    patientIds.forEach((id) => console.log(`  ${id}`));
    console.log('\nRe-run with --execute to delete.');
    return;
  }

  let ok = 0;
  for (const id of patientIds) {
    const r = spawnSync('npx', ['tsx', CLEANUP, id, '--execute'], { stdio: 'inherit', env: process.env });
    if (r.status === 0) ok++;
    else console.log(`  ✗ cleanup failed for ${id} (exit ${r.status})`);
  }
  console.log(`\nDeleted ${ok}/${patientIds.length} census patients for ${DATE}.`);
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});

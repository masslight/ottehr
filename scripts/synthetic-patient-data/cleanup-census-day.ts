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

import { spawnSync } from 'child_process';
import { DateTime } from 'luxon';
import { resolve } from 'path';
import { argDate, flag } from './shared/cli';
import { SYNTH_CRON_RUN_DATE_SYSTEM as RUN_DATE_SYSTEM } from './shared/constants';
import { createOystehrFromEnv } from './shared/oystehr-client';

const TZ = 'America/New_York';
const DATE = argDate('--date', DateTime.now().setZone(TZ).toFormat('yyyy-MM-dd'));
const EXECUTE = flag('--execute');
const CLEANUP = resolve(__dirname, 'cleanup-synth-patient.ts');

(async () => {
  const o = await createOystehrFromEnv();

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

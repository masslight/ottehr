// Makes the in-person Schedules (Los Angeles + New York) fully open 24/7 with
// huge per-hour capacity. Required for the population build: the runner books a
// throwaway near-future "scaffold" slot per visit (Phase 15 then backdates it to
// the real date), and the per-visit scaffold offset marches those slots across
// arbitrary future clock times. Any slot that lands in a CLOSED hour / non-
// working day / over-capacity hour is rejected by create-appointment with 4019
// "slot unavailable". A 24/7 high-capacity schedule guarantees every scaffold
// booking succeeds.
//
// Schedule capacity/hours ONLY gate new bookings — they do NOT affect the
// backdated historical visits (Phase 15 patches FHIR directly). Safe for synth.
//
// Each schedule's original config is backed up to schedule-backup-<locId>.json.
//
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx fix-schedules-permissive.ts
//   npx env-cmd -f packages/zambdas/.env/synth.json npx tsx fix-schedules-permissive.ts --restore

import Oystehr from '@oystehr/sdk';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const need = (n: string): string => {
  const v = process.env[n];
  if (!v) throw new Error('Missing ' + n);
  return v;
};
const SCHEDULE_EXT_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule';
const LOCS: Array<{ name: string; id: string }> = [
  { name: 'Los Angeles', id: '14d2b216-8117-4879-883e-167dc3a3f484' },
  { name: 'New York', id: '1d34acf7-88d2-4e48-9739-6883eced1b20' },
];
const RESTORE = process.argv.includes('--restore');
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function open247(): string {
  const hours = Array.from({ length: 24 }, (_, h) => ({ hour: h, capacity: 1000 }));
  const day = { open: 0, close: 23, openingBuffer: 0, closingBuffer: 0, workingDay: true, hours };
  const schedule: Record<string, unknown> = {};
  for (const d of DAYS) schedule[d] = day;
  return JSON.stringify({ schedule, scheduleOverrides: {} });
}

async function getSchedule(o: Oystehr, locId: string): Promise<any> {
  const sb = await o.fhir.search({ resourceType: 'Schedule', params: [{ name: 'actor', value: `Location/${locId}` }] });
  return sb.unbundle().find((r: any) => r.resourceType === 'Schedule');
}

(async () => {
  const t = await (
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
    accessToken: (t as any).access_token,
    projectId: need('PROJECT_ID'),
    services: { projectApiUrl: need('PROJECT_API') },
  });

  for (const loc of LOCS) {
    const sched = await getSchedule(o, loc.id);
    if (!sched) {
      console.log(`  ${loc.name}: no schedule found, skipping`);
      continue;
    }
    const idx = (sched.extension || []).findIndex((e: any) => e.url === SCHEDULE_EXT_URL);
    if (idx < 0) {
      console.log(`  ${loc.name}: no schedule-json extension, skipping`);
      continue;
    }
    const backup = resolve(__dirname, `schedule-backup-${loc.id}.json`);

    if (RESTORE) {
      if (!existsSync(backup)) {
        console.log(`  ${loc.name}: no backup, skipping`);
        continue;
      }
      sched.extension[idx].valueString = readFileSync(backup, 'utf-8');
      await o.fhir.update(sched);
      console.log(`  ${loc.name}: restored from backup`);
      continue;
    }

    if (!existsSync(backup)) writeFileSync(backup, sched.extension[idx].valueString ?? '{}');
    sched.extension[idx].valueString = open247();
    await o.fhir.update(sched);
    console.log(`  ${loc.name}: set 24/7 open, capacity 1000/hr (backup → ${backup.split('/').pop()})`);
  }
  console.log(
    RESTORE ? 'Restore complete.' : 'Schedules permissive. Scaffold bookings will succeed at any future time.'
  );
})().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
